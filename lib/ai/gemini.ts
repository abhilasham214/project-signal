/**
 * GeminiProvider — the real Google Gemini integration.
 *
 * THE RULES THAT MATTER IN THIS FILE
 *
 *   1. There is no per-project logic here. None. This provider serialises
 *      whichever project it is handed, sends it with a global prompt, and
 *      processes whatever comes back. If you ever find yourself adding
 *      `if (project.id === ...)` in this file, the prototype has stopped
 *      demonstrating anything and the change is wrong.
 *
 *   2. Only the selected project is serialised. `buildProjectPayload` receives
 *      one `Project` and has no access to the dataset, so there is no path by
 *      which a second project could be included.
 *
 *   3. The evaluation answer key is never imported here, directly or
 *      transitively. `data/evaluation.json` is read only by `lib/evaluation`,
 *      which runs after analysis and never calls a provider.
 *
 *   4. `import 'server-only'` below is load-bearing. It makes the build fail
 *      if this module is ever pulled into a client component, which is what
 *      keeps GEMINI_API_KEY out of the browser bundle.
 *
 * This file is only ever loaded when AI_PROVIDER=gemini. `lib/ai/provider.ts`
 * imports it lazily so the SDK and the key stay out of mock-mode processes.
 */

import 'server-only';

import { GoogleGenAI, Type } from '@google/genai';
import {
  InvalidProviderResponseError,
  MissingApiKeyError,
  ProviderRequestError,
  ProviderTimeoutError,
} from './errors';
import { ANALYSIS_PROMPT, PROJECT_CHAT_PROMPT } from './prompts';
import type { AIProvider, ProviderName } from './provider';
import {
  ProviderAnalysisOutputSchema,
  RawChatResultSchema,
  SIGNAL_CATEGORIES,
  SEVERITY_LEVELS,
  CONFIDENCE_LEVELS,
  type ChatMessage,
  type ProviderAnalysisOutput,
  type RawChatResult,
} from './schemas';
import { describeError, logEvent, startTimer } from '@/lib/logging/log';
import type { SourceType } from '@/lib/projects/record-kinds';
import type { Project } from '@/lib/types/project';

/** How long a single Gemini call may take before it is abandoned. */
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * The record kinds serialised into the prompt. Deliberately a subset of the
 * eight the dataset holds.
 *
 * why: it keeps each call small and cheap. The same list constrains the
 * `sourceType` the model may cite, so it cannot cite a kind it was never
 * shown. Adding a kind back means a new section in `buildProjectPayload`
 * and a new entry here.
 */
export const SENT_SOURCE_TYPES = ['meeting', 'siteReport', 'issue', 'change'] as const satisfies readonly SourceType[];

/** Default model, overridable with GEMINI_MODEL. */
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Structured-output schema for analysis.
 *
 * Constraining the model at the API level means malformed shapes are mostly
 * prevented rather than caught. The Zod parse afterwards is still mandatory —
 * this is a first line of defence, not the guarantee.
 */
const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: [...SIGNAL_CATEGORIES] },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          reason: { type: Type.STRING },
          severity: { type: Type.STRING, enum: [...SEVERITY_LEVELS] },
          confidence: { type: Type.STRING, enum: [...CONFIDENCE_LEVELS] },
          recommendedReview: { type: Type.STRING },
          evidence: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sourceType: { type: Type.STRING, enum: [...SENT_SOURCE_TYPES] },
                sourceId: { type: Type.STRING },
              },
              required: ['sourceType', 'sourceId'],
            },
          },
        },
        required: [
          'category',
          'title',
          'description',
          'reason',
          'severity',
          'confidence',
          'recommendedReview',
          'evidence',
        ],
      },
    },
  },
  required: ['signals'],
};

/** Structured-output schema for a chat answer. */
const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    citedSourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['answer', 'citedSourceIds'],
};

