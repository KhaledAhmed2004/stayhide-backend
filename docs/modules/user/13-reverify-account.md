# 13. Re-verify Rejected Account

```http
POST /users/reverify
Content-Type: multipart/form-data
Auth: None (Public — token validated inline)
```

> Recovery path for users whose `status` was flipped to `REJECTED` by an admin. Because REJECTED users are blocked by both the login service and the protected-route auth middleware (see [auth/01-login.md](../auth/01-login.md) §status table and [system-concepts.md](../../system-concepts.md)), they have no way to authenticate. This endpoint is **public** and authenticates the user via a one-time token that the admin reject flow emails them automatically (see [admin/07-update-user.md](../admin/07-update-user.md) — `accountRejected` template).
>
> On success: the new `verificationImage` and `verificationVideo` replace the rejected ones (old files are unlinked from disk), `status` flips back to `PENDING`, `isVerified` resets to `false`, `rejectionReason` is cleared, the one-time token is consumed, and the user re-enters the admin verification queue.

## 1. Business Rules (Source of Truth)

### 2.1 Authentication
- **Public route** — no `auth` middleware. The `token` in the request body is the credential.
- **Token issuance** — happens automatically when an admin calls [admin/07-update-user.md](../admin/07-update-user.md) with `status: "REJECTED"`. The service generates a 64-char hex token (`crypto.randomBytes(32).toString('hex')`), persists it on `User.reverification.token` with a 24-hour expiry, and emails it to the user.
- **Anti-enumeration** — a missing token, an already-consumed token, a token tied to a user whose status is no longer `REJECTED`, and an expired token all collapse to the same `400 "Invalid or expired re-verification token"`. An attacker cannot probe whether a given token string was ever issued.

### 2.2 Account Status Rules (Target User)
| Target Status | Outcome |
| :--- | :--- |
| `REJECTED` (within 24h of issuance) | Allowed — token matches, files swap in, status flips to `PENDING`. |
| `REJECTED` (token expired) | `400` (`"Invalid or expired re-verification token"`). Stale token is wiped server-side. |
| `PENDING` / `ACTIVE` / `SUSPENDED` / etc. | `400` (`"Invalid or expired re-verification token"`) — token has no effect outside the REJECTED state. |

### 2.3 Input Validation (Zod — `reverifyAccountZodSchema`)
File upload is processed by `fileHandler` **before** validation, so the resulting paths are appended to `req.body` for the validator.

| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `token` | `string` (body) | Yes | Must match `^[0-9a-fA-F]{64}$` (64-char hex). Invalid -> `400 "Invalid re-verification token format"`. |
| `verificationImage` | `string` (set by fileHandler) | Yes | Stored path. |
| `verificationVideo` | `string` (set by fileHandler) | Yes | Stored path. |

Multipart `profileImage` is **optional** — if uploaded, replaces the existing one (old file unlinked).

### 2.4 File Handling
- **Fields**:
    - `profileImage` (optional) -> `users/profiles`, image
    - `verificationImage` (required) -> `users/verifications`, image
    - `verificationVideo` (required) -> `users/videos`, video
- **Per-file size cap**: 100 MB (route override, matches registration).
- **Allowed MIME types**:
    - Images: `image/jpeg`, `image/png`, `image/jpg`, `image/webp`
    - Videos: `video/mp4`, `video/webm`
- **Image processing**: 800px-width resize; PNG palette-compressed level 8; JPEG/WebP quality 80.
- **Multer error mapping** (all -> `400 Bad Request`):
    - `LIMIT_FILE_SIZE` -> `"File too large for field 'X'. Max 100 MB."`
    - `LIMIT_UNEXPECTED_FILE` -> `"Unexpected file field 'X'."`
    - Wrong MIME -> `"Invalid file type 'X'. Allowed for Y: [list]"`.

### 2.5 Service-Level Behavior
1. Lookup: `User.findOne({ 'reverification.token': token, status: REJECTED }).select('+reverification')`.
2. If miss -> `400 "Invalid or expired re-verification token"`.
3. If `reverification.expireAt` missing or `<= now` — clear `reverification.{token, expireAt}`, then throw `400 "Invalid or expired re-verification token"`.
4. **Unlink old files**: `verificationImage`, `verificationVideo`, and (if a new profile image was uploaded) the old `profileImage`. Best-effort — failures are logged, not raised.
5. Single update (`$set`):
    - `status = PENDING`
    - `isVerified = false`
    - `verificationImage = <new path>`
    - `verificationVideo = <new path>`
    - `profileImage = <new path>` (only if uploaded)
    - `reverification = { token: null, expireAt: null }`
    - `rejectionReason = null`
