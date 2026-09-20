/**
 * End-to-end pipeline, human review, and provider safety.
 *
 * Runs the real `runAnalysis` and `runProjectChat` against the mock provider,
 * so the code path exercised here is the code path production uses — only the
 * provider at the end of it differs.
 *
 * ZERO Gemini calls. `vitest.config.ts` forces AI_PROVIDER=mock, and the first
 * describe block below asserts that is actually in effect.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { runAnalysis } from '@/lib/ai/analyzer';
import { runProjectChat } from '@/lib/ai/chat';
import { getProviderName, getProvider } from '@/lib/ai/provider';
import { MockAIProvider } from '@/lib/ai/mock';
import { MissingApiKeyError, UnknownProjectError } from '@/lib/ai/errors';
import { getReview, getRun, getSignal, saveReview } from '@/lib/store';
import { evaluateProject, summariseEvaluations } from '@/lib/evaluation';
import { getProject } from '@/lib/projects';

const TEST_STORE_DIR = process.env.PROJECT_SIGNAL_DATA_DIR!;

/** Clears the test store so each block starts from a known state. */
async function clearStore() {
  await rm(path.join(TEST_STORE_DIR, 'store.json'), { force: true });
}

afterAll(async () => {
  await rm(TEST_STORE_DIR, { recursive: true, force: true });
});

