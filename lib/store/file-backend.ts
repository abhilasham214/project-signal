/**
 * File backend: a single JSON file at `.data/store.json` (gitignored).
 *
 * For local development and tests. Writes are atomic — temp file, then rename —
 * so an interrupted write cannot leave half-serialised JSON that makes every
 * later read fail. It is NOT safe for concurrent writers and does not persist
 * on serverless hosts; that is what the Redis backend is for.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnalysisRun, HumanReview } from '@/lib/ai/schemas';
import { describeError, logEvent } from '@/lib/logging/log';
import type { StoreBackend, StoreShape } from './backend';

/**
 * Builds the file backend.
 *
 * The directory is overridable via PROJECT_SIGNAL_DATA_DIR. why: the test suite
 * points it at a temporary directory so running tests never reads or overwrites
 * the store a developer has been clicking around in.
 */
export function createFileBackend(): StoreBackend {
  const directory = process.env.PROJECT_SIGNAL_DATA_DIR
    ? path.resolve(process.env.PROJECT_SIGNAL_DATA_DIR)
    : path.join(process.cwd(), '.data');
  const file = path.join(directory, 'store.json');

  /**
   * Reads the file.
   *
   * @returns the parsed store, or an empty one when the file is absent or
   *          unreadable. why not throw: a missing store is the normal state on
   *          first run, and a corrupt one should degrade to "no saved analyses"
   *          rather than break every page.
   */
  async function readAll(): Promise<StoreShape> {
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<StoreShape>;
      return { runs: parsed.runs ?? {}, reviews: parsed.reviews ?? {} };
    } catch (error) {
      // why only non-ENOENT: a missing file is the normal first-run state and
      // would flood the log. Anything else (corrupt JSON, permissions) means
      // saved analyses are being silently dropped.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logEvent('warn', 'store.read_failed', { backend: 'file', storeFile: file, ...describeError(error) });
      }
      return { runs: {}, reviews: {} };
    }
  }

  /**
   * Writes the whole file atomically.
   *
   * Failures are logged and swallowed. why: losing a saved run is a degraded
   * experience, but throwing would turn a disk problem into a failed analysis
   * the user cannot see at all.
   */
  async function writeAll(store: StoreShape): Promise<void> {
    try {
      await mkdir(directory, { recursive: true });
      const temporaryFile = `${file}.${process.pid}.tmp`;
      await writeFile(temporaryFile, JSON.stringify(store, null, 2), 'utf8');
      await rename(temporaryFile, file);
    } catch (error) {
      // why the hint: serverless filesystems (Vercel) are read-only outside
      // /tmp and not shared between instances, so this fails there by design.
      logEvent('error', 'store.write_failed', {
        backend: 'file',
        storeFile: file,
        hint: 'saved runs and reviews will not persist; on Vercel configure Upstash Redis',
        ...describeError(error),
      });
    }
  }

  return {
    name: 'file',
    readAll,
    async writeRun(run: AnalysisRun) {
      const store = await readAll();
      store.runs[run.projectId] = run;
      await writeAll(store);
    },
    async writeReview(review: HumanReview) {
      const store = await readAll();
      store.reviews[review.signalId] = review;
      await writeAll(store);
    },
  };
}
