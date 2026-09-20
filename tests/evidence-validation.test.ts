/**
 * Evidence validation — the trust boundary.
 *
 * These are the most important tests in the suite. They are what stands
 * between a hallucinated citation and a construction manager reading it as
 * fact.
 */

import { describe, expect, it } from 'vitest';
import { getProject } from '@/lib/projects';
import {
  validateChatCitations,
  validateSignalEvidence,
  validateSignals,
  validateSingleEvidence,
} from '@/lib/validation/evidence';
import type { RawSignal } from '@/lib/ai/schemas';

const projectOne = getProject('P001')!;
const projectTwo = getProject('P002')!;

/** Builds a raw signal with the given citations. */
function signalCiting(evidence: RawSignal['evidence'], overrides: Partial<RawSignal> = {}): RawSignal {
  return {
    category: 'DEPENDENCY',
    title: 'A signal under test',
    description: 'Description.',
    reason: 'Reason.',
    severity: 'MEDIUM',
    confidence: 'MEDIUM',
    recommendedReview: 'Something a human might check.',
    evidence,
    ...overrides,
  };
}

describe('single citation resolution', () => {
  it('accepts a record that exists in the selected project', () => {
    const result = validateSingleEvidence(projectOne, {
      sourceType: 'issue',
      sourceId: 'P001-I001',
    });
    expect(result.accepted).toBe(true);
  });

  it('returns the real record content, not anything supplied by the model', () => {
    const result = validateSingleEvidence(projectOne, {
      sourceType: 'issue',
      sourceId: 'P001-I001',
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const actualIssue = projectOne.issues.find((issue) => issue.id === 'P001-I001')!;
    expect(result.evidence.content).toBe(actualIssue.description);
    expect(result.evidence.title).toBe(actualIssue.title);
  });

  it('rejects a source id that does not exist anywhere', () => {
    const result = validateSingleEvidence(projectOne, {
      sourceType: 'siteReport',
      sourceId: 'P001-SR999',
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.rejection.reason).toBe('RECORD_NOT_IN_PROJECT');
  });

  it('rejects a real record id that belongs to a DIFFERENT project', () => {
    // P002-I001 is a genuine record — just not one this project can cite.
    expect(projectTwo.issues.some((issue) => issue.id === 'P002-I001')).toBe(true);

    const result = validateSingleEvidence(projectOne, {
      sourceType: 'issue',
      sourceId: 'P002-I001',
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.rejection.reason).toBe('RECORD_NOT_IN_PROJECT');
  });

  it('rejects a real id in this project filed under the wrong source type', () => {
    // P001-I001 is an issue, not a meeting. The claim is wrong, so it fails.
    const result = validateSingleEvidence(projectOne, {
      sourceType: 'meeting',
      sourceId: 'P001-I001',
    });
    expect(result.accepted).toBe(false);
  });

  it('rejects an invented source type', () => {
    const result = validateSingleEvidence(projectOne, {
      sourceType: 'emailThread',
      sourceId: 'P001-I001',
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.rejection.reason).toBe('UNKNOWN_SOURCE_TYPE');
  });
});

describe('signal-level evidence validation', () => {
  it('keeps a signal whose citations all resolve', () => {
    const outcome = validateSignalEvidence(
      projectOne,
      signalCiting([
        { sourceType: 'issue', sourceId: 'P001-I001' },
        { sourceType: 'dependency', sourceId: 'P001-DEP001' },
      ]),
    );

    expect(outcome.kept).toBe(true);
    if (outcome.kept) {
      expect(outcome.signal.evidence).toHaveLength(2);
      expect(outcome.signal.rejectedEvidence).toHaveLength(0);
      expect(outcome.signal.status).toBe('NEW');
      expect(outcome.signal.projectId).toBe('P001');
    }
  });

  it('keeps a partially valid signal but records the rejected citations', () => {
    const outcome = validateSignalEvidence(
      projectOne,
      signalCiting([
        { sourceType: 'issue', sourceId: 'P001-I001' },
        { sourceType: 'siteReport', sourceId: 'P001-SR999' },
      ]),
    );

    expect(outcome.kept).toBe(true);
    if (outcome.kept) {
      expect(outcome.signal.evidence.map((item) => item.sourceId)).toEqual(['P001-I001']);
      expect(outcome.signal.rejectedEvidence.map((item) => item.sourceId)).toEqual(['P001-SR999']);
    }
  });

  it('DISCARDS a signal whose every citation fails', () => {
    // NO EVIDENCE = NO SIGNAL. It must not appear with an empty evidence list.
    const outcome = validateSignalEvidence(
      projectOne,
      signalCiting([
        { sourceType: 'siteReport', sourceId: 'P001-SR999' },
        { sourceType: 'meeting', sourceId: 'P001-M999' },
      ]),
    );

    expect(outcome.kept).toBe(false);
    if (!outcome.kept) {
      expect(outcome.discarded.reason).toBe('NO_VALID_EVIDENCE');
      expect(outcome.discarded.detail).toContain('P001-SR999');
    }
  });

  it('DISCARDS a signal citing only records from another project', () => {
    const outcome = validateSignalEvidence(
      projectTwo,
      signalCiting([
        { sourceType: 'meeting', sourceId: 'P001-M001' },
        { sourceType: 'issue', sourceId: 'P001-I002' },
      ]),
    );

    expect(outcome.kept).toBe(false);
  });

  it('collapses duplicate citations so support cannot be inflated', () => {
    const outcome = validateSignalEvidence(
      projectOne,
      signalCiting([
        { sourceType: 'issue', sourceId: 'P001-I001' },
        { sourceType: 'issue', sourceId: 'P001-I001' },
        { sourceType: 'issue', sourceId: 'P001-I001' },
      ]),
    );

    expect(outcome.kept).toBe(true);
    if (outcome.kept) expect(outcome.signal.evidence).toHaveLength(1);
  });
});

describe('batch validation', () => {
  it('keeps good signals and discards bad ones in the same batch', () => {
    const { signals, discarded } = validateSignals(projectOne, [
      signalCiting([{ sourceType: 'issue', sourceId: 'P001-I001' }]),
      signalCiting([{ sourceType: 'siteReport', sourceId: 'P001-SR999' }], {
        category: 'CHANGE',
        title: 'Should be discarded',
      }),
    ]);

    expect(signals).toHaveLength(1);
    expect(discarded).toHaveLength(1);
    expect(discarded[0]!.title).toBe('Should be discarded');
  });

  it('collapses two signals that mint the same id', () => {
    const duplicate = signalCiting([{ sourceType: 'issue', sourceId: 'P001-I001' }]);
    const { signals } = validateSignals(projectOne, [duplicate, { ...duplicate, title: 'Reworded' }]);
    expect(signals).toHaveLength(1);
  });

  it('mints ids that are stable across runs and independent of citation order', () => {
    const forward = validateSignals(projectOne, [
      signalCiting([
        { sourceType: 'issue', sourceId: 'P001-I001' },
        { sourceType: 'dependency', sourceId: 'P001-DEP001' },
      ]),
    ]);
    const reversed = validateSignals(projectOne, [
      signalCiting([
        { sourceType: 'dependency', sourceId: 'P001-DEP001' },
        { sourceType: 'issue', sourceId: 'P001-I001' },
      ]),
    ]);

    // why this matters: a stable id is what lets a human review survive a
    // re-analysis that re-discovers the same signal.
    expect(forward.signals[0]!.id).toBe(reversed.signals[0]!.id);
    expect(forward.signals[0]!.id.startsWith('P001-')).toBe(true);
  });

  it('gives different categories over the same evidence different ids', () => {
    const asDependency = validateSignals(projectOne, [
      signalCiting([{ sourceType: 'issue', sourceId: 'P001-I001' }]),
    ]);
    const asChange = validateSignals(projectOne, [
      signalCiting([{ sourceType: 'issue', sourceId: 'P001-I001' }], { category: 'CHANGE' }),
    ]);

    expect(asDependency.signals[0]!.id).not.toBe(asChange.signals[0]!.id);
  });

  it('handles an empty batch without error', () => {
    const { signals, discarded } = validateSignals(projectOne, []);
    expect(signals).toEqual([]);
    expect(discarded).toEqual([]);
  });
});

describe('chat citation resolution', () => {
  it('resolves bare ids without being told the record type', () => {
    const citations = validateChatCitations(projectOne, ['P001-M001', 'P001-SR002', 'P001-DEP001']);
    expect(citations.map((citation) => citation.sourceId)).toEqual([
      'P001-M001',
      'P001-SR002',
      'P001-DEP001',
    ]);
  });

  it('silently drops ids from another project', () => {
    const citations = validateChatCitations(projectOne, ['P001-M001', 'P002-M001']);
    expect(citations.map((citation) => citation.sourceId)).toEqual(['P001-M001']);
  });

  it('drops unknown ids and deduplicates', () => {
    const citations = validateChatCitations(projectOne, ['P001-M001', 'P001-M001', 'NOPE-1']);
    expect(citations).toHaveLength(1);
  });
});
