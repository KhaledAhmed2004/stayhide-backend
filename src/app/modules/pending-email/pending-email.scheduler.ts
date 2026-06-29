/**
 * PendingEmail worker.
 *
 * Mirrors `AccountPurgeScheduler` — static class, optional node-cron
 * with `setInterval` fallback, `isRunning` spinlock, started in
 * `server.ts` after MongoDB is connected.
 *
 * Cadence: every minute (G6 — 5-field cron matches the existing
 * scheduler shape; safer than 6-field syntax which not all node-cron
 * forks support). Ticks reclaim expired leases first, then drain
 * `nextAttemptAt <= now` rows in a batch.
 *
 * Worker identity: `crypto.randomUUID()` once at start (G3), stamped
 * on every PROCESSING claim. Makes `grep workerId=<uuid>` trivial when
 * triaging "which worker grabbed which row".
 */

import crypto from 'crypto';
import { emailRetryConfig } from '../../../config/emailRetry.config';
import { errorLogger, logger } from '../../../shared/logger';
import {
  processBatch,
  reclaimExpiredLeases,
} from './pending-email.service';

let cron: any = null;
try {
  cron = require('node-cron');
} catch {
  // node-cron not installed; fall back to setInterval
}

export class PendingEmailScheduler {
  private static cronJob: any = null;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static workerId: string = '';

  static start(): void {
    if (this.cronJob || this.intervalId) {
      logger.warn('PendingEmailScheduler already started');
      return;
    }

    this.workerId = `pe-${crypto.randomUUID()}`;

    if (cron) {
      this.cronJob = cron.schedule(
        emailRetryConfig.cronExpression,
        async () => {
          await this.runOnce();
        },
      );
      logger.info(
        `PendingEmailScheduler started (node-cron ${emailRetryConfig.cronExpression}, workerId=${this.workerId})`,
      );
    } else {
      this.intervalId = setInterval(async () => {
        await this.runOnce();
      }, emailRetryConfig.intervalMs);
      logger.info(
        `PendingEmailScheduler started (setInterval ${emailRetryConfig.intervalMs}ms, workerId=${this.workerId})`,
      );
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
    logger.info('PendingEmailScheduler stopped');
  }

  /**
   * One tick. Reclaims expired leases, then processes a batch.
   * Exposed so tests / admin tooling can trigger on demand.
   */
  static async runOnce(): Promise<{
    reclaimed: number;
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (this.isRunning) {
      logger.warn(
        'PendingEmailScheduler.runOnce called while already running; skipping',
      );
      return { reclaimed: 0, processed: 0, succeeded: 0, failed: 0 };
    }
    this.isRunning = true;

    try {
      const reclaimed = await reclaimExpiredLeases();
      if (reclaimed > 0) {
        logger.info(
          `PendingEmailScheduler: reclaimed ${reclaimed} expired lease(s)`,
        );
      }
      const summary = await processBatch(this.workerId);
      if (summary.processed > 0) {
        logger.info(
          `PendingEmailScheduler: workerId=${this.workerId} processed=${summary.processed} succeeded=${summary.succeeded} failed=${summary.failed}`,
        );
      }
      return { reclaimed, ...summary };
    } catch (err) {
      errorLogger.error('PendingEmailScheduler tick error', err);
      return { reclaimed: 0, processed: 0, succeeded: 0, failed: 0 };
    } finally {
      this.isRunning = false;
    }
  }
}

export default PendingEmailScheduler;
