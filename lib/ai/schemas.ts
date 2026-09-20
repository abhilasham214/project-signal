/**
 * Schemas and types for AI output.
 *
 * The most important thing in this file is the distinction between two words:
 *
 *   Raw*        — came out of a language model. Untrusted. May cite records
 *                 that do not exist. Must never be rendered to a human.
 *   Validated*  — has been through Zod parsing AND evidence validation. Every
 *                 citation has been resolved against the selected project.
 *                 Safe to render.
 *
 * If you are reading this at 3am wondering whether some value can be trusted,
 * the type name is the answer. Nothing converts Raw to Validated except
 * `lib/validation/evidence.ts`.
 */

import { z } from 'zod';
import { SOURCE_TYPES } from '@/lib/projects/record-kinds';

/** Why a signal was surfaced. Fixed vocabulary, per the product specification. */
export const SIGNAL_CATEGORIES = [
  'DEPENDENCY',
  'REPEATED_ISSUE',
  'UNRESOLVED_DECISION',
  'CHANGE',
  'SCHEDULE_WARNING',
  'MISSING_INFORMATION',
  'INCONSISTENCY',
] as const;

/** How much attention the signal may warrant. Not a prediction of impact. */
export const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

/** How well the supplied records support the signal. */
export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

/** Where a signal stands in human review. Only a human may move it off NEW. */
export const REVIEW_STATUSES = ['NEW', 'CONFIRMED', 'DISMISSED', 'INVESTIGATE'] as const;

export const SignalCategorySchema = z.enum(SIGNAL_CATEGORIES);
export const SeveritySchema = z.enum(SEVERITY_LEVELS);
export const ConfidenceSchema = z.enum(CONFIDENCE_LEVELS);
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);

export type SignalCategory = z.infer<typeof SignalCategorySchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

/**
 * One citation as the model supplied it: a claim that a record exists.
 *
 * Deliberately carries no record text. why: the model must not be the source
 * of the evidence a human reads. It names a record; the server fetches the
 * real content. See `lib/validation/evidence.ts`.
 */
export const RawEvidenceSchema = z.object({
  sourceType: z.enum(SOURCE_TYPES as unknown as [string, ...string[]]),
  sourceId: z.string().min(1),
});

export type RawEvidence = z.infer<typeof RawEvidenceSchema>;

/**
 * One signal exactly as a model may return it.
 *
 * `evidence` requires at least one citation at the schema level, enforcing
 * NO EVIDENCE = NO SIGNAL before anything else runs. A model that returns a
 * signal with an empty evidence array has its signal rejected here.
 */
export const RawSignalSchema = z.object({
  category: SignalCategorySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  reason: z.string().min(1).max(2000),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  recommendedReview: z.string().min(1).max(1000),
  evidence: z.array(RawEvidenceSchema).min(1),
});

export type RawSignal = z.infer<typeof RawSignalSchema>;

/**
 * A complete analysis response from a provider, before validation.
 *
 * An empty `signals` array is valid and meaningful: it means the model found
 * nothing it could support with evidence. That is a legitimate outcome, not
 * an error, and the UI says so in words.
 */
export const RawAnalysisResultSchema = z.object({
  signals: z.array(RawSignalSchema),
});

export type RawAnalysisResult = z.infer<typeof RawAnalysisResultSchema>;

/**
 * The envelope a provider must return, with its signals left unexamined.
 *
 * why loose: signals are parsed ONE AT A TIME in `lib/ai/analyzer.ts`. If the
 * whole array were parsed strictly here, a single malformed signal would throw
 * away every good signal alongside it. Validating individually means a bad
 * signal is discarded and reported while the rest survive.
 */
export const ProviderAnalysisOutputSchema = z.object({
  signals: z.array(z.unknown()),
});

export type ProviderAnalysisOutput = z.infer<typeof ProviderAnalysisOutputSchema>;

/** A citation that resolved to a real record in the selected project. */
export interface ValidatedEvidence {
  sourceType: string;
  sourceId: string;
  /** Label of the record kind, e.g. "Site report". */
  kindLabel: string;
  /** Headline of the resolved record, read from the dataset. */
  title: string;
  /** The record's actual content, read from the dataset — never from the model. */
  content: string;
  date: string | null;
  participants: string[];
}

/** A citation that did not resolve, kept so the rejection can be shown. */
export interface RejectedEvidence {
  sourceType: string;
  sourceId: string;
  reason: 'UNKNOWN_SOURCE_TYPE' | 'RECORD_NOT_IN_PROJECT';
}

/**
 * A signal that survived Zod parsing and evidence validation.
 *
 * `id` and `status` are minted by the server, never by the model. why: the
 * model must not be able to choose a signal's identity (which would let it
 * overwrite an existing human review) or its review status (which is the
 * human's decision alone).
 */
export interface ValidatedSignal {
  id: string;
  projectId: string;
  category: SignalCategory;
  title: string;
  description: string;
  reason: string;
  severity: Severity;
  confidence: Confidence;
  recommendedReview: string;
  evidence: ValidatedEvidence[];
  /** Citations that failed validation. Shown for transparency, never as proof. */
  rejectedEvidence: RejectedEvidence[];
  status: ReviewStatus;
}

/** Why a whole signal was thrown away during validation. */
export interface DiscardedSignal {
  title: string;
  category: string;
  reason: 'SCHEMA_INVALID' | 'NO_VALID_EVIDENCE';
  detail: string;
}

/**
 * The outcome of one analysis run, including what was rejected.
 *
 * Rejections are part of the result rather than a silent side effect. why:
 * "the model cited three records that do not exist" is exactly the kind of
 * thing a reviewer of this prototype needs to be able to see.
 */
export interface AnalysisRun {
  projectId: string;
  analyzedAt: string;
  provider: 'mock' | 'gemini';
  signals: ValidatedSignal[];
  discarded: DiscardedSignal[];
}

/** A human's decision on one signal. The AI can never write this. */
export interface HumanReview {
  signalId: string;
  status: ReviewStatus;
  note: string;
  reviewedAt: string;
}

/** One turn of the project chat. */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** A chat answer as returned by a provider, before any trimming. */
export const RawChatResultSchema = z.object({
  answer: z.string().min(1),
  /** Record ids the answer refers to. Resolved server-side like signal evidence. */
  citedSourceIds: z.array(z.string()).default([]),
});

export type RawChatResult = z.infer<typeof RawChatResultSchema>;

/** A chat answer whose citations have been checked against the project. */
export interface ValidatedChatResult {
  answer: string;
  citations: ValidatedEvidence[];
}

/** Request body accepted by `POST /api/analyze`. */
export const AnalyzeRequestSchema = z.object({
  projectId: z.string().min(1).max(32),
});

/** Request body accepted by `POST /api/chat`. */
export const ChatRequestSchema = z.object({
  projectId: z.string().min(1).max(32),
  messages: z.array(ChatMessageSchema).min(1).max(40),
});

/** Request body accepted by `POST /api/review`. */
export const ReviewRequestSchema = z.object({
  signalId: z.string().min(1).max(64),
  status: ReviewStatusSchema,
  note: z.string().max(2000).default(''),
});
