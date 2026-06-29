export const OTP_TTL_MS = 3 * 60 * 1000; // 3 minutes
export const RESET_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Longer-lived than an OTP because re-shooting a verification video /
// re-uploading an ID takes real wall-clock time. Consumed by the public
// POST /users/reverify endpoint after an admin REJECTED the account.
export const REVERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const REVERIFY_TOKEN_TTL_HOURS = REVERIFY_TOKEN_TTL_MS / (60 * 60 * 1000);

// How many previous password hashes to remember per user, used by the
// change-password / reset-password reuse check. 5 is the industry default
// (NIST 800-63B doesn't prescribe a number but most enterprise auth
// products land between 3 and 10). The current password counts as one
// of the five — when the user changes, we push the old hash into the
// list and trim to depth.
export const PASSWORD_HISTORY_DEPTH = 5;
