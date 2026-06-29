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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingEmailService = exports.getPendingEmailStatsFromDB = exports.requeuePendingEmailInDB = exports.listPendingEmailsFromDB = exports.reclaimExpiredLeases = exports.processBatch = exports.enqueueAndTrySend = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const emailRetry_config_1 = require("../../../config/emailRetry.config");
const logger_1 = require("../../../shared/logger");
const pending_email_model_1 = require("./pending-email.model");
const pending_email_transport_1 = require("./pending-email.transport");
const INLINE_WORKER_MARKER = 'inline';
const truncateError = (err) => {
    const raw = err instanceof Error ? err.stack || err.message : String(err);
    return raw.slice(0, 1024);
};
/**
 * Enqueue an email and attempt to send it inline (in the same request).
 * Always resolves — never throws to the caller. See
 * [system-concepts.md → Email Delivery & Retry Queue].
 *
 * Inline path takes a 60s lease (workerId='inline') BEFORE attempting
 * `sendNow` so the scheduler tick cannot also claim the row mid-send
 * and cause a duplicate. On success the row flips to SENT; on failure
 * the row stays PENDING with a backed-off `nextAttemptAt` for the
 * scheduler to pick up.
 *
 * G5 fallback: if the initial Mongo insert fails (transient connection
 * error), the function tries a best-effort inline send anyway so the
 * request that depended on the email doesn't fail outright. Failure
 * mode degrades to today's fire-and-forget behavior, NOT to total
 * silent failure of the higher-level flow.
 */
const enqueueAndTrySend = (template, opts) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { kind } = opts;
    const maxAttempts = (_a = emailRetry_config_1.emailRetryConfig.maxAttemptsByKind[kind]) !== null && _a !== void 0 ? _a : 4;
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + emailRetry_config_1.emailRetryConfig.leaseSeconds * 1000);
    // 1) Insert with PROCESSING + inline lease, so the scheduler tick
    //    skips this row while we're attempting inline.
    let row;
    try {
        row = (yield pending_email_model_1.PendingEmail.create({
            kind,
            to: template.to,
            subject: template.subject,
            html: template.html,
            status: 'PROCESSING',
            attempts: 1,
            maxAttempts,
            nextAttemptAt: now,
            workerId: INLINE_WORKER_MARKER,
            leaseExpiresAt,
            lastError: null,
            messageId: null,
            sentAt: null,
        }));
    }
    catch (insertErr) {
        // G5: Mongo-insert failure. Try a best-effort inline send so the
        // higher-level flow doesn't fail because the queue is down. The
        // send may also fail — that surfaces today's behavior, not worse.
        logger_1.errorLogger.error(`PendingEmail.enqueue insert failed (${truncateError(insertErr).slice(0, 200)}); falling back to fire-and-forget`);
        try {
            yield (0, pending_email_transport_1.sendNow)(template);
            return { id: null, status: 'BEST_EFFORT' };
        }
        catch (sendErr) {
            logger_1.errorLogger.error(`PendingEmail.enqueue best-effort send also failed: ${truncateError(sendErr).slice(0, 200)}`);
            return { id: null, status: 'BEST_EFFORT' };
        }
    }
    // 2) Inline send. We hold the lease so a concurrent scheduler tick
    //    won't reclaim. On success → SENT. On failure → release lease,
    //    reset status to PENDING, schedule next attempt.
    try {
        const result = yield (0, pending_email_transport_1.sendNow)(template);
        yield pending_email_model_1.PendingEmail.findByIdAndUpdate(row._id, {
            $set: {
                status: 'SENT',
                sentAt: new Date(),
                messageId: result.messageId,
                workerId: null,
                leaseExpiresAt: null,
            },
        });
        return { id: row._id.toString(), status: 'SENT' };
    }
    catch (sendErr) {
        const errStr = truncateError(sendErr);
        const attempts = 1;
        // attempts already at 1 (from create). Next worker tick will be
        // attempt 2.
        if (attempts >= maxAttempts) {
            yield pending_email_model_1.PendingEmail.findByIdAndUpdate(row._id, {
                $set: {
                    status: 'DEAD',
                    lastError: errStr,
                    workerId: null,
                    leaseExpiresAt: null,
                    nextAttemptAt: null,
                },
            });
            logger_1.errorLogger.error(`PendingEmail.DEAD id=${row._id} kind=${kind} to=${template.to} attempts=${attempts}`);
            return { id: row._id.toString(), status: 'PENDING' };
        }
        yield pending_email_model_1.PendingEmail.findByIdAndUpdate(row._id, {
            $set: {
                status: 'PENDING',
                lastError: errStr,
                workerId: null,
                leaseExpiresAt: null,
                nextAttemptAt: (0, emailRetry_config_1.computeNextAttemptAt)(attempts),
            },
        });
        (_b = logger_1.logger.warn) === null || _b === void 0 ? void 0 : _b.call(logger_1.logger, `PendingEmail inline send failed id=${row._id} kind=${kind} attempts=${attempts}/${maxAttempts}; will retry`);
        return { id: row._id.toString(), status: 'PENDING' };
    }
});
exports.enqueueAndTrySend = enqueueAndTrySend;
/**
 * Worker tick body — used by PendingEmailScheduler. Processes up to
 * `batchSize` due rows. Each claim is atomic via `findOneAndUpdate`.
 * Returns the count processed.
 */
