"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingEmailScheduler = void 0;
const crypto_1 = __importDefault(require("crypto"));
const emailRetry_config_1 = require("../../../config/emailRetry.config");
const logger_1 = require("../../../shared/logger");
const pending_email_service_1 = require("./pending-email.service");
let cron = null;
try {
    cron = require('node-cron');
}
catch (_a) {
    // node-cron not installed; fall back to setInterval
}
class PendingEmailScheduler {
    static start() {
        if (this.cronJob || this.intervalId) {
            logger_1.logger.warn('PendingEmailScheduler already started');
            return;
        }
        this.workerId = `pe-${crypto_1.default.randomUUID()}`;
        if (cron) {
            this.cronJob = cron.schedule(emailRetry_config_1.emailRetryConfig.cronExpression, () => __awaiter(this, void 0, void 0, function* () {
                yield this.runOnce();
            }));
            logger_1.logger.info(`PendingEmailScheduler started (node-cron ${emailRetry_config_1.emailRetryConfig.cronExpression}, workerId=${this.workerId})`);
        }
        else {
            this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.runOnce();
            }), emailRetry_config_1.emailRetryConfig.intervalMs);
            logger_1.logger.info(`PendingEmailScheduler started (setInterval ${emailRetry_config_1.emailRetryConfig.intervalMs}ms, workerId=${this.workerId})`);
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
        logger_1.logger.info('PendingEmailScheduler stopped');
    }
    /**
     * One tick. Reclaims expired leases, then processes a batch.
     * Exposed so tests / admin tooling can trigger on demand.
     */
    static runOnce() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                logger_1.logger.warn('PendingEmailScheduler.runOnce called while already running; skipping');
                return { reclaimed: 0, processed: 0, succeeded: 0, failed: 0 };
            }
            this.isRunning = true;
            try {
                const reclaimed = yield (0, pending_email_service_1.reclaimExpiredLeases)();
                if (reclaimed > 0) {
                    logger_1.logger.info(`PendingEmailScheduler: reclaimed ${reclaimed} expired lease(s)`);
                }
                const summary = yield (0, pending_email_service_1.processBatch)(this.workerId);
                if (summary.processed > 0) {
                    logger_1.logger.info(`PendingEmailScheduler: workerId=${this.workerId} processed=${summary.processed} succeeded=${summary.succeeded} failed=${summary.failed}`);
                }
                return Object.assign({ reclaimed }, summary);
            }
            catch (err) {
                logger_1.errorLogger.error('PendingEmailScheduler tick error', err);
                return { reclaimed: 0, processed: 0, succeeded: 0, failed: 0 };
            }
            finally {
                this.isRunning = false;
            }
        });
    }
}
exports.PendingEmailScheduler = PendingEmailScheduler;
PendingEmailScheduler.cronJob = null;
PendingEmailScheduler.intervalId = null;
PendingEmailScheduler.isRunning = false;
PendingEmailScheduler.workerId = '';
exports.default = PendingEmailScheduler;
