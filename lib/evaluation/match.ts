/**
 * Evaluation — comparing AI output against the synthetic answer key.
 *
 * THE ANSWER KEY NEVER REACHES A MODEL. `data/evaluation.json` is imported
 * here and nowhere else. This module runs strictly after an analysis has
 * completed, reading results that are already stored. Nothing in `lib/ai`
 * imports this file, and it imports nothing from `lib/ai` except types.
 *
 * Matching is deliberately loose on wording and strict on substance. A model
 * that writes "HVAC approval is holding ceiling works" and a key that says
 * "HVAC approval is affecting downstream installation" describe the same
 * finding, so matching on text would measure phrasing rather than reasoning.
 * Instead a match requires:
 *
 *   1. the same category, AND
 *   2. at least one shared evidence record.
 *
 * Condition 2 is what makes this meaningful: it checks the signal was reached
 * by reading the same records, not that it guessed a plausible category.
 *
 * WHAT THIS IS NOT: five synthetic projects cannot measure accuracy. See
 * docs/EVALUATION.md.
 */

import evaluationJson from '@/data/evaluation.json';
import type { AnalysisRun, ValidatedSignal } from '@/lib/ai/schemas';

/** One expected signal from the answer key. */
export interface ExpectedSignal {
  category: string;
  description: string;
  keyEvidence: string[];
}

/** A topic that should NOT be surfaced, and the records showing why. */
export interface ExpectedAbsence {
  topic: string;
  reason: string;
  resolutionEvidence: string[];
}

interface EvaluationEntry {
  projectId: string;
  expectedSignals: ExpectedSignal[];
  expectedAbsences?: ExpectedAbsence[];
}

const EVALUATION_DATA = evaluationJson as unknown as { projects: EvaluationEntry[] };

/** An expected signal paired with the AI signal that matched it. */
export interface SignalMatch {
  expected: ExpectedSignal;
  actual: ValidatedSignal;
  /** Evidence ids present in both the key and the AI signal. */
  sharedEvidence: string[];
}

/** The outcome of evaluating one project. */
export interface ProjectEvaluation {
  projectId: string;
  /** False when the project has not been analysed yet. */
  analyzed: boolean;
  matches: SignalMatch[];
  /** Expected signals no AI signal matched. */
  missed: ExpectedSignal[];
  /** AI signals matching no expected signal. Candidates for review, not proven errors. */
  potentialFalsePositives: ValidatedSignal[];
  /** Topics the key says should stay absent, with whether they did. */
  absences: Array<{ absence: ExpectedAbsence; respected: boolean; surfacedBy: string[] }>;
  /** How many of this project signals a human has confirmed. */
  humanConfirmed: number;
  humanDismissed: number;
  humanInvestigating: number;
}

/** Returns the evidence ids an AI signal actually rests on. */
function evidenceIdsOf(signal: ValidatedSignal): string[] {
  return signal.evidence.map((evidence) => evidence.sourceId);
}

/**
 * Decides whether one AI signal matches one expected signal.
 *
 * @returns the shared evidence ids when the categories agree and at least one
 *          record is common to both; `null` otherwise.
 */
function matchStrength(expected: ExpectedSignal, actual: ValidatedSignal): string[] | null {
  if (expected.category !== actual.category) return null;

  const actualIds = new Set(evidenceIdsOf(actual));
  const shared = expected.keyEvidence.filter((id) => actualIds.has(id));
  return shared.length > 0 ? shared : null;
}

/**
 * Evaluates one analysis run against the answer key for its project.
 *
 * Each AI signal can satisfy at most one expected signal, so a single broad
 * signal cannot be counted as covering three separate expectations.
 *
 * @param run the stored analysis run, or `null` when the project has not been
 *        analysed. A missing run yields every expected signal as missed, which
 *        is the honest reading of "we have not looked yet".
 */