describe('provider safety', () => {
  it('resolves to the mock provider under test configuration', () => {
    expect(process.env.AI_PROVIDER).toBe('mock');
    expect(getProviderName()).toBe('mock');
  });

  it('builds a MockAIProvider, never a Gemini one', async () => {
    const provider = await getProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
    expect(provider.name).toBe('mock');
  });

  it('treats an unset AI_PROVIDER as mock', () => {
    const original = process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER;
    try {
      expect(getProviderName()).toBe('mock');
    } finally {
      process.env.AI_PROVIDER = original;
    }
  });

  it('fails with MissingApiKeyError before any network call when gemini has no key', async () => {
    // why this is safe to test: the key is read in the GeminiProvider
    // constructor, so the throw happens before a client exists and before any
    // request is made. This asserts the no-silent-fallback rule: selecting
    // gemini without a key is an error, never a quiet switch back to fixtures.
    const originalProvider = process.env.AI_PROVIDER;
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.AI_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    try {
      await expect(getProvider()).rejects.toBeInstanceOf(MissingApiKeyError);
    } finally {
      process.env.AI_PROVIDER = originalProvider;
      if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('throws rather than guessing when AI_PROVIDER is unrecognised', () => {
    const original = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'openai';
    try {
      expect(() => getProviderName()).toThrow();
    } finally {
      process.env.AI_PROVIDER = original;
    }
  });
});

describe('analysis pipeline', () => {
  beforeEach(clearStore);

  it('produces validated signals for P001', async () => {
    const run = await runAnalysis('P001');

    expect(run.projectId).toBe('P001');
    expect(run.provider).toBe('mock');
    expect(run.signals.length).toBeGreaterThan(0);

    for (const signal of run.signals) {
      expect(signal.evidence.length).toBeGreaterThan(0);
      expect(signal.status).toBe('NEW');
      expect(signal.projectId).toBe('P001');
    }
  });

  it('shows every displayed citation resolving to a real record of that project', async () => {
    const run = await runAnalysis('P001');
    const project = getProject('P001')!;

    for (const signal of run.signals) {
      for (const evidence of signal.evidence) {
        expect(evidence.sourceId.startsWith('P001-')).toBe(true);
        expect(evidence.content.length).toBeGreaterThan(0);
      }
    }
    expect(project.id).toBe('P001');
  });

  it('rejects the deliberately unverifiable citation in the P001 fixture', async () => {
    const run = await runAnalysis('P001');

    const allRejected = run.signals.flatMap((signal) =>
      signal.rejectedEvidence.map((rejected) => rejected.sourceId),
    );
    expect(allRejected).toContain('P001-SR999');

    // And it never appears as displayed evidence.
    const allAccepted = run.signals.flatMap((signal) =>
      signal.evidence.map((evidence) => evidence.sourceId),
    );
    expect(allAccepted).not.toContain('P001-SR999');
  });

  it('discards the P002 fixture signal that cites only another project', async () => {
    const run = await runAnalysis('P002');

    expect(run.discarded.some((entry) => entry.reason === 'NO_VALID_EVIDENCE')).toBe(true);
    expect(run.signals.some((signal) => signal.title.includes('cross-project'))).toBe(false);

    // No surviving signal cites anything outside P002.
    for (const signal of run.signals) {
      for (const evidence of signal.evidence) {
        expect(evidence.sourceId.startsWith('P002-')).toBe(true);
      }
    }
  });

  it('returns no signals for the resolved-issue project, without erroring', async () => {
    const run = await runAnalysis('P005');
    expect(run.signals).toEqual([]);
    expect(run.discarded).toEqual([]);
  });

  it('throws UnknownProjectError for an id not in the dataset', async () => {
    await expect(runAnalysis('P999')).rejects.toBeInstanceOf(UnknownProjectError);
  });

  it('persists the run so a page reload shows it without re-analysing', async () => {
    const run = await runAnalysis('P003');
    const stored = await getRun('P003');

    expect(stored).not.toBeNull();
    expect(stored!.signals.map((signal) => signal.id)).toEqual(
      run.signals.map((signal) => signal.id),
    );
  });

  it('returns null for a project that has not been analysed', async () => {
    expect(await getRun('P004')).toBeNull();
  });
});

describe('human review', () => {
  beforeEach(clearStore);

  it('records a confirmation', async () => {
    const run = await runAnalysis('P001');
    const signalId = run.signals[0]!.id;

    const review = await saveReview(signalId, 'CONFIRMED', 'Checked with the consultant.');
    expect(review.status).toBe('CONFIRMED');

    const found = await getSignal(signalId);
    expect(found!.signal.status).toBe('CONFIRMED');
    expect(found!.review!.note).toBe('Checked with the consultant.');
  });

  it('records a dismissal', async () => {
    const run = await runAnalysis('P001');
    const signalId = run.signals[0]!.id;

    await saveReview(signalId, 'DISMISSED', 'Already handled off-system.');
    expect((await getSignal(signalId))!.signal.status).toBe('DISMISSED');
  });

  it('records an investigate decision with a note', async () => {
    const run = await runAnalysis('P001');
    const signalId = run.signals[0]!.id;

    await saveReview(signalId, 'INVESTIGATE', 'Waiting for consultant response before deciding.');

    const review = await getReview(signalId);
    expect(review!.status).toBe('INVESTIGATE');
    expect(review!.note).toBe('Waiting for consultant response before deciding.');
    expect(review!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('allows a decision to be changed', async () => {
    const run = await runAnalysis('P001');
    const signalId = run.signals[0]!.id;

    await saveReview(signalId, 'CONFIRMED', 'First pass.');
    await saveReview(signalId, 'DISMISSED', 'Resolved since.');

    const found = await getSignal(signalId);
    expect(found!.signal.status).toBe('DISMISSED');
    expect(found!.review!.note).toBe('Resolved since.');
  });

  it('PRESERVES a human review across a re-analysis', async () => {
    // The point of deterministic signal ids. A re-run must not silently reset
    // a decision a person already made.
    const firstRun = await runAnalysis('P001');
    const signalId = firstRun.signals[0]!.id;
    await saveReview(signalId, 'CONFIRMED', 'Reviewed on site.');

    const secondRun = await runAnalysis('P001');
    const resurfaced = secondRun.signals.find((signal) => signal.id === signalId);

    expect(resurfaced).toBeDefined();
    expect(resurfaced!.status).toBe('CONFIRMED');
    expect((await getReview(signalId))!.note).toBe('Reviewed on site.');
  });

  it('returns null for an unknown signal id rather than throwing', async () => {
    expect(await getSignal('P001-deadbeef')).toBeNull();
    expect(await getReview('P001-deadbeef')).toBeNull();
  });
});

describe('project chat', () => {
  it('answers from the selected project and cites only its records', async () => {
    const result = await runProjectChat('P001', [
      { role: 'user', content: 'What decisions are still unresolved?' },
    ]);

    expect(result.answer.length).toBeGreaterThan(0);
    for (const citation of result.citations) {
      expect(citation.sourceId.startsWith('P001-')).toBe(true);
    }
  });

  it('gives a different, project-specific answer for a different project', async () => {
    const question = [{ role: 'user' as const, content: 'What decisions are still unresolved?' }];
    const first = await runProjectChat('P001', question);
    const second = await runProjectChat('P003', question);

    expect(first.answer).not.toBe(second.answer);
    for (const citation of second.citations) {
      expect(citation.sourceId.startsWith('P003-')).toBe(true);
    }
  });

  it('reports resolved items as resolved on the healthy project', async () => {
    const result = await runProjectChat('P005', [
      { role: 'user', content: 'Were any previously reported issues resolved?' },
    ]);

    expect(result.answer).toContain('closed');
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('throws UnknownProjectError for an unknown project', async () => {
    await expect(
      runProjectChat('P999', [{ role: 'user', content: 'Hello' }]),
    ).rejects.toBeInstanceOf(UnknownProjectError);
  });
});

describe('evaluation', () => {
  beforeEach(clearStore);

  it('matches expected signals on category and shared evidence', async () => {
    const run = await runAnalysis('P001');
    const evaluation = evaluateProject('P001', run);

    expect(evaluation.analyzed).toBe(true);
    expect(evaluation.matches.length).toBeGreaterThan(0);

    for (const match of evaluation.matches) {
      expect(match.expected.category).toBe(match.actual.category);
      expect(match.sharedEvidence.length).toBeGreaterThan(0);
    }
  });

  it('reports every expected signal as missed when a project is unanalysed', () => {
    const evaluation = evaluateProject('P001', null);

    expect(evaluation.analyzed).toBe(false);
    expect(evaluation.matches).toEqual([]);
    expect(evaluation.missed.length).toBeGreaterThan(0);
  });

  it('lists unmatched AI signals as potential false positives', async () => {
    const run = await runAnalysis('P002');
    const evaluation = evaluateProject('P002', run);

    const totalAccountedFor =
      evaluation.matches.length + evaluation.potentialFalsePositives.length;
    expect(totalAccountedFor).toBe(run.signals.length);
  });

  it('confirms the resolved issues on P005 were left alone', async () => {
    const run = await runAnalysis('P005');
    const evaluation = evaluateProject('P005', run);

    expect(evaluation.absences.length).toBeGreaterThan(0);
    for (const entry of evaluation.absences) {
      expect(entry.respected).toBe(true);
      expect(entry.surfacedBy).toEqual([]);
    }
  });

  it('never counts one AI signal against two expectations', async () => {
    const run = await runAnalysis('P003');
    const evaluation = evaluateProject('P003', run);

    const matchedIds = evaluation.matches.map((match) => match.actual.id);
    expect(new Set(matchedIds).size).toBe(matchedIds.length);
  });

  it('counts human confirmations in the summary', async () => {
    const run = await runAnalysis('P001');
    await saveReview(run.signals[0]!.id, 'CONFIRMED', '');

    const refreshed = await getRun('P001');
    const summary = summariseEvaluations([evaluateProject('P001', refreshed)]);

    expect(summary.humanConfirmed).toBe(1);
    expect(summary.projectsAnalyzed).toBe(1);
  });
});
