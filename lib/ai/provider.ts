/**
 * AI provider selection — the single switch between demo mode and real Gemini.
 *
 * This module enforces the projects hardest operating rule:
 *
 *   NOTHING reaches the Gemini API unless AI_PROVIDER is explicitly set to
 *   "gemini". The default, and the value used by every test and every browser
 *   verification run, is "mock".
 *
 * There is deliberately NO automatic fallback from Gemini to mock. If Gemini
 * is selected and fails, the failure is reported as a failure. why: a silent
 * fallback would show a user fixture output while they believed they were
 * looking at real model output — which, in a prototype whose entire point is
 * honesty about what the AI did, is the worst possible bug.
 *
 * `gemini.ts` is imported lazily, inside the gemini branch only. why: it pulls
 * in the Google SDK and reads the API key, and neither should be loaded into a
 * process that is running in mock mode.
 */

import { UnknownProviderError } from './errors';
import { describeRuntime, logEvent } from '@/lib/logging/log';
import { MockAIProvider } from './mock';
import type { ChatMessage, ProviderAnalysisOutput, RawChatResult } from './schemas';
import type { Project } from '@/lib/types/project';

/** Which provider is backing this process. Shown in the UI mode indicator. */
export type ProviderName = 'mock' | 'gemini';

/**
 * The contract both providers implement.
 *
 * Both take a single `Project` and nothing else. The signature is the
 * isolation guarantee: there is no parameter through which a second project
 * could be passed, so no provider can see one.
 */
export interface AIProvider {
  readonly name: ProviderName;

  /**
   * Produces candidate signals for one project.
   *
   * @returns raw, unvalidated model output. The caller must run it through
   *          Zod parsing and evidence validation before showing it to anyone.
   */
  analyzeProject(project: Project): Promise<ProviderAnalysisOutput>;

  /**
   * Answers a question about one project.
   *
   * @param messages the conversation so far, oldest first
   * @returns raw, unvalidated model output, including claimed citations.
   */
  chatAboutProject(project: Project, messages: readonly ChatMessage[]): Promise<RawChatResult>;
}

/**
 * Reads the configured provider name.
 *
 * @returns `"mock"` when AI_PROVIDER is unset or empty. why default to mock:
 *          a reviewer who clones this repository and runs `npm run dev` with
 *          no configuration must get a working demo, not an API key error —
 *          and must not be able to spend tokens by accident.
 * @throws {UnknownProviderError} when AI_PROVIDER holds an unrecognised value,
 *         rather than guessing which provider was meant.
 */
export function getProviderName(): ProviderName {
  const configured = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (configured === '' || configured === 'mock') return 'mock';
  if (configured === 'gemini') return 'gemini';
  throw new UnknownProviderError(configured);
}

/** Set once the runtime configuration has been logged for this server instance. */
let hasLoggedRuntime = false;

/**
 * Logs the deployment configuration the first time a provider is built in this
 * server instance.
 *
 * why: on Vercel each cold start is a fresh instance, and "which env vars did
 * this instance actually see" is the first question when Gemini works locally
 * but not in production. Booleans and names only; the key is never logged.
 */
function logRuntimeOnce(name: ProviderName): void {
  if (hasLoggedRuntime) return;
  hasLoggedRuntime = true;
  logEvent('info', 'runtime.config', { resolvedProvider: name, ...describeRuntime() });
}

/**
 * Builds the configured provider.
 *
 * @returns a `MockAIProvider` or a `GeminiProvider`, never a fallback between
 *          them.
 * @throws {UnknownProviderError} for an unrecognised AI_PROVIDER value.
 * @throws {MissingApiKeyError} when gemini is selected without an API key.
 */
export async function getProvider(): Promise<AIProvider> {
  const name = getProviderName();
  logRuntimeOnce(name);

  if (name === 'mock') {
    return new MockAIProvider();
  }

  // Lazy import: the Google SDK and the API key stay out of mock-mode processes.
  const { GeminiProvider } = await import('./gemini');
  return new GeminiProvider();
}

/** Human-readable label for the AI mode indicator in the UI. */
export function getProviderLabel(name: ProviderName): string {
  return name === 'gemini' ? 'Gemini' : 'Demo Mode';
}
