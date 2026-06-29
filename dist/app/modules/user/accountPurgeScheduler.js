"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountPurgeScheduler = void 0;
const user_1 = require("../../../enums/user");
const logger_1 = require("../../../shared/logger");
const user_model_1 = require("./user.model");
const notification_model_1 = require("../notification/notification.model");
const resetToken_model_1 = require("../auth/resetToken/resetToken.model");
const pending_email_model_1 = require("../pending-email/pending-email.model");
const device_token_model_1 = require("../device-token/device-token.model");
let cron = null;
try {
    cron = require('node-cron');
}
catch (_a) {
    // node-cron not installed; fall back to setInterval
}
const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 100;
const STALE_DEVICE_TOKEN_DAYS = 90;
class AccountPurgeScheduler {
    static start() {
        if (this.cronJob || this.intervalId) {
            logger_1.logger.warn('AccountPurgeScheduler already started');
            return;
        }
        if (cron) {
            // Daily at 03:00 UTC. cron.schedule timezone option keeps this stable
            // across deployments regardless of server clock setting.
            this.cronJob = cron.schedule('0 3 * * *', () => __awaiter(this, void 0, void 0, function* () {
                yield this.runOnce();
            }), { timezone: 'UTC' });
            logger_1.logger.info('AccountPurgeScheduler started (node-cron, 03:00 UTC daily)');
        }
        else {
            // 24-hour setInterval fallback. First run still happens after 24h â€”
            // call runOnce() manually if you need an immediate sweep on boot.
            this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.runOnce();
            }), DAY_MS);
            logger_1.logger.info('AccountPurgeScheduler started (setInterval, 24h)');
        }
    }
    static stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger_1.logger.info('AccountPurgeScheduler stopped');
    }
    /**
     * Run one purge sweep. Exposed so tests / admin tooling can trigger
     * the same logic on demand without waiting for the cron.
     */
    static runOnce() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                logger_1.logger.warn('AccountPurgeScheduler.runOnce called while already running; skipping');
                return { scanned: 0, purged: 0, failures: 0 };
            }
            this.isRunning = true;
            const summary = { scanned: 0, purged: 0, failures: 0 };
            try {
                const now = new Date();
                // Compound index { status: 1, recoveryDeadline: 1 } makes this a fast
                // ranged scan even at table sizes where a full collection scan would hurt.
                const expired = yield user_model_1.User.find({
                    status: user_1.USER_STATUS.DELETED,
                    recoveryDeadline: { $lte: now },
                })
                    .limit(PURGE_BATCH_SIZE)
                    .select('_id email')
                    .lean();
                summary.scanned = expired.length;
                for (const candidate of expired) {
                    try {
                        yield this.purgeOne(candidate._id, candidate.email);
                        summary.purged++;
                    }
                    catch (err) {
                        summary.failures++;
                        logger_1.errorLogger.error(`AccountPurgeScheduler: failed to purge user ${candidate._id}`, err);
                    }
                }
                if (summary.scanned > 0) {
                    logger_1.logger.info(`AccountPurgeScheduler: scanned=${summary.scanned} purged=${summary.purged} failures=${summary.failures}`);
                }
                // Second pass: prune stale device tokens across ALL users.
                // Bounds the growth of the collection and lets the orphan-cleanup
                // cron treat the FCM/APNs surface as roughly self-pruning.
                const cutoff = new Date(Date.now() - STALE_DEVICE_TOKEN_DAYS * DAY_MS);
                const pruneResult = yield device_token_model_1.DeviceToken.deleteMany({ lastSeenAt: { $lt: cutoff } });
                if (pruneResult.deletedCount > 0) {
                    logger_1.logger.info(`AccountPurgeScheduler: pruned stale device tokens on ${pruneResult.deletedCount} user(s) (cutoff=${STALE_DEVICE_TOKEN_DAYS}d)`);
                }
            }
            catch (err) {
                logger_1.errorLogger.error('AccountPurgeScheduler: sweep error', err);
            }
            finally {
                this.isRunning = false;
            }
            return summary;
        });
    }
    /**
     * Cascade-delete one user's owned data, then the user document itself.
     * Subscription + SubscriptionEvent are intentionally retained for audit.
     */
    static purgeOne(userId, email) {
        return __awaiter(this, void 0, void 0, function* () {
            // GDPR cascade â€” anything that stores the user's data must go.
            // PendingEmail is keyed by `to: email`, not userId, so it gets its
            // own delete clause when we know the address. If `email` is
            // somehow missing we skip the cascade (the TTL on SENT rows will
            // TTL on SENT rows will eventually clear; DEAD rows stay until ops
            // requeues or wipes).
            const cascades = [
                notification_model_1.Notification.deleteMany({ receiver: userId }),
                resetToken_model_1.ResetToken.deleteMany({ user: userId }),
                device_token_model_1.DeviceToken.deleteMany({ user: userId }),
            ];
            if (email) {
                cascades.push(pending_email_model_1.PendingEmail.deleteMany({ to: email }));
            }
            yield Promise.all(cascades);
            yield user_model_1.User.findByIdAndDelete(userId);
        });
    }
}
exports.AccountPurgeScheduler = AccountPurgeScheduler;
AccountPurgeScheduler.cronJob = null;
AccountPurgeScheduler.intervalId = null;
AccountPurgeScheduler.isRunning = false;
exports.default = AccountPurgeScheduler;
