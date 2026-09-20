/**
 * Evidence validation — the trust boundary of the application.
 *
 * A language model may cite source ids that do not exist, or that belong to a
 * different project, or that are real ids filed under the wrong record type.
 * All three are hallucinations and all three must be stopped here, before
 * anything reaches a human reader.
 *
 * Two rules are enforced, and neither may be relaxed:
 *
 *   1. Evidence text is NEVER taken from the model. The model supplies an id;
 *      this module looks that id up in the dataset and returns the real record
 *      content. Where the model description of a record disagrees with the
 *      record, the record wins.
 *
 *   2. NO EVIDENCE = NO SIGNAL. A signal whose every citation is rejected is
 *      discarded entirely, not shown with an empty evidence list. A signal
 *      with no proof is indistinguishable from an invented one, and showing it
 *      would defeat the purpose of the product.
 *
 * If you are here at 3am because a signal "should be showing but is missing",
 * the likely answer is that its citations did not resolve. Check the analysis
 * run `discarded` array — the reason is recorded there, never swallowed.
 */

import { findRecordOfType, getRecordKind, toDisplayableRecord } from '@/lib/projects';
import { mintSignalId } from '@/lib/signals/ids';
import type {
  DiscardedSignal,
  RawEvidence,
  RawSignal,
  RejectedEvidence,
  ValidatedEvidence,
  ValidatedSignal,
} from '@/lib/ai/schemas';
import type { Project } from '@/lib/types/project';

/**
 * Source types tried when resolving a bare chat citation.
 *
 * The chat prompt asks for plain record ids rather than typed citations, so
 * the kind has to be discovered by trying each one.
 */
const SOURCE_TYPES_FOR_CHAT = [
  'meeting',
  'siteReport',
  'issue',
  'decision',
  'change',
  'dependency',
  'contractorUpdate',
  'consultantUpdate',
] as const;

/** The result of checking one citation. */
type EvidenceCheck =
  | { accepted: true; evidence: ValidatedEvidence }
  | { accepted: false; rejection: RejectedEvidence };

/**
 * Resolves one citation against one project.
 *
 * Lookup is scoped to the project passed in. An id belonging to a different
 * project therefore cannot resolve, because that other project records are
 * never searched. The isolation is structural, not a string comparison that
 * could be got wrong.
 *
 * @returns an acceptance carrying the real record content, or a rejection
 *          carrying the reason. Never throws.
 */
export function validateSingleEvidence(project: Project, citation: RawEvidence): EvidenceCheck {
  const kind = getRecordKind(citation.sourceType);
  if (!kind) {
    // why: the model named a record type that does not exist in this system.
    return {
      accepted: false,
      rejection: {
        sourceType: citation.sourceType,
        sourceId: citation.sourceId,
        reason: 'UNKNOWN_SOURCE_TYPE',
      },
    };
  }

  const found = findRecordOfType(project, citation.sourceId, citation.sourceType);
  if (!found) {
    // why one reason covers three cases: the id was invented, the id belongs
    // to another project, or the id is real but filed under a different record
    // type than the one claimed. From this project point of view all three are
    // the same fact — there is no such record here.
    return {
      accepted: false,
      rejection: {
        sourceType: citation.sourceType,
        sourceId: citation.sourceId,
        reason: 'RECORD_NOT_IN_PROJECT',
      },
    };
  }

  const displayable = toDisplayableRecord(found.kind, found.record);
  return {
    accepted: true,
    evidence: {
      sourceType: displayable.sourceType,
      sourceId: displayable.id,
      kindLabel: displayable.kindLabel,
      title: displayable.title,
      // The record own words, read from the dataset — never from the model.
      content: displayable.body,
      date: displayable.date,
      participants: displayable.participants,
    },
  };
}

/** Outcome of validating one signal: either it survives, or it is discarded. */
export type SignalValidation =
  | { kept: true; signal: ValidatedSignal }
  | { kept: false; discarded: DiscardedSignal };

