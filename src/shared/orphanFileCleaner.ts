/**
 * Orphan-File Cleanup Scheduler
 *
 * Sweeps `uploads/users/{profiles,verifications,videos}` daily and
 * removes any file that:
 *   1. is older than 24 h (grace period for in-flight uploads), AND
 *   2. is not referenced by any User document's
 *      `profileImage`, `verificationImage`, or `verificationVideo`.
 *
 * Why: every profile-image / verification swap is supposed to unlink
 * the previous file. `unlinkFile` retries best-effort, but transient
 * failures (permission, file busy) used to leak forever. This cron is
 * the safety net.
 *
 * Also calls `retryPendingUnlinks()` first, so any unlinks queued by
 * `unlinkFile` get a final chance before the orphan sweep treats them
 * as truly orphaned.
 *
 * Cadence: daily at 03:30 UTC (just after AccountPurgeScheduler at
 * 03:00). Falls back to a 24h setInterval if node-cron is not
 * installed.
 *
 * @usage
 * // In server.ts, after MongoDB connection
 * import { OrphanFileCleaner } from '@/shared/orphanFileCleaner';
 * OrphanFileCleaner.start();
 */
import fs from 'fs/promises';
import path from 'path';
import { errorLogger, logger } from './logger';
import { User } from '../app/modules/user/user.model';
import { retryPendingUnlinks } from './unlinkFile';

let cron: any = null;
try {
  cron = require('node-cron');
} catch {
  // node-cron not installed; fall back to setInterval
}

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const USER_FILE_SUBFOLDERS = [
  'users/profiles',
  'users/verifications',
  'users/videos',
];

interface CleanResult {
  scanned: number;
  deleted: number;
  failures: number;
}

export class OrphanFileCleaner {
  private static cronJob: any = null;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static start(): void {
    if (this.cronJob || this.intervalId) {
      logger.warn('OrphanFileCleaner already started');
      return;
    }

    if (cron) {
      // 03:30 UTC daily — just after AccountPurgeScheduler at 03:00,
      // so any cascade unlinks from that sweep are in the failed-queue
      // before we run.
      this.cronJob = cron.schedule(
        '30 3 * * *',
        async () => {
          await this.runOnce();
        },
        { timezone: 'UTC' },
      );
      logger.info('OrphanFileCleaner started (node-cron, 03:30 UTC daily)');
    } else {
      this.intervalId = setInterval(async () => {
        await this.runOnce();
      }, DAY_MS);
      logger.info('OrphanFileCleaner started (setInterval, 24h)');
    }
  }

  static stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('OrphanFileCleaner stopped');
  }

  /**
   * Run one sweep. Exposed for testing / on-demand admin tooling.
   */
  static async runOnce(): Promise<CleanResult> {
    if (this.isRunning) {
      logger.warn('OrphanFileCleaner.runOnce called while already running; skipping');
      return { scanned: 0, deleted: 0, failures: 0 };
    }
    this.isRunning = true;

    const summary: CleanResult = { scanned: 0, deleted: 0, failures: 0 };

    try {
      // First: retry anything queued by unlinkFile.
      const retryResult = await retryPendingUnlinks();
      if (retryResult.retried > 0) {
        logger.info(
          `OrphanFileCleaner: retried ${retryResult.retried} queued unlinks, ${retryResult.succeeded} succeeded`,
        );
      }

      // Build the reference set: every file path stored on any user.
      const referenced = await this.collectReferencedFiles();

      const cutoff = Date.now() - GRACE_PERIOD_MS;

      for (const subfolder of USER_FILE_SUBFOLDERS) {
        const dir = path.join(UPLOADS_DIR, subfolder);
        let entries: string[];
        try {
          entries = await fs.readdir(dir);
        } catch (err: any) {
          if (err?.code === 'ENOENT') continue; // no folder = nothing to clean
          throw err;
        }

        for (const entry of entries) {
          const absolute = path.join(dir, entry);
          summary.scanned++;

          let stat;
          try {
            stat = await fs.stat(absolute);
          } catch {
            continue; // disappeared between readdir and stat
          }
          if (!stat.isFile()) continue;
          if (stat.mtimeMs > cutoff) continue; // inside grace period

          if (referenced.has(absolute)) continue;

          try {
            await fs.unlink(absolute);
            summary.deleted++;
          } catch (err: any) {
            summary.failures++;
            errorLogger.error(
              `OrphanFileCleaner: failed to unlink ${absolute}: ${err?.message}`,
            );
          }
        }
      }

      if (summary.scanned > 0) {
        logger.info(
          `OrphanFileCleaner: scanned=${summary.scanned} deleted=${summary.deleted} failures=${summary.failures}`,
        );
      }
    } catch (err) {
      errorLogger.error('OrphanFileCleaner: sweep error', err);
    } finally {
      this.isRunning = false;
    }

    return summary;
  }

  /**
   * Collect the set of absolute file paths currently referenced by
   * any User document across `profileImage`, `verificationImage`,
   * `verificationVideo`. Skips external URLs and the system default.
   */
  private static async collectReferencedFiles(): Promise<Set<string>> {
    const referenced = new Set<string>();

    const cursor = User.find({})
      .select('profileImage verificationImage verificationVideo')
      .lean()
      .cursor();

    for await (const doc of cursor) {
      for (const value of [
        (doc as any).profileImage,
        (doc as any).verificationImage,
        (doc as any).verificationVideo,
      ]) {
        const absolute = this.storedToAbsolute(value);
        if (absolute) referenced.add(absolute);
      }
    }

    return referenced;
  }

  private static storedToAbsolute(stored: unknown): string | null {
    if (typeof stored !== 'string' || !stored) return null;
    if (stored === '/default-avatar.svg') return null;
    if (/^https?:\/\//i.test(stored) && !/\/uploads\//i.test(stored)) return null;

    const idx = stored.lastIndexOf('uploads/');
    const relative =
      idx >= 0
        ? stored.slice(idx + 'uploads/'.length)
        : stored.replace(/^\/+/, '');

    const absolute = path.resolve(UPLOADS_DIR, relative);
    if (!absolute.startsWith(UPLOADS_DIR + path.sep) && absolute !== UPLOADS_DIR) {
      return null;
    }
    return absolute;
  }
}

export default OrphanFileCleaner;