/**
 * Serialises ONE project into the text sent to the model.
 *
 * Takes a single project and returns a string. There is no parameter here
 * through which a second project, or the evaluation key, could travel — the
 * isolation is a property of the signature, not of a check performed inside.
 *
 * @returns the project header and the record collections listed in
 *          `SENT_SOURCE_TYPES` as plain text.
 */
export function buildProjectPayload(project: Project): string {
  const sections: string[] = [
    'PROJECT',
    `id: ${project.id}`,
    `name: ${project.name}`,
    `type: ${project.type}`,
    `location: ${project.location}`,
    `client: ${project.client}`,
    `status: ${project.status}`,
    `description: ${project.description}`,
    `plannedCompletion: ${project.plannedCompletion}`,
    `currentCompletion: ${project.currentCompletion}`,
    '',
  ];

  sections.push('MEETINGS');
  for (const meeting of project.meetings) {
    sections.push(
      `[${meeting.id}] ${meeting.date} | ${meeting.title} | attendees: ${meeting.attendees.join('; ')}`,
      meeting.notes,
      '',
    );
  }

  sections.push('SITE REPORTS');
  for (const report of project.siteReports) {
    sections.push(`[${report.id}] ${report.date} | area: ${report.area} | reported by: ${report.reportedBy}`, report.observations, '');
  }

  sections.push('ISSUES');
  for (const issue of project.issues) {
    sections.push(
      `[${issue.id}] ${issue.date} | ${issue.title} | discipline: ${issue.discipline} | raised by: ${issue.raisedBy} | status: ${issue.status}${
        issue.closedDate ? ` | closed: ${issue.closedDate}` : ''
      }`,
      issue.description,
      '',
    );
  }

  sections.push('CHANGES');
  for (const change of project.changes) {
    sections.push(`[${change.id}] ${change.date} | ${change.title} | origin: ${change.origin}`, change.description, '');
  }

  return sections.join('\n');
}

/**
 * Reads the API key from the environment.
 *
 * @throws {MissingApiKeyError} when the key is absent. Deliberately fatal:
 *         there is no fallback to the mock provider, because answering with
 *         fixtures while the user believes they are seeing Gemini output would
 *         make the prototype dishonest about its own behaviour.
 */
function readApiKey(): string {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (apiKey === '') throw new MissingApiKeyError();
  return apiKey;
}