/**
 * Validates the evidence of one raw signal and, if any survives, promotes it.
 *
 * Duplicate citations are collapsed, so a model cannot inflate apparent
 * support by citing the same record several times.
 *
 * @param project the selected project, and the only place ids are looked up
 * @param rawSignal a signal that has already passed Zod parsing
 * @returns the promoted `ValidatedSignal`, or a `DiscardedSignal` explaining
 *          why nothing survived. Never throws.
 */
export function validateSignalEvidence(project: Project, rawSignal: RawSignal): SignalValidation {
  const accepted: ValidatedEvidence[] = [];
  const rejected: RejectedEvidence[] = [];
  const seenSourceIds = new Set<string>();

  for (const citation of rawSignal.evidence) {
    const check = validateSingleEvidence(project, citation);
    if (!check.accepted) {
      rejected.push(check.rejection);
      continue;
    }
    if (seenSourceIds.has(check.evidence.sourceId)) continue;
    seenSourceIds.add(check.evidence.sourceId);
    accepted.push(check.evidence);
  }

  if (accepted.length === 0) {
    // why discard rather than display: see rule 2 in the module header.
    return {
      kept: false,
      discarded: {
        title: rawSignal.title,
        category: rawSignal.category,
        reason: 'NO_VALID_EVIDENCE',
        detail:
          rejected.length > 0
            ? `All ${rejected.length} cited record(s) could not be verified against this project: ${rejected
                .map((rejection) => rejection.sourceId)
                .join(', ')}`
            : 'The signal cited no records.',
      },
    };
  }

  return {
    kept: true,
    signal: {
      id: mintSignalId(
        project.id,
        rawSignal.category,
        accepted.map((evidence) => evidence.sourceId),
      ),
      projectId: project.id,
      category: rawSignal.category,
      title: rawSignal.title,
      description: rawSignal.description,
      reason: rawSignal.reason,
      severity: rawSignal.severity,
      confidence: rawSignal.confidence,
      recommendedReview: rawSignal.recommendedReview,
      evidence: accepted,
      rejectedEvidence: rejected,
      // Every signal starts unreviewed. Only a human moves it off NEW.
      status: 'NEW',
    },
  };
}

/**
 * Validates a whole batch of raw signals against one project.
 *
 * Signals that mint the same id are collapsed, keeping the first. why: two
 * near-identical signals resting on the same records are one finding, and
 * listing both would overstate how much the records support it.
 *
 * @returns the surviving signals and a record of everything discarded, so the
 *          caller can report rejections rather than hide them.
 */
export function validateSignals(
  project: Project,
  rawSignals: readonly RawSignal[],
): { signals: ValidatedSignal[]; discarded: DiscardedSignal[] } {
  const signals: ValidatedSignal[] = [];
  const discarded: DiscardedSignal[] = [];
  const seenSignalIds = new Set<string>();

  for (const rawSignal of rawSignals) {
    const outcome = validateSignalEvidence(project, rawSignal);
    if (!outcome.kept) {
      discarded.push(outcome.discarded);
      continue;
    }
    if (seenSignalIds.has(outcome.signal.id)) continue;
    seenSignalIds.add(outcome.signal.id);
    signals.push(outcome.signal);
  }

  return { signals, discarded };
}

/**
 * Resolves the record ids a chat answer claimed to use.
 *
 * Unlike signal evidence, an unresolvable chat citation does not invalidate
 * the answer — it is simply not offered as a source. why: a chat answer is
 * prose read in context, not a finding presented as verified, and discarding a
 * useful answer over one bad id would serve the user worse than showing the
 * answer alongside the sources that did check out.
 *
 * @returns the citations that resolved, in the order supplied, deduplicated.
 */
export function validateChatCitations(
  project: Project,
  citedSourceIds: readonly string[],
): ValidatedEvidence[] {
  const resolved: ValidatedEvidence[] = [];
  const seenSourceIds = new Set<string>();

  for (const sourceId of citedSourceIds) {
    if (seenSourceIds.has(sourceId)) continue;

    for (const sourceType of SOURCE_TYPES_FOR_CHAT) {
      const check = validateSingleEvidence(project, { sourceType, sourceId });
      if (check.accepted) {
        seenSourceIds.add(sourceId);
        resolved.push(check.evidence);
        break;
      }
    }
  }

  return resolved;
}
