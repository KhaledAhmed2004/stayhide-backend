"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrphanFileCleaner = void 0;
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
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
const user_model_1 = require("../app/modules/user/user.model");
const unlinkFile_1 = require("./unlinkFile");
let cron = null;
try {
    cron = require('node-cron');
}
catch (_a) {
    // node-cron not installed; fall back to setInterval
}
const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
const UPLOADS_DIR = path_1.default.resolve(process.cwd(), 'uploads');
const USER_FILE_SUBFOLDERS = [
    'users/profiles',
    'users/verifications',
    'users/videos',
];
class OrphanFileCleaner {
    static start() {
        if (this.cronJob || this.intervalId) {
            logger_1.logger.warn('OrphanFileCleaner already started');
            return;
        }
        if (cron) {
            // 03:30 UTC daily — just after AccountPurgeScheduler at 03:00,
            // so any cascade unlinks from that sweep are in the failed-queue
            // before we run.
            this.cronJob = cron.schedule('30 3 * * *', () => __awaiter(this, void 0, void 0, function* () {
                yield this.runOnce();
            }), { timezone: 'UTC' });
            logger_1.logger.info('OrphanFileCleaner started (node-cron, 03:30 UTC daily)');
        }
        else {
            this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.runOnce();
            }), DAY_MS);
            logger_1.logger.info('OrphanFileCleaner started (setInterval, 24h)');
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
        logger_1.logger.info('OrphanFileCleaner stopped');
    }
    /**
     * Run one sweep. Exposed for testing / on-demand admin tooling.
     */
    static runOnce() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                logger_1.logger.warn('OrphanFileCleaner.runOnce called while already running; skipping');
                return { scanned: 0, deleted: 0, failures: 0 };
            }
            this.isRunning = true;
            const summary = { scanned: 0, deleted: 0, failures: 0 };
            try {
                // First: retry anything queued by unlinkFile.
                const retryResult = yield (0, unlinkFile_1.retryPendingUnlinks)();
                if (retryResult.retried > 0) {
                    logger_1.logger.info(`OrphanFileCleaner: retried ${retryResult.retried} queued unlinks, ${retryResult.succeeded} succeeded`);
                }
                // Build the reference set: every file path stored on any user.
                const referenced = yield this.collectReferencedFiles();
                const cutoff = Date.now() - GRACE_PERIOD_MS;
                for (const subfolder of USER_FILE_SUBFOLDERS) {
                    const dir = path_1.default.join(UPLOADS_DIR, subfolder);
                    let entries;
                    try {
                        entries = yield promises_1.default.readdir(dir);
                    }
                    catch (err) {
                        if ((err === null || err === void 0 ? void 0 : err.code) === 'ENOENT')
                            continue; // no folder = nothing to clean
                        throw err;
                    }
                    for (const entry of entries) {
                        const absolute = path_1.default.join(dir, entry);
                        summary.scanned++;
                        let stat;
                        try {
                            stat = yield promises_1.default.stat(absolute);
                        }
                        catch (_a) {
                            continue; // disappeared between readdir and stat
                        }
                        if (!stat.isFile())
                            continue;
                        if (stat.mtimeMs > cutoff)
                            continue; // inside grace period
                        if (referenced.has(absolute))
                            continue;
                        try {
                            yield promises_1.default.unlink(absolute);
                            summary.deleted++;
                        }
                        catch (err) {
                            summary.failures++;
                            logger_1.errorLogger.error(`OrphanFileCleaner: failed to unlink ${absolute}: ${err === null || err === void 0 ? void 0 : err.message}`);
                        }
                    }
                }
                if (summary.scanned > 0) {
                    logger_1.logger.info(`OrphanFileCleaner: scanned=${summary.scanned} deleted=${summary.deleted} failures=${summary.failures}`);
                }
            }
            catch (err) {
                logger_1.errorLogger.error('OrphanFileCleaner: sweep error', err);
            }
            finally {
                this.isRunning = false;
            }
            return summary;
        });
    }
    /**
     * Collect the set of absolute file paths currently referenced by
     * any User document across `profileImage`, `verificationImage`,
     * `verificationVideo`. Skips external URLs and the system default.
     */
    static collectReferencedFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const referenced = new Set();
            const cursor = user_model_1.User.find({})
                .select('profileImage verificationImage verificationVideo')
                .lean()
                .cursor();
            try {
                for (var _d = true, cursor_1 = __asyncValues(cursor), cursor_1_1; cursor_1_1 = yield cursor_1.next(), _a = cursor_1_1.done, !_a; _d = true) {
                    _c = cursor_1_1.value;
                    _d = false;
                    const doc = _c;
                    for (const value of [
                        doc.profileImage,
                        doc.verificationImage,
                        doc.verificationVideo,
                    ]) {
                        const absolute = this.storedToAbsolute(value);
                        if (absolute)
                            referenced.add(absolute);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = cursor_1.return)) yield _b.call(cursor_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return referenced;
        });
    }
    static storedToAbsolute(stored) {
        if (typeof stored !== 'string' || !stored)
            return null;
        if (stored === '/default-avatar.svg')
            return null;
        if (/^https?:\/\//i.test(stored) && !/\/uploads\//i.test(stored))
            return null;
        const idx = stored.lastIndexOf('uploads/');
        const relative = idx >= 0
            ? stored.slice(idx + 'uploads/'.length)
            : stored.replace(/^\/+/, '');
        const absolute = path_1.default.resolve(UPLOADS_DIR, relative);
        if (!absolute.startsWith(UPLOADS_DIR + path_1.default.sep) && absolute !== UPLOADS_DIR) {
            return null;
        }
        return absolute;
    }
}
exports.OrphanFileCleaner = OrphanFileCleaner;
OrphanFileCleaner.cronJob = null;
OrphanFileCleaner.intervalId = null;
OrphanFileCleaner.isRunning = false;
exports.default = OrphanFileCleaner;