/** The real Gemini-backed provider. Used only when AI_PROVIDER=gemini. */
export class GeminiProvider implements AIProvider {
  readonly name: ProviderName = 'gemini';

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: readApiKey() });
    this.model = (process.env.GEMINI_MODEL ?? '').trim() || DEFAULT_MODEL;
  }

  /**
   * Performs one structured Gemini call with a timeout.
   *
   * Logs the call before and after, with sizes, latency, token usage and the
   * finish reason. why: on a deployment these are the numbers that separate
   * "Google is slow" from "we sent too much" from "the answer was cut off at
   * the token limit". Prompt and response text are never logged.
   *
   * @param purpose `analysis` or `chat`, so the log line says which path ran.
   * @returns the raw response text.
   * @throws {ProviderTimeoutError} when the call exceeds the timeout.
   * @throws {ProviderRequestError} when the API rejects or fails the request.
   * @throws {InvalidProviderResponseError} when the response carries no text.
   */
  private async callModel(
    purpose: 'analysis' | 'chat',
    systemInstruction: string,
    userContent: string,
    responseSchema: object,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const elapsedMs = startTimer();
    const callFields = {
      purpose,
      model: this.model,
      systemChars: systemInstruction.length,
      contentChars: userContent.length,
    };

    logEvent('info', 'gemini.call.started', { ...callFields, timeoutMs: REQUEST_TIMEOUT_MS });

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: userContent,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          abortSignal: controller.signal,
          // why low temperature: the task is reading records, not writing
          // prose. Less variation means fewer invented specifics.
          temperature: 0.2,
        },
      });

      const text = response.text;
      logEvent('info', 'gemini.call.completed', {
        ...callFields,
        durationMs: elapsedMs(),
        responseChars: text?.length ?? 0,
        // why finishReason: MAX_TOKENS or SAFETY explains truncated or empty
        // output, which otherwise surfaces later as a confusing parse error.
        finishReason: response.candidates?.[0]?.finishReason,
        promptTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
        totalTokens: response.usageMetadata?.totalTokenCount,
        blockReason: response.promptFeedback?.blockReason,
      });

      if (!text || text.trim() === '') {
        throw new InvalidProviderResponseError('the response contained no text');
      }
      return text;
    } catch (error) {
      if (error instanceof InvalidProviderResponseError) throw error;

      const timedOut = controller.signal.aborted;
      const upstreamStatus = (error as { status?: unknown })?.status;
      logEvent('error', 'gemini.call.failed', {
        ...callFields,
        durationMs: elapsedMs(),
        timedOut,
        ...describeError(error),
      });

      if (timedOut) throw new ProviderTimeoutError(REQUEST_TIMEOUT_MS);
      throw new ProviderRequestError(
        error instanceof Error ? error.message : String(error),
        typeof upstreamStatus === 'number' ? upstreamStatus : undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Parses a JSON response body.
   *
   * @throws {InvalidProviderResponseError} when the text is not valid JSON.
   *         The raw body is logged server-side but never returned to the
   *         browser, so a stack trace or partial prompt cannot leak.
   */
  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      // why length only: a truncated body (see finishReason) is the usual cause.
      logEvent('error', 'gemini.response.not_json', { responseChars: text.length });
      throw new InvalidProviderResponseError('the response was not valid JSON');
    }
  }

  /**
   * Sends one project to Gemini and returns its raw signal proposals.
   *
   * @returns unvalidated output. The caller MUST run per-signal schema
   *          parsing and evidence validation before any of it is shown.
   */
  async analyzeProject(project: Project): Promise<ProviderAnalysisOutput> {
    const payload = buildProjectPayload(project);
    const text = await this.callModel(
      'analysis',
      ANALYSIS_PROMPT,
      `Analyse the following project records.\n\n${payload}`,
      ANALYSIS_RESPONSE_SCHEMA,
    );

    // Only the envelope is checked here. Individual signals are validated one
    // at a time by the analyzer, so one malformed signal cannot discard the rest.
    const parsed = ProviderAnalysisOutputSchema.safeParse(this.parseJson(text));
    if (!parsed.success) {
      logEvent('error', 'gemini.response.bad_envelope', {
        purpose: 'analysis',
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
      });
      throw new InvalidProviderResponseError('the response did not contain a signals array');
    }
    return parsed.data;
  }

  /**
   * Answers one question about one project.
   *
   * The conversation is flattened into the user content, and only this
   * project records accompany it.
   *
   * @returns the raw answer and the ids it claims to have used. Those ids are
   *          resolved against the project by the caller before being shown.
   */
  async chatAboutProject(project: Project, messages: readonly ChatMessage[]): Promise<RawChatResult> {
    const payload = buildProjectPayload(project);
    const conversation = messages
      .map((message) => `${message.role === 'user' ? 'Question' : 'Previous answer'}: ${message.content}`)
      .join('\n\n');

    const text = await this.callModel(
      'chat',
      PROJECT_CHAT_PROMPT,
      `Project records:\n\n${payload}\n\n---\n\nConversation so far:\n\n${conversation}`,
      CHAT_RESPONSE_SCHEMA,
    );

    const parsed = RawChatResultSchema.safeParse(this.parseJson(text));
    if (!parsed.success) {
      logEvent('error', 'gemini.response.bad_envelope', {
        purpose: 'chat',
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
      });
      throw new InvalidProviderResponseError('the response did not match the required chat schema');
    }
    return parsed.data;
  }
}
