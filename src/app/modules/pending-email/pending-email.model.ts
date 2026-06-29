import { model, Schema } from 'mongoose';
import {
  EMAIL_KINDS,
  emailRetryConfig,
} from '../../../config/emailRetry.config';
import { IPendingEmail, PendingEmailModel } from './pending-email.interface';

const EMAIL_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'DEAD'] as const;

const pendingEmailSchema = new Schema<IPendingEmail>(
  {
    kind: { type: String, enum: EMAIL_KINDS, required: true },
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
  },
  { timestamps: true },
);

// Scheduler claim query — ranged scan on `nextAttemptAt` filtered by status.
pendingEmailSchema.index({ status: 1, nextAttemptAt: 1 });

// Admin listing — `?status=&kind=` plus chronological order.
pendingEmailSchema.index({ status: 1, kind: 1, createdAt: -1 });

// TTL purge: SENT rows expire `sentRetentionDays` after their `sentAt`.
// PENDING / PROCESSING / DEAD have `sentAt = null` — Mongo TTL skips
// nulls, so those rows survive. DEAD is intentionally retained for ops
// triage and is only removed manually (or by `AccountPurgeScheduler`'s
// GDPR cascade when the owning user is purged).
pendingEmailSchema.index(
  { sentAt: 1 },
  { expireAfterSeconds: emailRetryConfig.sentRetentionDays * 24 * 60 * 60 },
);

export const PendingEmail = model<IPendingEmail, PendingEmailModel>(
  'PendingEmail',
  pendingEmailSchema,
);

export default PendingEmail;
