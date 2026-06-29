/**
 * Email helper — thin shim around the durable `PendingEmail` queue.
 *
 * Previously this file owned a Nodemailer transporter and a fire-and-
 * forget `sendEmail` that swallowed every error. As of T1-1 the
 * transporter moved to `pending-email.transport.ts` (single connection
 * pool) and the public API is `enqueue` — see
 * [system-concepts.md → Email Delivery & Retry Queue].
 *
 * The legacy `sendEmail` function has been removed. Callers should use
 * `emailHelper.enqueue(template, { kind })` (or import `enqueue` from
 * `pending-email.service` directly when avoiding the helper shim).
 */
import { EmailKind } from '../config/emailRetry.config';
import {
  enqueueAndTrySend,
} from '../app/modules/pending-email/pending-email.service';
import type { SendEmailInput } from '../app/modules/pending-email/pending-email.transport';

export type { SendEmailInput };

export const enqueue = (
  template: SendEmailInput,
  opts: { kind: EmailKind },
) => enqueueAndTrySend(template, opts);

export const emailHelper = {
  /**
   * Enqueue an email for durable delivery.
   * Returns `{ id, status }`. Never throws.
   */
  enqueue,
};
