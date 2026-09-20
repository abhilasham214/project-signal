/**
 * Runtime store for analysis runs and human review decisions.
 *
 * The rules live here; where the bytes live is a `StoreBackend` (see
 * `backend.ts`): a JSON file locally, Upstash Redis on Vercel. It is a
 * prototype persistence layer, not a production database — see the limitations
 * section of the README.
 *
 * Two invariants live here:
 *
 *   1. Reviews are stored separately from runs, keyed by signal id. Re-running
 *      an analysis replaces the run but never the reviews, so a human decision
 *      survives a re-analysis that re-discovers the same signal.
 *
 *   2. Only `saveReview` writes a review, and nothing in `lib/ai` may call it.
 */

import type { AnalysisRun, HumanReview, ReviewStatus, ValidatedSignal } from '@/lib/ai/schemas';
import { selectBackend, type StoreShape } from './backend';

/** Reads everything from whichever backend this instance is using. */
async function readStore(): Promise<StoreShape> {
  return (await selectBackend()).readAll();
}

/**
 * Overlays saved human reviews onto a run signals.
 *
 * The status and note on a stored signal are display state; the review file is
 * the source of truth. Applying the overlay on read means a review made before
 * a re-analysis still shows afterwards.
 */
function applyReviews(signals: ValidatedSignal[], reviews: Record<string, HumanReview>): ValidatedSignal[] {
  return signals.map((signal) => {
    const review = reviews[signal.id];
    return review ? { ...signal, status: review.status } : signal;
  });
}

/**
 * Saves the latest analysis run for a project, replacing any previous run.
 *
 * @returns the run as it will be read back, with existing human reviews
 *          already applied, so the caller can render it without a second read.
 */
export async function saveRun(run: AnalysisRun): Promise<AnalysisRun> {
  const backend = await selectBackend();
  await backend.writeRun(run);
  // why re-read reviews: they are the source of truth, and may have been
  // written by another instance since this one last looked.
  const { reviews } = await backend.readAll();
  return { ...run, signals: applyReviews(run.signals, reviews) };
}

/**
 * Fetches the most recent analysis run for a project.
 *
 * @returns the run with human reviews applied, or `null` when the project has
 *          never been analysed. `null` is the normal pre-analysis state, not
 *          an error.
 */
export async function getRun(projectId: string): Promise<AnalysisRun | null> {
  const store = await readStore();
  const run = store.runs[projectId];
  if (!run) return null;
  return { ...run, signals: applyReviews(run.signals, store.reviews) };
}

/**
 * Finds one signal by id across every saved run.
 *
 * @returns the signal with its human review applied, plus any saved review, or
 *          `null` when no run contains that id — which is what a stale or
 *          hand-typed signal URL produces, and becomes a 404.
 */
export async function getSignal(
  signalId: string,
): Promise<{ signal: ValidatedSignal; review: HumanReview | null } | null> {
  const store = await readStore();

  for (const run of Object.values(store.runs)) {
    const found = run.signals.find((signal) => signal.id === signalId);
    if (!found) continue;

    const review = store.reviews[signalId] ?? null;
    return {
      signal: review ? { ...found, status: review.status } : found,
      review,
    };
  }

  return null;
}

/**
 * Records a human decision on a signal.
 *
 * This is the only function in the codebase that sets a review status, and
 * nothing in `lib/ai` may call it. why: the review status is the human
 * contribution to the workflow. If an AI code path could write it, the product
 * claim that the human decides would be false.
 *
 * @param signalId the signal being reviewed
 * @param status the decision
 * @param note the reviewer own words, stored verbatim
 * @returns the saved review
 */
export async function saveReview(
  signalId: string,
  status: ReviewStatus,
  note: string,
): Promise<HumanReview> {
  const review: HumanReview = {
    signalId,
    status,
    note,
    reviewedAt: new Date().toISOString(),
  };
  await (await selectBackend()).writeReview(review);
  return review;
}

/** Fetches the saved review for a signal, or `null` if it has not been reviewed. */
export async function getReview(signalId: string): Promise<HumanReview | null> {
  const store = await readStore();
  return store.reviews[signalId] ?? null;
}

/** Every saved review, used by the evaluation page to count human confirmations. */
export async function listReviews(): Promise<HumanReview[]> {
  const store = await readStore();
  return Object.values(store.reviews);
}

/** Every saved run, used by the evaluation page. */
export async function listRuns(): Promise<AnalysisRun[]> {
  const store = await readStore();
  return Object.values(store.runs).map((run) => ({
    ...run,
    signals: applyReviews(run.signals, store.reviews),
  }));
}
