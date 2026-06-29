/**
 * Safe async file unlink with retry tracking.
 *
 * The stored value on a User document can be one of:
 *   - An absolute URL produced by fileHandler, e.g.
 *       `http://localhost:5000/uploads/users/profiles/2026-pic.jpg`
 *   - A relative path like `uploads/users/profiles/2026-pic.jpg`
 *     (some older / migrated rows)
 *   - The self-hosted default `/default-avatar.svg`
 *   - An external URL (legacy `https://i.ibb.co/...` rows)
 *
 * Only paths that resolve to files under the local `uploads/` directory
 * are deleted. External URLs and the system default are skipped.
 *
 * Failures (permission, file busy) are queued for retry by the
 * companion orphan-cleanup cron at `src/shared/orphanFileCleaner.ts`.
 */
import fs from 'fs/promises';
import path from 'path';
import { errorLogger, logger } from './logger';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const failedUnlinks = new Map<string, number>(); // absolutePath -> attempt count
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Resolve a stored file reference to an absolute path on disk, or null
 * if the reference points outside the local uploads tree (external URL,
 * system default).
 */
const resolveStoredPath = (stored: string): string | null => {
  if (!stored) return null;

  // System default SVG — never delete.
  if (stored === '/default-avatar.svg') return null;

  // External URLs (legacy i.ibb.co rows, third-party CDN).
  // Match http:// or https:// hosts whose URL does NOT contain /uploads/.
  if (/^https?:\/\//i.test(stored) && !/\/uploads\//i.test(stored)) {
    return null;
  }

  // Extract the `uploads/...` suffix from either an absolute URL or a
  // relative path. Match the LAST occurrence to be safe.
  const idx = stored.lastIndexOf('uploads/');
  const relative =
    idx >= 0 ? stored.slice(idx + 'uploads/'.length) : stored.replace(/^\/+/, '');

  const absolute = path.resolve(UPLOADS_DIR, relative);

  // Path-traversal guard — refuse to delete anything outside the
  // uploads tree even if the stored value contains `..` sequences.
  if (!absolute.startsWith(UPLOADS_DIR + path.sep) && absolute !== UPLOADS_DIR) {
    errorLogger.error(
      `unlinkFile: refusing path-traversal-suspect '${stored}' -> '${absolute}'`,
    );
    return null;
  }

  return absolute;
};

const unlinkFile = async (stored: string): Promise<void> => {
  const absolute = resolveStoredPath(stored);
  if (!absolute) return;

  try {
    await fs.unlink(absolute);
    failedUnlinks.delete(absolute);
    logger.debug?.(`unlinkFile: removed ${absolute}`);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      // Already gone — that's a successful end state.
      failedUnlinks.delete(absolute);
      return;
    }

    const attempts = (failedUnlinks.get(absolute) ?? 0) + 1;
    if (attempts >= MAX_RETRY_ATTEMPTS) {
      failedUnlinks.delete(absolute);
      errorLogger.error(
        `unlinkFile: giving up after ${attempts} attempts on ${absolute}: ${err?.message}. Orphan cron will catch it.`,
      );
    } else {
      failedUnlinks.set(absolute, attempts);
      logger.warn(
        `unlinkFile: attempt ${attempts}/${MAX_RETRY_ATTEMPTS} failed on ${absolute}: ${err?.message}`,
      );
    }
  }
};

/**
 * Retry all queued unlinks. Called by the orphan-cleanup cron before
 * its sweep so transient-failure paths get one more shot before being
 * treated as true orphans.
 */
export const retryPendingUnlinks = async (): Promise<{
  retried: number;
  succeeded: number;
}> => {
  const targets = Array.from(failedUnlinks.keys());
  let succeeded = 0;
  for (const absolute of targets) {
    try {
      await fs.unlink(absolute);
      failedUnlinks.delete(absolute);
      succeeded++;
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        failedUnlinks.delete(absolute);
        succeeded++;
      }
      // else leave in the queue for the next pass / orphan cron
    }
  }
  return { retried: targets.length, succeeded };
};

export default unlinkFile;
