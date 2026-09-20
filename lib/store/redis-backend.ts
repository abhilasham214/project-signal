/**
 * Redis backend: Upstash Redis over HTTP, for Vercel.
 *
 * Layout: two hashes.
 *
 *   project-signal:runs     field = project id,  value = AnalysisRun
 *   project-signal:reviews  field = signal id,   value = HumanReview
 *
 * why hashes, one field per record: `HSET` touches only that field, so two
 * reviewers saving at the same moment cannot overwrite each other, and no write
 * needs to read first. Values are JSON; the client serialises them.
 *
 * Failure policy: a failed read or write is logged as `store.read_failed` /
 * `store.write_failed` and does not throw, matching the file backend. The
 * analysis itself still reaches the user. Check the log if a saved run or
 * review is missing.
 */

import { Redis } from '@upstash/redis';
import type { AnalysisRun, HumanReview } from '@/lib/ai/schemas';
import { describeError, logEvent } from '@/lib/logging/log';
import type { StoreBackend, StoreShape } from './backend';

const RUNS_KEY = 'project-signal:runs';
const REVIEWS_KEY = 'project-signal:reviews';

/** Builds the Redis backend from resolved credentials. */
export function createRedisBackend(credentials: { url: string; token: string }): StoreBackend {
  const redis = new Redis(credentials);

  return {
    name: 'redis',

    async readAll(): Promise<StoreShape> {
      try {
        const [runs, reviews] = await Promise.all([
          redis.hgetall<Record<string, AnalysisRun>>(RUNS_KEY),
          redis.hgetall<Record<string, HumanReview>>(REVIEWS_KEY),
        ]);
        // why `?? {}`: hgetall returns null for a key that does not exist yet.
        return { runs: runs ?? {}, reviews: reviews ?? {} };
      } catch (error) {
        logEvent('error', 'store.read_failed', { backend: 'redis', ...describeError(error) });
        return { runs: {}, reviews: {} };
      }
    },

    async writeRun(run: AnalysisRun): Promise<void> {
      try {
        await redis.hset(RUNS_KEY, { [run.projectId]: run });
      } catch (error) {
        logEvent('error', 'store.write_failed', {
          backend: 'redis',
          kind: 'run',
          projectId: run.projectId,
          ...describeError(error),
        });
      }
    },

    async writeReview(review: HumanReview): Promise<void> {
      try {
        await redis.hset(REVIEWS_KEY, { [review.signalId]: review });
      } catch (error) {
        logEvent('error', 'store.write_failed', {
          backend: 'redis',
          kind: 'review',
          signalId: review.signalId,
          ...describeError(error),
        });
      }
    },
  };
}