export function evaluateProject(projectId: string, run: AnalysisRun | null): ProjectEvaluation {
  const entry = EVALUATION_DATA.projects.find((candidate) => candidate.projectId === projectId);
  const expectedSignals = entry?.expectedSignals ?? [];
  const expectedAbsences = entry?.expectedAbsences ?? [];
  const actualSignals = run?.signals ?? [];

  const matches: SignalMatch[] = [];
  const missed: ExpectedSignal[] = [];
  const claimedSignalIds = new Set<string>();

  for (const expected of expectedSignals) {
    let bestMatch: SignalMatch | null = null;

    for (const actual of actualSignals) {
      if (claimedSignalIds.has(actual.id)) continue;
      const shared = matchStrength(expected, actual);
      if (!shared) continue;
      // Prefer the signal sharing the most evidence with the key.
      if (!bestMatch || shared.length > bestMatch.sharedEvidence.length) {
        bestMatch = { expected, actual, sharedEvidence: shared };
      }
    }

    if (bestMatch) {
      claimedSignalIds.add(bestMatch.actual.id);
      matches.push(bestMatch);
    } else {
      missed.push(expected);
    }
  }

  const potentialFalsePositives = actualSignals.filter((signal) => !claimedSignalIds.has(signal.id));

  const absences = expectedAbsences.map((absence) => {
    const resolutionIds = new Set(absence.resolutionEvidence);
    const surfacedBy = actualSignals
      .filter((signal) => evidenceIdsOf(signal).some((id) => resolutionIds.has(id)))
      .map((signal) => signal.id);
    return { absence, respected: surfacedBy.length === 0, surfacedBy };
  });

  return {
    projectId,
    analyzed: run !== null,
    matches,
    missed,
    potentialFalsePositives,
    absences,
    humanConfirmed: actualSignals.filter((signal) => signal.status === 'CONFIRMED').length,
    humanDismissed: actualSignals.filter((signal) => signal.status === 'DISMISSED').length,
    humanInvestigating: actualSignals.filter((signal) => signal.status === 'INVESTIGATE').length,
  };
}

/** Totals across every project, for the evaluation page summary row. */
export interface EvaluationSummary {
  projectsAnalyzed: number;
  projectsTotal: number;
  expectedTotal: number;
  matchedTotal: number;
  missedTotal: number;
  potentialFalsePositiveTotal: number;
  absencesRespected: number;
  absencesTotal: number;
  humanConfirmed: number;
  humanDismissed: number;
  humanInvestigating: number;
}

/** Aggregates per-project evaluations into the summary row. */
export function summariseEvaluations(evaluations: readonly ProjectEvaluation[]): EvaluationSummary {
  return {
    projectsAnalyzed: evaluations.filter((evaluation) => evaluation.analyzed).length,
    projectsTotal: evaluations.length,
    expectedTotal: evaluations.reduce(
      (total, evaluation) => total + evaluation.matches.length + evaluation.missed.length,
      0,
    ),
    matchedTotal: evaluations.reduce((total, evaluation) => total + evaluation.matches.length, 0),
    missedTotal: evaluations.reduce((total, evaluation) => total + evaluation.missed.length, 0),
    potentialFalsePositiveTotal: evaluations.reduce(
      (total, evaluation) => total + evaluation.potentialFalsePositives.length,
      0,
    ),
    absencesRespected: evaluations.reduce(
      (total, evaluation) => total + evaluation.absences.filter((entry) => entry.respected).length,
      0,
    ),
    absencesTotal: evaluations.reduce((total, evaluation) => total + evaluation.absences.length, 0),
    humanConfirmed: evaluations.reduce((total, evaluation) => total + evaluation.humanConfirmed, 0),
    humanDismissed: evaluations.reduce((total, evaluation) => total + evaluation.humanDismissed, 0),
    humanInvestigating: evaluations.reduce(
      (total, evaluation) => total + evaluation.humanInvestigating,
      0,
    ),
  };
}

/** The expected-signal entry for one project, for display on the evaluation page. */
export function getExpectedSignals(projectId: string): ExpectedSignal[] {
  return EVALUATION_DATA.projects.find((entry) => entry.projectId === projectId)?.expectedSignals ?? [];
}
