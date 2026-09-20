/**
 * Analysis orchestration — the pipeline every signal must pass through.
 *
 * This module is the single place where model output becomes something a human
 * is allowed to see. The order of the steps is the product, not an
 * implementation detail:
 *
 *   1. Resolve the project id to exactly ONE project. An unknown id stops here.
 *   2. Ask the configured provider to analyse THAT project and nothing else.
 *   3. Parse each proposed signal individually against the Zod schema.
 *      Malformed signals are discarded and counted, never repaired.
 *   4. Validate every citation against that project. Signals with no surviving
 *      evidence are discarded.
 *   5. Persist the run, with saved human reviews re-applied.
 *
 * Nothing here writes a review status. The human decides, and only
 * `lib/store` records that decision.
 *
 * If you are debugging "why did my signal disappear", the answer is step 3 or
 * step 4, and the run `discarded` array names which.
 */

import { getProvider } from './provider';
import { RawSignalSchema, type AnalysisRun, type DiscardedSignal, type RawSignal } from './schemas';
import { UnknownProjectError } from './errors';
import { getProject } from '@/lib/projects';
import { validateSignals } from '@/lib/validation/evidence';
import { saveRun } from '@/lib/store';
import { logEvent, startTimer, type LogFields } from '@/lib/logging/log';

/**
 * Parses proposed signals one at a time.
 *
 * @returns the signals that matched the schema, and a discard entry for each
 *          one that did not. why individually: a single bad enum value in one
 *          signal must not throw away four good signals beside it.
 */
function parseSignalsIndividually(proposals: readonly unknown[]): {
  parsed: RawSignal[];
  discarded: DiscardedSignal[];
} {
  const parsed: RawSignal[] = [];
  const discarded: DiscardedSignal[] = [];

  for (const proposal of proposals) {
    const result = RawSignalSchema.safeParse(proposal);
    if (result.success) {
      parsed.push(result.data);
      continue;
    }

    // Pull whatever identifying text survives, so the discard is reportable
    // even though the object failed validation.
    const partial = (proposal ?? {}) as { title?: unknown; category?: unknown };
    discarded.push({
      title: typeof partial.title === 'string' ? partial.title : 'Untitled signal',
      category: typeof partial.category === 'string' ? partial.category : 'UNKNOWN',
      reason: 'SCHEMA_INVALID',
      detail: result.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; '),
    });
  }

  return { parsed, discarded };
}

/**
 * Runs a full analysis for one project.
 *
 * @param projectId the project to analyse
 * @param context request identifiers to attach to every log line, so a whole
 *        analysis can be followed by one `requestId`.
 * @returns the persisted run, including validated signals and every discard
 * @throws {UnknownProjectError} when the id is not in the dataset
 * @throws {AIProviderError} subclasses when the provider is misconfigured,
 *         times out, fails, or returns something unreadable. These are never
 *         converted into empty results — a failure is reported as a failure.
 */
export async function runAnalysis(projectId: string, context: LogFields = {}): Promise<AnalysisRun> {
  const elapsedMs = startTimer();
  const project = getProject(projectId);
  if (!project) {
    logEvent('warn', 'analysis.unknown_project', { ...context, projectId });
    throw new UnknownProjectError(projectId);
  }

  const provider = await getProvider();
  logEvent('info', 'analysis.started', { ...context, projectId, provider: provider.name });

  // Only `project` crosses this line. The provider has no access to the
  // dataset, so no other project can travel with it.
  const output = await provider.analyzeProject(project);

  const { parsed, discarded: schemaDiscards } = parseSignalsIndividually(output.signals);
  const { signals, discarded: evidenceDiscards } = validateSignals(project, parsed);

  const discarded = [...schemaDiscards, ...evidenceDiscards];
  if (discarded.length > 0) {
    // why counts by reason: "SCHEMA_INVALID" vs an evidence reason points at
    // different halves of the pipeline (model output shape vs bad citations).
    const discardsByReason: Record<string, number> = {};
    for (const entry of discarded) {
      discardsByReason[entry.reason] = (discardsByReason[entry.reason] ?? 0) + 1;
    }
    logEvent('warn', 'analysis.signals_discarded', {
      ...context,
      projectId,
      discardedCount: discarded.length,
      proposedCount: output.signals.length,
      discardsByReason,
      discards: discarded.map((entry) => `${entry.reason}: ${entry.title}`),
    });
  }

  const run: AnalysisRun = {
    projectId: project.id,
    analyzedAt: new Date().toISOString(),
    provider: provider.name,
    signals,
    discarded,
  };

  const saved = await saveRun(run);
  logEvent('info', 'analysis.completed', {
    ...context,
    projectId,
    provider: provider.name,
    proposedCount: output.signals.length,
    keptCount: signals.length,
    discardedCount: discarded.length,
    durationMs: elapsedMs(),
  });
  return saved;
}
