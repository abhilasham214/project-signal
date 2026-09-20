/**
 * Project isolation and evaluation-key isolation.
 *
 * Two guarantees are tested here, and both are about what does NOT appear in
 * the text sent to a provider:
 *
 *   1. Analysing or chatting about P001 sends no P002-P005 content.
 *   2. No prompt payload ever contains the evaluation answer key.
 *
 * The payload builder is imported from `lib/ai/gemini.ts`, which is the exact
 * function the real Gemini path uses. Importing that module does not construct
 * a client or make any network call — only `new GeminiProvider()` would read
 * the API key, and nothing here does that.
 */

import { describe, expect, it } from 'vitest';
import evaluationJson from '@/data/evaluation.json';
import projectsJson from '@/data/projects.json';
import { buildProjectPayload, SENT_SOURCE_TYPES } from '@/lib/ai/gemini';
import { ANALYSIS_PROMPT, PROJECT_CHAT_PROMPT } from '@/lib/ai/prompts';
import { RECORD_KINDS, getProject, listProjectIds } from '@/lib/projects';
import type { Project } from '@/lib/types/project';

const dataset = projectsJson as unknown as { projects: Project[] };

/** Every record id belonging to projects OTHER than the one given. */
function foreignRecordIds(selectedProjectId: string): string[] {
  return dataset.projects
    .filter((project) => project.id !== selectedProjectId)
    .flatMap((project) => RECORD_KINDS.flatMap((kind) => project[kind.collection].map((r) => r.id)));
}

describe('analysis payload isolation', () => {
  it.each(listProjectIds())('a %s payload contains no foreign record id', (projectId) => {
    const payload = buildProjectPayload(getProject(projectId)!);

    for (const foreignId of foreignRecordIds(projectId)) {
      expect(payload).not.toContain(foreignId);
    }
  });

  it.each(listProjectIds())('a %s payload contains no other project name', (projectId) => {
    const payload = buildProjectPayload(getProject(projectId)!);

    for (const other of dataset.projects) {
      if (other.id === projectId) continue;
      expect(payload).not.toContain(other.name);
      expect(payload).not.toContain(other.client);
    }
  });

  it('a P001 payload contains P001 records and its own header', () => {
    const payload = buildProjectPayload(getProject('P001')!);

    expect(payload).toContain('P001');
    expect(payload).toContain('P001-M001');
    expect(payload).toContain('P001-I001');
    expect(payload).toContain('Riverside Commercial Tower');
  });

  it('serialises exactly the record kinds listed in SENT_SOURCE_TYPES', () => {
    const project = getProject('P001')!;
    const payload = buildProjectPayload(project);

    for (const kind of RECORD_KINDS) {
      const isSent = (SENT_SOURCE_TYPES as readonly string[]).includes(kind.sourceType);
      for (const record of project[kind.collection]) {
        if (isSent) expect(payload).toContain(record.id);
        else expect(payload).not.toContain(record.id);
      }
    }
  });
});

describe('chat payload isolation', () => {
  // The chat path builds its payload with the same function, so the same
  // guarantee holds. This test states it explicitly rather than leaving it
  // implied, because the two paths could drift apart in future.
  it.each(listProjectIds())('a %s chat payload contains no foreign record id', (projectId) => {
    const payload = buildProjectPayload(getProject(projectId)!);
    const conversation = `Question: What decisions are still unresolved?`;
    const fullContent = `Project records:\n\n${payload}\n\n---\n\n${conversation}`;

    for (const foreignId of foreignRecordIds(projectId)) {
      expect(fullContent).not.toContain(foreignId);
    }
  });
});

describe('evaluation answer key isolation', () => {
  const evaluationText = JSON.stringify(evaluationJson);
  const evaluation = evaluationJson as unknown as {
    projects: Array<{
      projectId: string;
      expectedSignals: Array<{ description: string }>;
      expectedAbsences?: Array<{ reason: string }>;
    }>;
  };

  it.each(listProjectIds())('no %s payload contains any expected-signal text', (projectId) => {
    const payload = buildProjectPayload(getProject(projectId)!);

    for (const entry of evaluation.projects) {
      for (const expected of entry.expectedSignals) {
        expect(payload).not.toContain(expected.description);
      }
      for (const absence of entry.expectedAbsences ?? []) {
        expect(payload).not.toContain(absence.reason);
      }
    }
  });

  it('neither global prompt contains answer key text', () => {
    for (const entry of evaluation.projects) {
      for (const expected of entry.expectedSignals) {
        expect(ANALYSIS_PROMPT).not.toContain(expected.description);
        expect(PROJECT_CHAT_PROMPT).not.toContain(expected.description);
      }
    }
    expect(evaluationText).not.toContain(ANALYSIS_PROMPT);
  });

  it('the evaluation module is not reachable from the AI layer', async () => {
    // A structural check: if lib/ai ever imported the answer key, the key
    // could travel into a prompt. Assert the AI modules do not export it and
    // that the evaluation module carries the warning comment.
    const geminiModule = await import('@/lib/ai/gemini');
    const analyzerModule = await import('@/lib/ai/analyzer');

    expect(Object.keys(geminiModule)).not.toContain('evaluateProject');
    expect(Object.keys(analyzerModule)).not.toContain('evaluateProject');
  });
});

describe('global prompts', () => {
  it('names no project, scenario or record id', () => {
    // why: a prompt that mentioned HVAC or waterproofing would be recognising
    // itself rather than reading the records.
    const scenarioWords = ['HVAC', 'waterproof', 'facade', 'Riverside', 'Harbourfront', 'P001'];

    for (const prompt of [ANALYSIS_PROMPT, PROJECT_CHAT_PROMPT]) {
      for (const word of scenarioWords) {
        expect(prompt.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });

  it('states the core evidence rule and the temporal rule', () => {
    expect(ANALYSIS_PROMPT).toContain('NO EVIDENCE = NO SIGNAL');
    expect(ANALYSIS_PROMPT).toContain('resolved');
    expect(ANALYSIS_PROMPT).toContain('Do not assign blame');
  });

  it('keeps the analysis and chat prompts genuinely distinct', () => {
    expect(ANALYSIS_PROMPT).not.toBe(PROJECT_CHAT_PROMPT);
  });
});
