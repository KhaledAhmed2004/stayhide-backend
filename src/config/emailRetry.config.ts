/**
 * Email retry / DLQ configuration.
 *
 * Per-kind retry caps map to the underlying token TTL of each email:
 *   - OTP kinds (3-10 min lifetime) — fewer retries, because emailing
 *     a recipient with an OTP they can no longer use is worse than
 *     giving up.
 *   - Token kinds (24h lifetime — reverify, email-change-notification)
 *     — more retries.
 *
 * Backoff math: base * multiplier^(attempts-1), jittered ±20%, capped.
 * With base=60s, multiplier=2:
 *   attempt 1: inline (0s)
 *   attempt 2: ~60s later
 *   attempt 3: ~180s later (cumulative ~3 min)
 *   attempt 4: ~420s later (cumulative ~7 min)
 *   attempt 5: ~900s later (cumulative ~15 min)
 *   attempt 6: ~1860s later (cumulative ~31 min)
 * After `maxAttempts`, status flips to DEAD and a `PendingEmail.DEAD`
 * line is emitted to errorLogger for ops to pick up.
 */

export type EmailKind =
  | 'registration_otp'
  | 'forgot_password_otp'
  | 'email_change_otp'
  | 'email_change_notification'
  | 'account_rejected_reverify';

export const EMAIL_KINDS: EmailKind[] = [
  'registration_otp',
  'forgot_password_otp',
  'email_change_otp',
  'email_change_notification',
  'account_rejected_reverify',
];

export const emailRetryConfig = {
  // Base backoff before attempt 2 (seconds). Subsequent attempts use
  // multiplier^(n-1). 60s matches the OTP cooldown convention.
  baseBackoffSeconds: 60,
  // Exponential multiplier.
  backoffMultiplier: 2,
  // Per-attempt jitter (fraction). 0.2 = ±20%.
  jitter: 0.2,
  // Hard ceiling on a single wait between attempts (seconds).
  maxBackoffSeconds: 3600,
  // How long a PROCESSING row remains "owned" by a worker before it
  // can be reclaimed by another tick. 180s tolerates slow SMTP greeters
  // (corporate networks: 10-30s timeouts) and Nodemailer transport-
  // level retries without triggering duplicate sends.
  leaseSeconds: 180,
  // How often the scheduler ticks. Standard 5-field cron — same shape
  // as AccountPurgeScheduler, max portability across node-cron forks.
  // Every minute is sufficient for human-paced email volume.
  cronExpression: '* * * * *',
  // Fallback when node-cron is unavailable (ms).
  intervalMs: 60_000,
  // Per-kind retry budget. OTP kinds err on the side of stopping
  // before the OTP itself expires; long-lived token kinds keep trying.
  maxAttemptsByKind: {
    registration_otp: 4, // 10-min OTP TTL; ~7 min retry budget
    forgot_password_otp: 4, // 3-min OTP TTL; first 2 retries inside, last 2 after
    email_change_otp: 4, // 3-min OTP TTL; same envelope as forgot
    email_change_notification: 6, // 24h-lived account state; ~30 min retry budget
    account_rejected_reverify: 6, // 24h reverify token TTL; ~30 min retry budget
  } as Record<EmailKind, number>,
  // SENT rows auto-purge by TTL index. 14 days is enough for ops to
  // correlate a user-reported "I didn't get the email" with the row
  // that shows it was actually sent.
  sentRetentionDays: 14,
};

/**
 * Compute the next-attempt timestamp from an attempt counter (1-based).
 * Pure function — no side effects, easy to unit-test.
 */
export const computeNextAttemptAt = (attempts: number, now: Date = new Date()): Date => {
  const {
    baseBackoffSeconds,
    backoffMultiplier,
    jitter,
    maxBackoffSeconds,
  } = emailRetryConfig;
  const raw =
    baseBackoffSeconds * Math.pow(backoffMultiplier, Math.max(0, attempts - 1));
  const jittered = raw * (1 + (Math.random() * 2 - 1) * jitter);
  const capped = Math.min(jittered, maxBackoffSeconds);
  return new Date(now.getTime() + capped * 1000);
};
