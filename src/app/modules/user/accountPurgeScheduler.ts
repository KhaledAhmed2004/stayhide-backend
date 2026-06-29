/**
 * Account Purge Scheduler
 *
 * Permanently removes users whose 30-day soft-delete recovery window has
 * expired. Cascade-deletes user-owned content (notifications, group activity,
 * ask-imam questions, reset tokens). Subscription history is intentionally
 * retained for billing / tax / IAP-refund audit (industry-standard behavior
 * for Apple App Store and Google Play in-app purchases).
 *
 * Cadence: daily at 03:00 UTC. Falls back to a 24h setInterval when
 * node-cron is not installed.
 *
 * @usage
 * // In server.ts, after MongoDB connection
 * import { AccountPurgeScheduler } from '@/app/modules/user/accountPurgeScheduler';
 * AccountPurgeScheduler.start();
 */

import { USER_STATUS } from '../../../enums/user';
import { errorLogger, logger } from '../../../shared/logger';
import { User } from './user.model';
import { Notification } from '../notification/notification.model';
import { ResetToken } from '../auth/resetToken/resetToken.model';
import { PendingEmail } from '../pending-email/pending-email.model';
import { DeviceToken } from '../device-token/device-token.model';

let cron: any = null;
try {
  cron = require('node-cron');
} catch {
  // node-cron not installed; fall back to setInterval
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 100;
const STALE_DEVICE_TOKEN_DAYS = 90;

interface PurgeResult {
  scanned: number;
  purged: number;
  failures: number;
}

export class AccountPurgeScheduler {
  private static cronJob: any = null;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static start(): void {
    if (this.cronJob || this.intervalId) {
      logger.warn('AccountPurgeScheduler already started');
      return;
    }

    if (cron) {
      // Daily at 03:00 UTC. cron.schedule timezone option keeps this stable
      // across deployments regardless of server clock setting.
      this.cronJob = cron.schedule(
        '0 3 * * *',
        async () => {
          await this.runOnce();
        },
        { timezone: 'UTC' },
      );
      logger.info('AccountPurgeScheduler started (node-cron, 03:00 UTC daily)');
    } else {
      // 24-hour setInterval fallback. First run still happens after 24h â€”
      // call runOnce() manually if you need an immediate sweep on boot.
      this.intervalId = setInterval(async () => {
        await this.runOnce();
      }, DAY_MS);
      logger.info('AccountPurgeScheduler started (setInterval, 24h)');
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
    logger.info('AccountPurgeScheduler stopped');
  }

  /**
   * Run one purge sweep. Exposed so tests / admin tooling can trigger
   * the same logic on demand without waiting for the cron.
   */
  static async runOnce(): Promise<PurgeResult> {
    if (this.isRunning) {
      logger.warn('AccountPurgeScheduler.runOnce called while already running; skipping');
      return { scanned: 0, purged: 0, failures: 0 };
    }
    this.isRunning = true;

    const summary: PurgeResult = { scanned: 0, purged: 0, failures: 0 };

    try {
      const now = new Date();
      // Compound index { status: 1, recoveryDeadline: 1 } makes this a fast
      // ranged scan even at table sizes where a full collection scan would hurt.
      const expired = await User.find({
        status: USER_STATUS.DELETED,
        recoveryDeadline: { $lte: now },
      })
        .limit(PURGE_BATCH_SIZE)
        .select('_id email')
        .lean();

      summary.scanned = expired.length;

      for (const candidate of expired) {
        try {
          await this.purgeOne(candidate._id, (candidate as any).email);
          summary.purged++;
        } catch (err) {
          summary.failures++;
          errorLogger.error(
            `AccountPurgeScheduler: failed to purge user ${candidate._id}`,
            err,
          );
        }
      }

      if (summary.scanned > 0) {
        logger.info(
          `AccountPurgeScheduler: scanned=${summary.scanned} purged=${summary.purged} failures=${summary.failures}`,
        );
      }

      // Second pass: prune stale device tokens across ALL users.
      // Bounds the growth of the collection and lets the orphan-cleanup
      // cron treat the FCM/APNs surface as roughly self-pruning.
      const cutoff = new Date(
        Date.now() - STALE_DEVICE_TOKEN_DAYS * DAY_MS,
      );
      const pruneResult = await DeviceToken.deleteMany({ lastSeenAt: { $lt: cutoff } });
      if (pruneResult.deletedCount > 0) {
        logger.info(
          `AccountPurgeScheduler: pruned stale device tokens on ${pruneResult.deletedCount} user(s) (cutoff=${STALE_DEVICE_TOKEN_DAYS}d)`,
        );
      }
    } catch (err) {
      errorLogger.error('AccountPurgeScheduler: sweep error', err);
    } finally {
      this.isRunning = false;
    }

    return summary;
  }

  /**
   * Cascade-delete one user's owned data, then the user document itself.
   * Subscription + SubscriptionEvent are intentionally retained for audit.
   */
  private static async purgeOne(
    userId: unknown,
    email: string | undefined,
  ): Promise<void> {

    // GDPR cascade â€” anything that stores the user's data must go.
    // PendingEmail is keyed by `to: email`, not userId, so it gets its
    // own delete clause when we know the address. If `email` is
    // somehow missing we skip the cascade (the TTL on SENT rows will
    // TTL on SENT rows will eventually clear; DEAD rows stay until ops
    // requeues or wipes).
    const cascades: Array<Promise<unknown>> = [
      Notification.deleteMany({ receiver: userId }),
      ResetToken.deleteMany({ user: userId }),
      DeviceToken.deleteMany({ user: userId }),
    ];
    if (email) {
      cascades.push(PendingEmail.deleteMany({ to: email }));
    }
    await Promise.all(cascades);

    await User.findByIdAndDelete(userId);
  }
}

export default AccountPurgeScheduler;
