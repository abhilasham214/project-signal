/**
 * AI output schema validation.
 *
 * These tests describe what the application will and will not accept from a
 * language model. Every rejection here is a hallucination or a malformed
 * response that never reaches a human.
 */

import { describe, expect, it } from 'vitest';
import {
  AnalyzeRequestSchema,
  ChatRequestSchema,
  ProviderAnalysisOutputSchema,
  RawAnalysisResultSchema,
  RawChatResultSchema,
  RawSignalSchema,
  ReviewRequestSchema,
} from '@/lib/ai/schemas';

/** A signal that should always pass, used as the base for negative cases. */
const VALID_SIGNAL = {
  category: 'DEPENDENCY',
  title: 'Ceiling works appear to be waiting on an approval',
  description: 'The records describe ceiling works not starting while an approval is outstanding.',
  reason: 'An issue, a dependency and two site reports were read together.',
  severity: 'HIGH',
  confidence: 'MEDIUM',
  recommendedReview: 'You may wish to confirm the expected return date with the consultant.',
  evidence: [{ sourceType: 'issue', sourceId: 'P001-I001' }],
};

describe('RawSignalSchema acceptance', () => {
  it('accepts a well-formed signal', () => {
    expect(RawSignalSchema.safeParse(VALID_SIGNAL).success).toBe(true);
  });

  it('accepts every valid category', () => {
    const categories = [
      'DEPENDENCY',
      'REPEATED_ISSUE',
      'UNRESOLVED_DECISION',
      'CHANGE',
      'SCHEDULE_WARNING',
      'MISSING_INFORMATION',
      'INCONSISTENCY',
    ];
    for (const category of categories) {
      expect(RawSignalSchema.safeParse({ ...VALID_SIGNAL, category }).success).toBe(true);
    }
  });

  it('accepts every valid source type', () => {
    const sourceTypes = [
      'meeting',
      'siteReport',
      'issue',
      'decision',
      'change',
      'dependency',
      'contractorUpdate',
      'consultantUpdate',
    ];
    for (const sourceType of sourceTypes) {
      const signal = { ...VALID_SIGNAL, evidence: [{ sourceType, sourceId: 'P001-M001' }] };
      expect(RawSignalSchema.safeParse(signal).success).toBe(true);
    }
  });
});

describe('RawSignalSchema rejection', () => {
  it('rejects an invalid category', () => {
    const result = RawSignalSchema.safeParse({ ...VALID_SIGNAL, category: 'PROJECT_WILL_FAIL' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid severity', () => {
    expect(RawSignalSchema.safeParse({ ...VALID_SIGNAL, severity: 'CRITICAL' }).success).toBe(false);
  });

  it('rejects an invalid confidence', () => {
    expect(RawSignalSchema.safeParse({ ...VALID_SIGNAL, confidence: 'CERTAIN' }).success).toBe(false);
  });

  it('rejects a signal with an empty evidence array', () => {
    // NO EVIDENCE = NO SIGNAL, enforced at the schema level before anything else.
    const result = RawSignalSchema.safeParse({ ...VALID_SIGNAL, evidence: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a signal with no evidence field at all', () => {
    const { evidence: _evidence, ...withoutEvidence } = VALID_SIGNAL;
    expect(RawSignalSchema.safeParse(withoutEvidence).success).toBe(false);
  });

  it('rejects an invented source type', () => {
    const signal = { ...VALID_SIGNAL, evidence: [{ sourceType: 'emailThread', sourceId: 'X1' }] };
    expect(RawSignalSchema.safeParse(signal).success).toBe(false);
  });

  it('rejects evidence with an empty source id', () => {
    const signal = { ...VALID_SIGNAL, evidence: [{ sourceType: 'issue', sourceId: '' }] };
    expect(RawSignalSchema.safeParse(signal).success).toBe(false);
  });

  it('rejects missing required prose fields', () => {
    for (const field of ['title', 'description', 'reason', 'recommendedReview']) {
      const signal = { ...VALID_SIGNAL, [field]: '' };
      expect(RawSignalSchema.safeParse(signal).success).toBe(false);
    }
  });

  it('rejects non-object input', () => {
    for (const input of [null, undefined, 'a signal', 42, []]) {
      expect(RawSignalSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('analysis envelope', () => {
  it('accepts an empty signals array as a valid outcome', () => {
    // An honest "nothing supportable was found" must not be an error.
    expect(RawAnalysisResultSchema.safeParse({ signals: [] }).success).toBe(true);
    expect(ProviderAnalysisOutputSchema.safeParse({ signals: [] }).success).toBe(true);
  });

  it('rejects a malformed envelope with no signals array', () => {
    expect(ProviderAnalysisOutputSchema.safeParse({}).success).toBe(false);
    expect(ProviderAnalysisOutputSchema.safeParse({ signals: 'none' }).success).toBe(false);
    expect(ProviderAnalysisOutputSchema.safeParse('not json at all').success).toBe(false);
  });

  it('lets the loose envelope carry malformed signals through for individual parsing', () => {
    // why: the analyzer parses signals one at a time, so one bad signal does
    // not discard the good ones beside it.
    const mixed = { signals: [VALID_SIGNAL, { category: 'NONSENSE' }] };
    expect(ProviderAnalysisOutputSchema.safeParse(mixed).success).toBe(true);
    expect(RawAnalysisResultSchema.safeParse(mixed).success).toBe(false);
  });
});

describe('chat schema', () => {
  it('accepts an answer with citations', () => {
    const result = RawChatResultSchema.safeParse({
      answer: 'Two decisions are recorded as pending.',
      citedSourceIds: ['P001-D001'],
    });
    expect(result.success).toBe(true);
  });

  it('defaults citedSourceIds to an empty array when omitted', () => {
    const result = RawChatResultSchema.safeParse({ answer: 'The records do not cover this.' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.citedSourceIds).toEqual([]);
  });

  it('rejects an empty answer', () => {
    expect(RawChatResultSchema.safeParse({ answer: '', citedSourceIds: [] }).success).toBe(false);
  });
});

describe('API request schemas', () => {
  it('accepts a valid analyze request and rejects a missing project id', () => {
    expect(AnalyzeRequestSchema.safeParse({ projectId: 'P001' }).success).toBe(true);
    expect(AnalyzeRequestSchema.safeParse({}).success).toBe(false);
    expect(AnalyzeRequestSchema.safeParse({ projectId: '' }).success).toBe(false);
  });

  it('requires at least one message on a chat request', () => {
    expect(
      ChatRequestSchema.safeParse({ projectId: 'P001', messages: [{ role: 'user', content: 'Hi' }] })
        .success,
    ).toBe(true);
    expect(ChatRequestSchema.safeParse({ projectId: 'P001', messages: [] }).success).toBe(false);
  });

  it('accepts only the four review statuses', () => {
    for (const status of ['NEW', 'CONFIRMED', 'DISMISSED', 'INVESTIGATE']) {
      expect(ReviewRequestSchema.safeParse({ signalId: 'P001-abcd1234', status }).success).toBe(true);
    }
    expect(
      ReviewRequestSchema.safeParse({ signalId: 'P001-abcd1234', status: 'ESCALATED' }).success,
    ).toBe(false);
  });

  it('defaults an omitted review note to an empty string', () => {
    const result = ReviewRequestSchema.safeParse({ signalId: 'P001-abcd1234', status: 'CONFIRMED' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBe('');
  });
});