const processBatch = (workerId_1, ...args_1) => __awaiter(void 0, [workerId_1, ...args_1], void 0, function* (workerId, batchSize = 10) {
    const summary = { processed: 0, succeeded: 0, failed: 0 };
    for (let i = 0; i < batchSize; i++) {
        const now = new Date();
        const leaseExpiresAt = new Date(now.getTime() + emailRetry_config_1.emailRetryConfig.leaseSeconds * 1000);
        const claimed = yield pending_email_model_1.PendingEmail.findOneAndUpdate({ status: 'PENDING', nextAttemptAt: { $lte: now } }, {
            $set: {
                status: 'PROCESSING',
                workerId,
                leaseExpiresAt,
            },
            $inc: { attempts: 1 },
        }, { sort: { nextAttemptAt: 1 }, new: true });
        if (!claimed)
            break;
        summary.processed++;
        try {
            const result = yield (0, pending_email_transport_1.sendNow)({
                to: claimed.to,
                subject: claimed.subject,
                html: claimed.html,
            });
            yield pending_email_model_1.PendingEmail.findByIdAndUpdate(claimed._id, {
                $set: {
                    status: 'SENT',
                    sentAt: new Date(),
                    messageId: result.messageId,
                    workerId: null,
                    leaseExpiresAt: null,
                    lastError: null,
                },
            });
            summary.succeeded++;
        }
        catch (err) {
            summary.failed++;
            const errStr = truncateError(err);
            const attempts = claimed.attempts;
            if (attempts >= claimed.maxAttempts) {
                yield pending_email_model_1.PendingEmail.findByIdAndUpdate(claimed._id, {
                    $set: {
                        status: 'DEAD',
                        lastError: errStr,
                        workerId: null,
                        leaseExpiresAt: null,
                        nextAttemptAt: null,
                    },
                });
                logger_1.errorLogger.error(`PendingEmail.DEAD id=${claimed._id} kind=${claimed.kind} to=${claimed.to} attempts=${attempts}`);
            }
            else {
                yield pending_email_model_1.PendingEmail.findByIdAndUpdate(claimed._id, {
                    $set: {
                        status: 'PENDING',
                        lastError: errStr,
                        workerId: null,
                        leaseExpiresAt: null,
                        nextAttemptAt: (0, emailRetry_config_1.computeNextAttemptAt)(attempts),
                    },
                });
            }
        }
    }
    return summary;
});
exports.processBatch = processBatch;
/**
 * Sweep expired leases — rows stuck in PROCESSING past their
 * `leaseExpiresAt` are reclaimed to PENDING so another worker can pick
 * them up. Defense against worker crashes mid-send.
 */
const reclaimExpiredLeases = () => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const result = yield pending_email_model_1.PendingEmail.updateMany({ status: 'PROCESSING', leaseExpiresAt: { $lt: now } }, {
        $set: {
            status: 'PENDING',
            workerId: null,
            leaseExpiresAt: null,
            nextAttemptAt: now,
        },
    });
    return result.modifiedCount;
});
exports.reclaimExpiredLeases = reclaimExpiredLeases;
/**
 * Admin: list pending emails. Standard QueryBuilder pipeline so
 * `?status=&kind=&searchTerm=&page=&limit=&sort=` all work.
 */
const listPendingEmailsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const qb = new QueryBuilder_1.default(pending_email_model_1.PendingEmail.find(), query)
        .search(['to', 'subject', 'lastError'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield qb.modelQuery.lean();
    const meta = yield qb.getPaginationInfo();
    return { meta, data };
});
exports.listPendingEmailsFromDB = listPendingEmailsFromDB;
/**
 * Admin: requeue a DEAD email. G8 — explicit guard so the operator
 * gets a precise error if they try on a non-DEAD row.
 */
const requeuePendingEmailInDB = (pendingEmailId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.Types.ObjectId.isValid(pendingEmailId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid pending-email ID format');
    }
    const row = yield pending_email_model_1.PendingEmail.findById(pendingEmailId);
    if (!row) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Pending email not found');
    }
    if (row.status !== 'DEAD') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Only DEAD emails can be requeued (current: ${row.status})`);
    }
    yield pending_email_model_1.PendingEmail.findByIdAndUpdate(pendingEmailId, {
        $set: {
            status: 'PENDING',
            attempts: 0,
            nextAttemptAt: new Date(),
            lastError: null,
            workerId: null,
            leaseExpiresAt: null,
        },
    });
    return { id: pendingEmailId, status: 'PENDING' };
});
exports.requeuePendingEmailInDB = requeuePendingEmailInDB;
/**
 * Admin: counts grouped by status + kind. For ops dashboards.
 */
const getPendingEmailStatsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const byStatus = yield pending_email_model_1.PendingEmail.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byKind = yield pending_email_model_1.PendingEmail.aggregate([
        {
            $group: {
                _id: { kind: '$kind', status: '$status' },
                count: { $sum: 1 },
            },
        },
    ]);
    const statusCounts = {};
    for (const row of byStatus)
        statusCounts[row._id] = row.count;
    const kindCounts = {};
    for (const k of emailRetry_config_1.EMAIL_KINDS)
        kindCounts[k] = {};
    for (const row of byKind) {
        const kind = row._id.kind;
        const status = row._id.status;
        if (!kindCounts[kind])
            kindCounts[kind] = {};
        kindCounts[kind][status] = row.count;
    }
    return { byStatus: statusCounts, byKind: kindCounts };
});
exports.getPendingEmailStatsFromDB = getPendingEmailStatsFromDB;
exports.PendingEmailService = {
    enqueueAndTrySend: exports.enqueueAndTrySend,
    processBatch: exports.processBatch,
    reclaimExpiredLeases: exports.reclaimExpiredLeases,
    listPendingEmailsFromDB: exports.listPendingEmailsFromDB,
    requeuePendingEmailInDB: exports.requeuePendingEmailInDB,
    getPendingEmailStatsFromDB: exports.getPendingEmailStatsFromDB,
};
