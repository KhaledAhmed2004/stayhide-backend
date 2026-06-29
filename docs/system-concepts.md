# System Concepts

> Cross-cutting concepts referenced by every screen and module doc. Read this once; the rest of the project assumes you know it.

---

## Base URL & Environment

| Environment | Base URL |
|---|---|
| Local | `http://localhost:5000/api/v1` |
| Staging | `https://staging-api.tbsosick.com/api/v1` |
| Production | `https://api.tbsosick.com/api/v1` |

Throughout the docs `{{baseUrl}}` is the placeholder. It already includes the version prefix (e.g., `http://localhost:5000/api/v1`). All endpoints are relative to this base.

---

## Standard Response Envelope

Every API response (success or error) shares the same shape:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": { ... },
  "meta": { ... }
}
```

Errors share the same envelope with `success: false` and `data: null`:

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "email", "message": "Enter a valid email address." }
  ],
  "data": null
}
```

**Pagination meta** (only on list endpoints):

```json
{
  "page": 1,
  "limit": 20,
  "total": 50,
  "totalPages": 3,
  "hasNext": true,
  "hasPrev": false
}
```

Some list endpoints add domain-specific keys to `meta` (for example, `meta.unreadCount` on `GET /notifications`).

---

## User Roles

| Role | Surface | Capability summary |
|---|---|---|
| `BROTHER` / `SISTER` / `JUMMAH` | Mobile | Register / login (email or Google / Apple), manage profile and subscription, join groups, ask imams. JUMMAH does not require admin verification and is auto-activated upon OTP verification. |
| `SUPER_ADMIN` / `ADMIN` | Dashboard | Full admin surface: growth metrics, user CRUD + block, user verification, legal CMS. |
| Public (unauth) | Either | Auth endpoints only (register, login, forgot / reset password, social login, refresh, resend OTP). |

