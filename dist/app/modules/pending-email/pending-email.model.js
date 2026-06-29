"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingEmail = void 0;
const mongoose_1 = require("mongoose");
const emailRetry_config_1 = require("../../../config/emailRetry.config");
const EMAIL_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'DEAD'];
const pendingEmailSchema = new mongoose_1.Schema({
    kind: { type: String, enum: emailRetry_config_1.EMAIL_KINDS, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    status: {
        type: String,
        enum: EMAIL_STATUSES,
        default: 'PENDING',
        required: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, required: true },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lastError: { type: String, default: null },
    workerId: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null },
    messageId: { type: String, default: null },
    sentAt: { type: Date, default: null },
}, { timestamps: true });
// Scheduler claim query — ranged scan on `nextAttemptAt` filtered by status.
pendingEmailSchema.index({ status: 1, nextAttemptAt: 1 });
// Admin listing — `?status=&kind=` plus chronological order.
pendingEmailSchema.index({ status: 1, kind: 1, createdAt: -1 });
// TTL purge: SENT rows expire `sentRetentionDays` after their `sentAt`.
// PENDING / PROCESSING / DEAD have `sentAt = null` — Mongo TTL skips
// nulls, so those rows survive. DEAD is intentionally retained for ops
// triage and is only removed manually (or by `AccountPurgeScheduler`'s
// GDPR cascade when the owning user is purged).
pendingEmailSchema.index({ sentAt: 1 }, { expireAfterSeconds: emailRetry_config_1.emailRetryConfig.sentRetentionDays * 24 * 60 * 60 });
exports.PendingEmail = (0, mongoose_1.model)('PendingEmail', pendingEmailSchema);
exports.default = exports.PendingEmail;
