/**
 * Storage backends for analysis runs and human reviews.
 *
 * `store.ts` holds the rules (reviews outlive runs, reviews overlay signals).
 * A backend holds only the bytes: where they live. Two exist:
 *
 *   file   — `.data/store.json`. Local development and the test suite.
 *   redis  — Upstash Redis over HTTP. Used on Vercel.
 *
 * why two: the Vercel filesystem is read-only outside /tmp and not shared
 * between function instances, so a file store silently loses every run and
 * review there. Locally, a file needs no account and no network, which keeps
 * `npm run dev` and `npm test` zero-setup.
 *
 * HOW A BACKEND IS CHOSEN (see `selectBackend`)
 *   1. PROJECT_SIGNAL_DATA_DIR set  -> file. This is the test suite's switch;
 *      it guarantees tests can never touch a real Redis.
 *   2. Upstash credentials present  -> redis.
 *   3. Otherwise                    -> file.
 */

import type { AnalysisRun, HumanReview } from '@/lib/ai/schemas';
import { logEvent } from '@/lib/logging/log';

/** Everything held by a backend. */
export interface StoreShape {
  /** Latest analysis run per project id. */
  runs: Record<string, AnalysisRun>;
  /** Human decisions per signal id, independent of any run. */
  reviews: Record<string, HumanReview>;
}

/**
 * The bytes-only contract.
 *
 * Writes are per record, not whole-store. why: with a shared Redis, two people
 * saving reviews at once must not overwrite each other, which a
 * read-modify-write of the entire store would do.
 */
export interface StoreBackend {
  readonly name: 'file' | 'redis';
  /** Reads everything. Returns an empty store when nothing has been saved. */
  readAll(): Promise<StoreShape>;
  /** Saves one run, replacing that project's previous run. */
  writeRun(run: AnalysisRun): Promise<void>;
  /** Saves one review, replacing that signal's previous review. */
  writeReview(review: HumanReview): Promise<void>;
}

/**
 * The Upstash credentials, under either name set of variables that Vercel's
 * Upstash integration may create.
 *
 * @returns null when either half is missing.
 */
export function readRedisCredentials(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '').trim();
  return url !== '' && token !== '' ? { url, token } : null;
}

let cachedBackend: StoreBackend | null = null;

/**
 * Returns the backend for this server instance, creating it on first use.
 *
 * The Redis module is imported lazily so a local or test process never loads
 * it. The choice is logged once, because "which store am I actually using" is
 * the first question when data is missing after a deploy.
 */
export async function selectBackend(): Promise<StoreBackend> {
  if (cachedBackend) return cachedBackend;

  const forcedFile = (process.env.PROJECT_SIGNAL_DATA_DIR ?? '').trim() !== '';
  const credentials = forcedFile ? null : readRedisCredentials();

  if (credentials) {
    const { createRedisBackend } = await import('./redis-backend');
    cachedBackend = createRedisBackend(credentials);
  } else {
    const { createFileBackend } = await import('./file-backend');
    cachedBackend = createFileBackend();
  }

  logEvent('info', 'store.backend_selected', {
    backend: cachedBackend.name,
    reason: forcedFile
      ? 'PROJECT_SIGNAL_DATA_DIR set'
      : credentials
        ? 'redis credentials found'
        : 'no redis credentials',
    // why: on Vercel the file backend cannot persist, and this line says so.
    persistent: cachedBackend.name === 'redis',
    onVercel: process.env.VERCEL !== undefined,
  });

  return cachedBackend;
}
