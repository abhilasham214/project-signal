/**
 * Stable signal identity.
 *
 * A signal id is derived from what the signal IS — its project, its category
 * and the set of records it rests on — rather than from when it was generated.
 *
 * why deterministic: a human reviews a signal, then someone re-runs the
 * analysis. If ids were random, the re-run would produce a "new" signal and
 * silently discard the human decision attached to the old one. Deriving the id
 * from content means a genuinely re-discovered signal keeps its review, and a
 * genuinely different signal gets a genuinely different id.
 *
 * The model never supplies the id. It could otherwise choose an id belonging
 * to an existing reviewed signal and overwrite that review.
 */

import { createHash } from 'node:crypto';

/**
 * Mints the stable id for a signal.
 *
 * @param projectId the project the signal belongs to. Prefixed onto the id so
 *        ids stay readable and can never collide across projects.
 * @param category the signal category
 * @param evidenceIds ids of the records the signal rests on. Sorted here, so
 *        citation order coming out of the model does not change identity.
 * @returns an id of the form `P001-a1b2c3d4`
 */
export function mintSignalId(
  projectId: string,
  category: string,
  evidenceIds: readonly string[],
): string {
  const fingerprint = [category, ...[...evidenceIds].sort()].join('|');
  const digest = createHash('sha1').update(`${projectId}|${fingerprint}`).digest('hex');
  return `${projectId}-${digest.slice(0, 8)}`;
}

/**
 * Recovers the project id embedded in a signal id.
 *
 * Used by the signal detail route to know which project records to load,
 * without trusting a separate query parameter that a URL could contradict.
 *
 * @returns the project id, or `null` when the string is not shaped like a
 *          signal id. Callers turn `null` into a 404.
 */
export function projectIdFromSignalId(signalId: string): string | null {
  const separator = signalId.lastIndexOf('-');
  if (separator <= 0) return null;
  return signalId.slice(0, separator);
}
