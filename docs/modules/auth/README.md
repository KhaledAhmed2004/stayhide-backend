# Auth Module APIs

> **Section**: Backend API specifications for the auth module (registration verification, login, password management, sessions).
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../system-concepts.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - [App - Auth Screen] — Login, OTP, social login, forgot/reset password
> - [Dashboard - Auth Screen] — Admin login, change password, logout
> - [App - Profile Screen] — Logout, restore-account flow

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/auth/login` | Public | **Done**: Email + password sign-in. 7 status-specific failure messages. Rate-limited 10/min/IP. | [01-login.md](./01-login.md) |
| 02 | POST | `/auth/verify-otp` | Public | **Done**: Dual flow — registration auto-login OR forgot-password resetToken issuance. Atomic OTP lookup, anti-enumeration. | [02-verify-otp.md](./02-verify-otp.md) |
| 03 | POST | `/auth/forgot-password` | Public | **Done**: Silent-success OTP dispatch. Anti-enumeration: same `200` whether email exists or not. | [03-forgot-password.md](./03-forgot-password.md) |
| 04 | POST | `/auth/reset-password` | Reset Token | **Done**: Commits new password via opaque `resetToken`. Bumps `tokenVersion` (global logout). | [04-reset-password.md](./04-reset-password.md) |
| 05 | POST | `/auth/refresh-token` | Refresh Token | **Done**: Rotation + reuse detection. Bumps `tokenVersion` on every successful rotation. | [05-refresh-token.md](./05-refresh-token.md) |
| 06 | POST | `/auth/logout` | Bearer | **Done**: Per-device logout. Clears `refreshToken` cookie + removes one `deviceToken`. Does NOT bump `tokenVersion`. | [06-logout.md](./06-logout.md) |
| 07 | POST | `/auth/resend-otp` | Public | **Done**: Resends registration verification OTP. 60s cooldown enforced server-side. 10-min OTP TTL. | [07-resend-otp.md](./07-resend-otp.md) |
| 08 | POST | `/auth/social-login` | Public | **Done**: Google / Apple ID-token sign-in. Strict provider-ID match (no email auto-link). Nonce mandatory for Apple. | [08-social-login.md](./08-social-login.md) |
| 09 | POST | `/auth/change-password` | Bearer | **Done**: Authenticated password change. Current-password challenge + regex on new + `tokenVersion` bump. | [09-change-password.md](./09-change-password.md) |
| 10 | POST | `/auth/restore-account` | Public | **Done**: Restores a soft-deleted account within 30-day recovery window via email + password. Bumps `tokenVersion` and issues fresh tokens. | [10-restore-account.md](./10-restore-account.md) |

---

## Rate-Limit Map

| Route | Limit | `routeName` | File |
|---|---|---|---|
| `POST /auth/login` | 10/min/IP | `auth:login` | [auth.route.ts](../../../src/app/modules/auth/auth.route.ts) |
| `POST /auth/social-login` | 10/min/IP | `auth:social-login` | same |
| `POST /auth/forgot-password` | 5/min/IP | `auth:password-reset` | same |
| `POST /auth/verify-otp` | 5/min/IP | `auth:password-reset` (shared) | same |
| `POST /auth/reset-password` | 5/min/IP | `auth:password-reset` (shared) | same |
| `POST /auth/restore-account` | 10/min/IP | `auth:login` (shared) | same |
| `POST /auth/refresh-token` | 20/min/IP | `auth:refresh` | same |
| `POST /auth/resend-otp` | 5/min/IP **+** per-user 60s cooldown | `auth:resend-otp` + [authHelpers.ts:33-35](../../../src/helpers/authHelpers.ts#L33-L35) | same |
| `POST /auth/logout` | none (auth-protected) | — | — |
| `POST /auth/change-password` | none (auth-protected + current-password challenge) | — | — |

All rate-limit responses include `statusCode: 429` in the body (per audit IBP-5).

---

## `tokenVersion` Invalidation Triggers

Bumping `User.tokenVersion` invalidates every JWT issued under the previous value. The auth middleware compares the JWT's `tokenVersion` claim against the DB on every protected request.

| Trigger | Where it happens | Effect |
|---|---|---|
| `POST /auth/reset-password` | [auth.service.ts:333](../../../src/app/modules/auth/auth.service.ts#L333) | Every session invalidated. |
| `POST /auth/change-password` | [auth.service.ts:381](../../../src/app/modules/auth/auth.service.ts#L381) | Every session invalidated. |
| `POST /auth/refresh-token` (every rotation) | [auth.service.ts:602](../../../src/app/modules/auth/auth.service.ts#L602) | Previous refresh token becomes invalid — single-use rotation. |
| `POST /auth/restore-account` | service `restoreAccountFromDB` | Any leftover JWT from before deletion is wiped. |
| `DELETE /users/me` (request soft-delete) | [user.service.ts](../../../src/app/modules/user/user.service.ts) — `requestAccountDeletionFromDB` | Every session invalidated. |
| `POST /users/me/email-change/confirm` | user.service `confirmEmailChangeFromDB` | Forces re-login under the new email. |
| `POST /users/me/sessions/revoke-all` | user.service `revokeAllMySessionsFromDB` | "Log me out of everywhere". |
| `PATCH /admin/users/:userId` AND `PATCH /admin/users/:userId/status` — status flip into **SUSPENDED / RESTRICTED / DELETED / REJECTED / INACTIVE** | [user.service.ts](../../../src/app/modules/user/user.service.ts) — `updateUserStatusInDB` and `updateUserByAdminInDB` | Defense-in-depth on top of the auth middleware's status check — token in flight at the moment of the admin action also dies. No-op on same-status saves. |
| `POST /auth/logout` | — | **NOT bumped.** Per-device only. The user's other devices stay logged in. |

---

## Edge Cases

| Scenario | Behavior |
| :--- | :--- |
| **Access-token expiration** | Short-lived. Client must handle `401` by calling `/auth/refresh-token`. |
| **Account status block** | Auth middleware blocks: `SUSPENDED` (specific message), `REJECTED` (specific message + re-verify link), `INACTIVE` / `DELETED` / `RESTRICTED` (generic "Account is no longer active"). Login service additionally surfaces `PENDING` ("Your account is pending approval.") and the "not verified" case. |
| **Global logout** | Any of the triggers in the table above — every JWT immediately stops working. The user gets `401 "Session invalidated — please log in again"` on the next protected call. |
| **Social-login conflict** | If the provider's email belongs to an existing password-based account, `409` — no auto-linking. User must sign in with password and link from settings (settings flow not yet built). |
| **OTP expiry** | Registration OTP: 10-minute TTL. Password-reset OTP: 3-minute TTL. Email-change OTP: 3-minute TTL. Expired OTPs always return `400 "Invalid or expired verification code"` (anti-enumeration). |
| **Resend cooldown** | Registration resend (`/auth/resend-otp`) — 60 seconds per user, server-enforced. |
| **Reuse-detection (refresh-token)** | Replay of a previously-rotated refresh token returns `401 "Refresh token expired or already used. Please login again."` Treat as compromised session signal. |
| **Soft-deleted account login attempt** | Login returns `403 "Your account has been deleted. Contact support."` Account is recoverable within 30 days via [10-restore-account.md](./10-restore-account.md). |
| **Rejected account** | Login returns `403 "Your account was rejected."` The admin reject flow emails a 24-hour re-verification token used by [user/13-reverify-account.md](../user/13-reverify-account.md). |

---

## Anti-Enumeration Summary

Endpoints that collapse multiple failure causes into a single generic message:

- **`POST /auth/login`** — unknown email + wrong password both -> `401 "Invalid email or password"`. Status-specific responses fire only for legitimate users.
- **`POST /auth/forgot-password`** — same `200` regardless of email existence.
- **`POST /auth/verify-otp`** — wrong OTP + expired OTP + unknown email + soft-deleted user all -> `400 "Invalid or expired verification code"`.
- **`POST /auth/reset-password`** — expired token + consumed token + missing `isResetPassword` flag + soft-deleted user all -> `401 "Invalid request or session. Please click 'Forgot Password' again."`
- **`POST /auth/restore-account`** — missing user + wrong password + status not DELETED + past recovery window all -> `401 "Invalid email or password"`.
- **`POST /users/reverify`** (in user module) — missing token + expired + wrong-status user all -> `400 "Invalid or expired re-verification token"`.

The two endpoints that intentionally do NOT anti-enumerate: **`POST /auth/resend-otp`** (UX-driven — registration screen needs to tell the user the email is wrong) and **`POST /auth/social-login`** (the 409 email-conflict response leaks email existence, but that's offset by the security benefit of preventing email-based account linking).