6. **No `tokenVersion` bump** — the user has no live JWTs to invalidate (REJECTED users can't authenticate).
7. **No email is sent on submit.** Confirmation only after an admin approves/rejects the resubmission.

### 2.6 Side Effects
- One-time token is **consumed** even on partial success — re-running with the same token returns `400`. If the user needs another attempt, the admin must re-flip status (issuing a new token).
- User re-enters the admin review queue (visible via [admin/05-list-users.md](../admin/05-list-users.md) filtered by `status: PENDING`).
- Until the admin approves, the user still cannot log in (`PENDING` is blocked by [auth/01-login.md](../auth/01-login.md)). On approval, normal login resumes.

### 2.7 Rate Limit
- **5 requests / hour / IP**, identified by `routeName: 'reverify'`. Protects the public endpoint against token-guessing brute force (64-char hex space is huge but rate-limit is cheap defence in depth). On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).

---

## 3. Request Body (Multipart Form-Data)

| Key | Value Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `token` | `text` | Yes | 64-char hex token from the rejection email |
| `verificationImage` | `file` | Yes | Image, <= 100 MB |
| `verificationVideo` | `file` | Yes | Video, <= 100 MB |
| `profileImage` | `file` | No | Image, <= 100 MB (replaces existing if provided) |

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.post('/reverify', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `reverifyAccount`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `reverifyAccountFromDB`
- **Validation**: [src/app/modules/user/user.validation.ts](../../../src/app/modules/user/user.validation.ts) — `UserValidation.reverifyAccountZodSchema`
- **Token issuance** (admin side): [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `updateUserStatusInDB` (detects `status === REJECTED` flip)
- **Email template**: [src/shared/emailTemplate.ts](../../../src/shared/emailTemplate.ts) — `accountRejected`
- **Email delivery**: the rejection email (with the 24h reverify token) is enqueued through the durable [PendingEmail queue](../../system-concepts.md#email-delivery--retry-queue) as `kind: 'account_rejected_reverify'`. Worst-case SMTP failures retry with backoff for ~31 minutes before DLQ; the reverify token is still valid for ~24h after that, so even a DEAD row leaves the user a recovery path (ops can requeue via [pending-email/02-requeue-pending-email.md](../pending-email/02-requeue-pending-email.md)).
- **TTL constant**: [src/config/auth.constants.ts](../../../src/config/auth.constants.ts) — `REVERIFY_TOKEN_TTL_MS` (24 hours)

**Middleware order**: `rateLimitMiddleware({ windowMs: 1h, max: 5, routeName: 'reverify' })` -> `fileHandler([profileImage, verificationImage, verificationVideo], { maxFileSizeMB: 100 })` -> `validateRequest(reverifyAccountZodSchema)` -> `UserController.reverifyAccount`.

---

## 5. Security
- **Token entropy**: 64-char hex = 256 bits of entropy. Practically unguessable.
- **TTL**: 24 hours. Longer than an OTP because re-shooting a verification video takes real wall-clock time.
- **Single-use** — consumed on first successful submit (or expiry); a second call with the same token yields `400`.
- **Anti-enumeration**: every failure mode returns the same `400 "Invalid or expired re-verification token"` message.
- **Rate limit**: 5/hour/IP.
- **MIME validation**: file headers (not just extensions).
- **Path sanitization**: filenames sanitized to prevent directory traversal.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'reverify'`). A retried call with the same key returns the original `200` without re-uploading or re-processing the files — important because the second attempt would otherwise hit the `400 "Invalid or expired re-verification token"` guard (token consumed on first call). See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Documents re-submitted. Your account is back in review — you will receive an email once an admin approves it.",
  "data": {
    "email": "user@example.com",
    "status": "PENDING"
  }
}
```

### Error: Validation failed (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "body.token", "message": "Invalid re-verification token format" }
  ]
}
```

### Error: Invalid or expired re-verification token (400)
*Token missing in DB, consumed, expired, OR tied to a user whose status is no longer REJECTED. Same message in every case (anti-enumeration).*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid or expired re-verification token"
}
```

### Error: File too large (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "File too large for field 'verificationVideo'. Max 100 MB."
}
```

### Error: Unsupported file type (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid file type 'application/pdf'. Allowed for images: image/jpeg, image/png, image/jpg, image/webp"
}
```

### Error: Rate limit exceeded (429)
```json
{
  "success": false,
  "statusCode": 429,
  "message": "Too many requests, please try again later"
}
```

---

## 7. Related Flows

- **Token is issued automatically** when admin sets status to REJECTED: [admin/07-update-user.md](../admin/07-update-user.md).
- **After successful re-verification**, status flips to `PENDING`. Admin must approve again before login works: [auth/01-login.md](../auth/01-login.md).
- **If the token expires**, contact support — they can re-flip status to trigger a new token (no self-service re-issuance today).
- **Project-wide token policy** -> [system-concepts.md](../../system-concepts.md#token-version-invalidation-policy).