For the full visibility / plan-gate matrix, see [overview.md §3 — User Roles & Personas](./overview.md#3-user-roles--personas) and [overview.md §9 — Subscription Plans](./overview.md#9-subscription-plans-iap).

---

## Status Code → UX Response Mapping

Canonical map of HTTP status codes to UI behaviour. Screen docs cross-link to this table instead of duplicating it.

| Status | Cause | UX response | Notes |
|---|---|---|---|
| 200 / 201 | Success | Render result | — |
| 400 | Bad request shape | Inline error under affected field | — |
| 401 | Auth (token missing / invalid / expired) | Redirect Login (or auto-refresh per [Token Refresh](./app-screens/01-auth.md#token-refresh-background)) | — |
| 403 | Account state OR plan-required | Toast or modal (account state) / paywall (plan) | — |
| 404 | Resource missing | Empty state / inline | — |
| 409 | Conflict (e.g. email exists) | Inline + recovery CTA | — |
| 422 | Validation (Zod) | Field-level inline | — |
| 429 | Rate limit | Inline countdown using `Retry-After` | — |
| 5xx | Server error | Toast + crash report | — |

---

## Common UI Rules

These apply to every authenticated screen — don't repeat them in each section.

- **Submit protection**: every submit / mutation button is disabled the moment it is tapped and shows a spinner until the request settles. Re-enable on `200`, `4xx`, `5xx`, or network failure. Prevents double-submit on slow networks.
- **Offline pre-flight**: before any submit, check connectivity. If offline, show inline message *"You're offline. Check your connection and try again."* and don't fire the request.
- **Generic 5xx**: for any unexpected `500` / `502` / `503`, show toast *"Something went wrong. Please try again."* and log to the crash reporter with request context.
- **Validation (`422`)**: map each `error.path` to its form field; show inline. Never show a generic toast for validation failures.
- **Rate-limit (`429`)**: read the `Retry-After` header; show inline *"Too many attempts. Try again in {N}s."* and disable submit until the timer expires.
- **Auth (`401`)**: redirect to Login (or auto-refresh in background per [Token Refresh](./app-screens/01-auth.md#token-refresh-background)).

---

## Subscription Plans

Three-tier IAP subscription:

- **Free** — 2 cards max, no library access, no calendar.
- **Premium** — 20 cards, unlocked library + basic calendar.
- **Enterprise** — unlimited cards, advanced calendar, only tier whose cards admin can mark as `VERIFIED`.

For the full pricing matrix and plan-gating rules, see [overview.md §9 — Subscription Plans](./overview.md#9-subscription-plans-iap).

---

## Request Body Size Limits

| Body type | Limit | Configured at |
|---|---|---|
| `application/json` | **100 KB** (Express default) | [src/app.ts:131](../src/app.ts#L131) — `express.json()` with no override |
| `application/x-www-form-urlencoded` | **100 KB** (Express default) | [src/app.ts:132](../src/app.ts#L132) — `express.urlencoded({ extended: true })` |
| `multipart/form-data` (files) | per-route via `fileHandler` (default 10 MB / file, 10 files total) | per-route in `*.route.ts` |

Anything larger than 100 KB on the JSON / urlencoded path is rejected by Express before middleware runs (`PayloadTooLargeError`, `413`). For mobile clients sending free-form text fields (`aboutMe`, `revertStory`), keep individual fields under ~32 KB to stay well below the cap.

The two exceptions that read raw bytes (Apple / Google subscription webhooks at `/api/v1/subscriptions/*/webhook`) are mounted before `express.json()` for signature verification — they are not subject to the JSON parser's limit.

---

## Time, Dates & Timezones

- **Timestamps**: every `createdAt` / `updatedAt` and any other ISO timestamp is **ISO 8601 in UTC** (suffix `Z`). Example: `"2026-05-09T10:00:00.000Z"`. Clients render in the device's local zone but never persist a non-UTC value.
- **Dates without a time component** (`dateOfBirth` and similar): plain `YYYY-MM-DD` strings, interpreted by the server as UTC midnight. A user born `1995-05-15` is treated identically across all client timezones — there is no "off-by-one" risk for the age check, because the comparison is also done in UTC.
- **Inputs**: clients should always send UTC. The server does not convert local-time inputs.
- **Cron / scheduled jobs**: run in the server's UTC clock. Any "30 days" or "24 hours" window is computed against UTC.

---

## Token-Version Invalidation Policy

Every JWT carries a `tokenVersion` claim. The auth middleware (`src/app/middlewares/auth.ts`) compares it against `User.tokenVersion` in the database on every protected request. A mismatch -> `401 Unauthorized` (`"Session invalidated — please log in again"`) and the client must re-authenticate.

**Triggers that bump `User.tokenVersion`** (every active JWT for the user instantly stops working):

| Event | Where it happens | Why |
|---|---|---|
| `POST /auth/reset-password` | [auth.service.ts](../src/app/modules/auth/auth.service.ts) — `resetPasswordToDB` | Force every old session out — the password is no longer the same. |
| `POST /auth/change-password` | [auth.service.ts](../src/app/modules/auth/auth.service.ts) — `changePasswordToDB` | Same rationale. |
| `POST /auth/refresh-token` (every successful rotation) | [auth.service.ts](../src/app/modules/auth/auth.service.ts) — `refreshTokenToDB` | Single-use refresh tokens — the just-used token must never work again. Reuse detection is built on this. |
| `POST /auth/restore-account` | [auth.service.ts](../src/app/modules/auth/auth.service.ts) — `restoreAccountFromDB` | Any JWT that may have been issued before the soft-delete must not reactivate when the account comes back. |
| `DELETE /users/me` (user self-soft-delete) | [user.service.ts](../src/app/modules/user/user.service.ts) — `requestAccountDeletionFromDB` | Immediately end every session of the deleting user. |
| `POST /users/me/email-change/confirm` | [user.service.ts](../src/app/modules/user/user.service.ts) — `confirmEmailChangeFromDB` | Identifier changed — force re-login under the new email. |
| `POST /users/me/sessions/revoke-all` | [user.service.ts](../src/app/modules/user/user.service.ts) — `revokeAllMySessionsFromDB` | "Log me out of everywhere" button. |
| Admin status flip into `SUSPENDED` / `RESTRICTED` / `DELETED` / `REJECTED` / `INACTIVE` (via `PATCH /admin/users/:userId` or `PATCH /admin/users/:userId/status`) | [user.service.ts](../src/app/modules/user/user.service.ts) — `updateUserStatusInDB` AND `updateUserByAdminInDB` | Defense-in-depth: the auth middleware status check would already 403 these users on the next request, but a token in flight at the moment of the admin action is also dead. Bumped only on actual flips (no-op for same-status saves). |

**Triggers that do NOT bump it**:
- `POST /auth/logout` — single-device logout only. Removes the FCM/APNs token from `deviceTokens[]` and clears the refresh cookie. Other devices stay logged in. To revoke every session, use `POST /users/me/sessions/revoke-all` (which bumps).
- `DELETE /users/me/sessions/:tokenId` — revokes one specific device's push delivery. JWT remains valid until natural expiry.
- Lockout-status `-> ACTIVE` reinstatement (e.g., `SUSPENDED -> ACTIVE`) — the user's old tokens are already dead from the lockout-flip bump. Admin reinstatement does not re-bump.

---

## Public User Display

Any module that surfaces user-attributed content (group post author, ask-imam questioner, comment author) **MUST** populate the user via [User.findPublicById](../src/app/modules/user/user.model.ts) or [User.findPublicByIds](../src/app/modules/user/user.model.ts), not by joining the raw `User` collection.

**Why**: a soft-deleted user (status `DELETED` or has `deletedAt`) is anonymized at this projection layer. Their content stays visible (preserves conversation context — what Reddit / Slack / Discord do), but `name` collapses to `"[Deleted User]"` and `profileImage` to the default avatar. Without this gate, soft-deleted users' real names and avatars would still appear in every thread they participated in for the 30 days before permanent purge — a privacy leak.

**Projection shape**:
```ts
{
  _id: ObjectId,
  name: string,        // "[Deleted User]" if isDeleted
  profileImage: string,    // "/default-avatar.svg" if isDeleted
  role: USER_ROLES,        // preserved either way
  isDeleted: boolean,
}
```

**Migration status (2026-05-11)**: the helper is in place. The group, ask-imam, and notification modules still join `User` directly — they'll be migrated when those modules get their own audit pass. Until then, the privacy gap surfaced in the audit as T2-7 is closed at the primitive level but not yet at every callsite.

---

## JWT Key Rotation

JWTs carry a `kid` (key id) header that identifies which signing key was used. The verifier picks the matching key from a configured map, so multiple keys can coexist during a rotation window.

**Env config** (all optional — when unset, the legacy single-secret behavior in `config.jwt.jwt_secret` / `config.jwt.jwt_refresh_secret` is used):

```bash
# Access tokens
JWT_KEY_MAP='{"v1":"<old-secret-hex>","v2":"<new-secret-hex>"}'
JWT_KEY_CURRENT=v2

# Refresh tokens (independent map)
JWT_REFRESH_KEY_MAP='{"v1":"<old-refresh-hex>","v2":"<new-refresh-hex>"}'
JWT_REFRESH_KEY_CURRENT=v2
```

**Behavior**:
- **Sign**: uses the entry matching `JWT_KEY_CURRENT` and stamps `kid` in the JWT header.
- **Verify**: reads `kid` from the inbound JWT header. If found in the map, verifies against that key. Otherwise falls back to the legacy `config.jwt.jwt_secret` — so tokens issued before rotation (no `kid`) continue to work through the transition.

**Rotation procedure**:
1. **Add** a new entry to `JWT_KEY_MAP` (e.g. `v2`) alongside the existing one (`v1`). `v1` should equal `config.jwt.jwt_secret`. Set `JWT_KEY_CURRENT=v2`. Deploy.
2. New tokens are signed with `v2`. Existing tokens (no `kid`, or `kid=v1`) still verify against the legacy secret / `v1` entry.
3. **Wait** for the longest natural lifetime — typically the refresh-token TTL (default 30 days). All pre-rotation tokens have expired by then.
4. **Remove** `v1` from `JWT_KEY_MAP`. The legacy `config.jwt.jwt_secret` can also be rotated to match `v2` at this point.

**When to rotate**: yearly as routine hygiene; immediately on suspected secret leak; after any change to the deployment that previously had filesystem access to the env (departing employee, replaced server).

Implementation: [src/helpers/jwtHelper.ts](../src/helpers/jwtHelper.ts) — backward-compatible signature, no callsite changes required.

---

## Email Delivery & Retry Queue

Every transactional email (registration OTP, forgot-password OTP, email-change OTP, email-change notification, account-rejected reverify token) flows through the durable `PendingEmail` queue at [src/app/modules/pending-email/](../src/app/modules/pending-email/). Replaces the legacy fire-and-forget `emailHelper.sendEmail` that swallowed every SMTP error.

**Public API**: services call `emailHelper.enqueue(template, { kind })` (re-exported from [src/helpers/emailHelper.ts](../src/helpers/emailHelper.ts)). The function never throws — if even the initial Mongo insert fails it falls through to a best-effort inline send so the request that depends on the email isn't broken just because the queue is unavailable.

**Dispatch flow**:
1. `enqueue` creates a `PendingEmail` row with `status: PROCESSING` AND an inline lease (`workerId='inline'`, `leaseExpiresAt = now + 180s`) — so a concurrent scheduler tick cannot also claim and double-send.
2. The same call attempts `sendNow` inline. Best case: row flips to `SENT` in the same request, message body audit-trail is preserved, total latency added = one Mongo insert (~1-3 ms).
3. On send failure: row flips back to `PENDING` with `nextAttemptAt = now + backoff(attempts)`. The scheduler retries.
4. After `maxAttempts` exceeded: row flips to `DEAD`. A `PendingEmail.DEAD` line is emitted to `errorLogger` for ops.

**Backoff math**: base=60s, multiplier=2, jitter=±20%, cap=1h. Cumulative time from enqueue to DEAD by attempts: 4 attempts ≈ 7 min, 6 attempts ≈ 31 min. Tested in [src/config/emailRetry.config.ts](../src/config/emailRetry.config.ts) via `computeNextAttemptAt`.

**Per-kind `maxAttempts`** (matches the underlying TTLs — no point retrying an email past the OTP's own expiry):

| Kind | `maxAttempts` | Underlying TTL |
|---|---|---|
| `registration_otp` | 4 | 10 min |
| `forgot_password_otp` | 4 | 3 min |
| `email_change_otp` | 4 | 3 min |
| `email_change_notification` | 6 | 24h account-state |
| `account_rejected_reverify` | 6 | 24h reverify token |

**Worker (`PendingEmailScheduler`)** at [src/app/modules/pending-email/pending-email.scheduler.ts](../src/app/modules/pending-email/pending-email.scheduler.ts):
- Mirrors `AccountPurgeScheduler`: static class, optional `node-cron`, `setInterval` fallback (60s).
- Ticks every minute. Each tick (a) reclaims expired leases (`status=PROCESSING, leaseExpiresAt<now` → flip back to `PENDING`), then (b) atomically claims up to 10 due `PENDING` rows via `findOneAndUpdate({status:PENDING, nextAttemptAt:$lte:now}, {$set:{status:PROCESSING, workerId, leaseExpiresAt}}, {sort:{nextAttemptAt:1}, new:true})`.
- `workerId` is generated with `crypto.randomUUID()` once at start; stamped on every claim for log-triage greppability.

**Lease semantics (G2 / G4)**: lease is 180s — long enough to tolerate slow SMTP greeters and Nodemailer transport-level retries without triggering duplicate sends. Crashed-worker recovery: row sits in `PROCESSING` for up to 3 min, then the next sweep reclaims it.

**TTL & retention**:
- `SENT` rows TTL-purge 14 days after `sentAt` (via Mongo TTL index on `sentAt`).
- `PENDING` / `PROCESSING` / `DEAD` rows have `sentAt = null` so the TTL skips them.
- `DEAD` rows persist until ops manually triages or the user is purged.
- When [`AccountPurgeScheduler`](../src/app/modules/user/accountPurgeScheduler.ts) hard-deletes a user, it cascades `PendingEmail.deleteMany({ to: user.email })` so GDPR right-to-erasure also wipes any retained mail history.

**At-least-once delivery — known trade-off**: if SMTP accepts a message and the worker process crashes before writing `SENT`, the row stays `PROCESSING`. After lease expiry the next sweep reclaims it and resends — the recipient gets a duplicate email. Acceptable for OTPs (single-use anyway) and notifications. Not acceptable for billing or high-stakes mail (no such kinds exist today).

**Admin endpoints** (`SUPER_ADMIN` only): list, requeue, stats. See [modules/pending-email/](modules/pending-email/).

**Known limitations**:
- Two parallel `forgot-password` requests for the same user create two `PendingEmail` rows with two different OTPs (the user-doc keeps only the most recent OTP — last write wins). Both rows produce emails; only the most recent OTP is valid. Not a regression vs the pre-queue behavior; just more visible.
- Email body (`html`) and recipient (`to`) are stored as PII for up to 14 days (SENT) or indefinitely (DEAD). Same retention profile as `User.email`. GDPR purge cascades on user deletion.

---

## Sessions Metadata

Every credential-issuing endpoint (`POST /auth/login`, `POST /auth/social-login`, `POST /auth/restore-account`) extracts session-tracking metadata from the request and stamps it on the `deviceTokens[]` entry via [User.addDeviceToken](../src/app/modules/user/user.model.ts):

| Field | Source | Storage |
|---|---|---|
| `firstSeenAt` | `Date.now()` at first registration | Plain Date. Preserved across updates. |
| `lastSeenAt` | `Date.now()` on every login/refresh | Plain Date. Refreshed on update. |
| `lastSeenIpHash` | HMAC-SHA256(req.ip, JWT_SECRET) | Hashed — DB leak does not expose user IPs. Never returned. |
| `lastSeenCity` | `geoIpHelper.lookupCity(req.ip)` | Plain string ("Chicago, IL"). Null for private IPs and when GeoIP is unconfigured. |
| `userAgent` | `req.headers['user-agent']` | Plain (already self-disclosed). |

IP source priority: `Cf-Connecting-IP` header (Cloudflare) > first entry in `X-Forwarded-For` > `req.ip`. Production deployments behind a load balancer should have `app.set('trust proxy', ...)` configured so `req.ip` is the real client.

**GeoIP**: [src/helpers/geoIpHelper.ts](../src/helpers/geoIpHelper.ts) is a stub that returns null until a provider is wired (maxmind / ipapi / ipgeolocation). Localhost / RFC1918 private IPs are short-circuited to null even when a provider is configured.

**What clients see** via `GET /users/me/sessions`: `tokenId`, `tokenPrefix`, `platform`, `appVersion`, `userAgent`, `lastSeenCity`, `firstSeenAt`, `lastSeenAt`. The hashes (`tokenHash`, `lastSeenIpHash`) are server-internal only.

---

## Device-Token Storage

FCM (Android / web) and APNs (iOS) push tokens are credentials — possession of a raw token enables push delivery to that device. To minimize blast radius if the database ever leaks, **new entries in `User.deviceTokens[]` never store the raw token**.

**On registration (login / social-login)**:
- Service receives `rawToken` from the client.
- Computes `tokenHash = HMAC_SHA256(rawToken, JWT_SECRET).hex` — keyed HMAC so even a DB+JWT-secret leak still requires knowing the raw token to verify a match.
- Computes `tokenPrefix = '…' + rawToken.slice(-6)` for "device ending in XYZA12" UI display.
- Stores `{ tokenHash, tokenPrefix, platform, appVersion, lastSeenAt }`. **Raw `token` field is left empty on new rows.**

**Lookups** (logout, addDeviceToken dedup): compute the hash of the inbound raw token and query `'deviceTokens.tokenHash'`. A migration-window fallback OR-matches the raw `token` field on legacy rows.

**Legacy rows** (pre-T1-4): still have raw `token` field. Treated as read-only — on the next login from the same device, `addDeviceToken` migrates the row in-place (clears `token`, sets `tokenHash` + `tokenPrefix`). Rows never touched again get pruned by the 90-day TTL sweep.

**TTL pruning**: `AccountPurgeScheduler` (daily 03:00 UTC) runs a second pass that `$pull`s every device-token entry with `lastSeenAt < now - 90 days`. Prevents unbounded array growth and clears credentials for devices that haven't been used in 3 months.

**What's never exposed to clients**: the raw `token` (legacy field) and the `tokenHash`. The `GET /users/me/sessions` endpoint returns `tokenPrefix` for display only.

---

## Password Policy

- **Complexity** (Zod regex): min 8 chars, at least one lowercase, one uppercase, one digit, one special character. Enforced on register / reset-password / change-password.
- **History reuse**: the previous `PASSWORD_HISTORY_DEPTH = 5` password hashes are remembered per user in `User.passwordHistory` (`select: false`). Change-password and reset-password reject any new password matching the current OR any of the previous 4 — the user cannot reuse any of their last 5 passwords. Reuse-attempt response: `400 "You have recently used this password. Please choose a different one."`
- **Hashing**: bcrypt with `config.bcrypt_salt_rounds` (env-configurable). The model's pre-save hook hashes on every modification.
- **History lifecycle**: registration leaves history empty (current password isn't "previous" yet). On first change/reset, the OLD hash is pushed; history grows up to depth, then FIFO-trims.

For details on each endpoint, see [auth/04-reset-password.md](modules/auth/04-reset-password.md) and [auth/09-change-password.md](modules/auth/09-change-password.md).

---

## Idempotency

Several write endpoints accept an optional `Idempotency-Key` request header for safe retry-on-network-error semantics. Implementation: [src/app/middlewares/idempotency.ts](../src/app/middlewares/idempotency.ts).

**Contract**:
- Header value is an opaque string supplied by the client (UUID v4 is the typical choice).
- Maximum length: 255 characters. Longer values -> `400 Bad Request` (`"message": "Idempotency-Key must be 255 characters or fewer"`).
- The same `key + routeName` replayed within **24 hours** returns the **original `2xx` response** byte-for-byte, without re-running the endpoint logic.
- Non-success responses (4xx / 5xx) are **NOT cached** — a failed first attempt can be retried with the same key. Only the first successful response sticks.
- Cache scope is per-route (`routeName`) — the same key reused on a different endpoint hits a different bucket.
- Backed by in-memory `NodeCache` today (per-instance). Production deployments behind a load balancer with multiple instances should switch to Redis for cross-instance dedup.
- Omitting the header is always safe — the middleware is a no-op when the header is absent.

**Endpoints that participate** (any unsafe operation that's expensive, sends email, mutates auth state, or is destructive):

| Endpoint | `routeName` |
|---|---|
| `POST /users` | `registration` |
| `DELETE /users/me` | `account-delete` |
| `POST /users/me/email-change/request` | `email-change-request` |
| `POST /users/me/email-change/confirm` | `email-change-confirm` |
| `POST /users/me/data-export` | `data-export` |
| `POST /users/me/sessions/revoke-all` | `sessions-revoke-all` |
| `POST /users/reverify` | `reverify` |
| `POST /auth/forgot-password` | `auth:forgot-password` |
| `POST /auth/resend-otp` | `auth:resend-otp` |
| `POST /auth/reset-password` | `auth:reset-password` |
| `POST /auth/restore-account` | `auth:restore-account` |

**Endpoints that DO NOT support it** are either:
- naturally idempotent at the data level (`PATCH /users/me`, `PATCH /users/complete-onboarding`, `DELETE /users/me/sessions/:tokenId`)
- credential-validating where retry is its own meaningful operation (`POST /auth/login`, `POST /auth/social-login`)
- read-only (`GET /users/me`, `GET /users/:userId/user`, `GET /users/me/sessions`)
- token rotation where idempotency would defeat reuse detection (`POST /auth/refresh-token`)
- session-state changes where retry is harmless (`POST /auth/logout`, `POST /auth/verify-otp`, `POST /auth/change-password`).

---

## File Storage & Orphan Cleanup

User-uploaded files live under `uploads/users/{profiles,verifications,videos}/` and are served by `app.use(express.static('uploads'))` in [src/app.ts](../src/app.ts). The stored value on a `User` document is the absolute URL produced by `fileHandler` (e.g. `http://host/uploads/users/profiles/2026-pic.jpg`); legacy rows may contain a relative path or an external URL (the old `i.ibb.co` default).

**Profile-image / verification swap** calls [unlinkFile](../src/shared/unlinkFile.ts), which:
- Parses the stored URL/path back to an absolute disk path under `uploads/`.
- Skips external URLs and the system default (`/default-avatar.svg`).
- Refuses path-traversal attempts (`..` segments).
- Catches all FS errors. Up to 3 retries per file, then queued for the orphan cleaner.

**Orphan-file cleanup**: a daily cron at 03:30 UTC ([src/shared/orphanFileCleaner.ts](../src/shared/orphanFileCleaner.ts)) sweeps each user-file subfolder, removes any file older than 24 h that isn't referenced by any `User.profileImage` / `verificationImage` / `verificationVideo`. Before the sweep it calls `retryPendingUnlinks()` so transient-failure paths get a final chance.

**Why this matters**: without the cron, every failed unlink would leak forever — and prior to this round, `unlinkFile` had a path-parsing bug that meant **no profile-image swap ever actually deleted the old file**. The cron retroactively cleans those leaks on the next sweep.

---

## Bilingual Convention

Banglish for narrative + "WHY" rationale (where present). English for endpoint paths, status codes, JSON, and table headers. This keeps technical references unambiguous while letting product reasoning stay in the team's working language.

Where a screen doc has been migrated to v2, callouts are normalized to English under the heading `> **Why this design**`.

---

## Cross-link Anchor Format

Markdown headings auto-generate GitHub-flavored anchors. Rule: lowercase, spaces → hyphens, drop punctuation. Example: `### 3.4 Create Preference Card` → `#34-create-preference-card`.

Useful canonical anchors on this page (linked from every screen file):

- `#base-url--environment`
- `#standard-response-envelope`
- `#user-roles`
- `#status-code--ux-response-mapping`
- `#common-ui-rules`
