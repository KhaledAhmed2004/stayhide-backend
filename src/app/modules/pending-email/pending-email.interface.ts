import { Model } from 'mongoose';
import type { EmailKind } from '../../../config/emailRetry.config';

export type EmailStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'DEAD';

/**
 * Single email row in the PendingEmail collection — the durable
 * counterpart of a transient `nodemailer.sendMail` call. See
 * [system-concepts.md → Email Delivery & Retry Queue] for the policy.
 */
export interface IPendingEmail {
  /** Discriminates the email category. Determines per-kind retry budget. */
  kind: EmailKind;
  /** Recipient address. Same PII profile as `User.email`. */
  to: string;
  /** Rendered subject (template output at enqueue time). */
  subject: string;
  /** Rendered HTML body (template output at enqueue time). */
  html: string;

  status: EmailStatus;
  attempts: number;
  maxAttempts: number;

  /** Earliest wall-clock time at which a worker may claim this row. */
  nextAttemptAt: Date;
  /** Truncated last error message (~1KB). null on first row. */
  lastError: string | null;

  /** ID of the worker that owns the PROCESSING lease. null when idle. */
  workerId: string | null;
  /** Lease expiry — sweeper reclaims after this time. null when idle. */
  leaseExpiresAt: Date | null;

  /** Nodemailer's accepted message id, on successful send. */
  messageId: string | null;
  /** When the row reached SENT. Acts as the TTL-purge anchor. */
  sentAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type PendingEmailModel = Model<IPendingEmail>;
