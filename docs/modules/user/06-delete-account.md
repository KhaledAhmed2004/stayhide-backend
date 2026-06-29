# 06. Request Account Deletion (Self-Service Soft-Delete)

```http
DELETE /users/me
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Lets the authenticated user request deletion of their own account. The account is **soft-deleted** with a 30-day recovery window — during that window the user can come back and re-activate via [auth/10-restore-account.md](../auth/10-restore-account.md). After 30 days, a daily cron job at 03:00 UTC permanently removes the user record and cascade-deletes their owned content (notifications, group activity, ask-imam questions, reset tokens). Subscription history is intentionally retained for billing / IAP-refund audit.
>
> This endpoint requires the user's **current password** in the body — defense in depth against accidental or hijacked-session deletion.

## 1. Business Rules (Source of Truth)

### 2.1 Authentication Rules
Enforced by the `auth` middleware before the controller is reached.

- **Missing `Authorization` header** -> `401 Unauthorized` (`"message": "Unauthorized access"`).
- **Header does not start with `Bearer `** -> `401 Unauthorized` (`"message": "Authorization header must start with \"Bearer \""`).
- **Empty token after `Bearer `** -> `401 Unauthorized` (`"message": "Unauthorized access"`).
- **Invalid signature / `JsonWebTokenError`** -> `401 Unauthorized` (`"message": "Invalid token"`).
- **Expired token / `TokenExpiredError`** -> `401 Unauthorized` (`"message": "Token has expired"`).
- **Token not yet active / `NotBeforeError`** -> `401 Unauthorized` (`"message": "Token not active"`).
- **Verified payload missing `role`** -> `401 Unauthorized` (`"message": "Invalid token payload"`).
- **User in token no longer exists in DB** -> `401 Unauthorized` (`"message": "User no longer exists"`).
- **`tokenVersion` in JWT does not match DB** -> `401 Unauthorized` (`"message": "Session invalidated — please log in again"`).

### 2.2 Account Status Rules
| Status | Outcome |
| :--- | :--- |
| `ACTIVE` | Allowed — proceeds to password challenge. |
| `PENDING` | Allowed (the auth layer does not block `PENDING`; service still permits the soft-delete). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | Auth middleware allows `DELETED`? **No** — auth middleware blocks `DELETED` with 403. So a user who already issued this request and got soft-deleted cannot call it again with the old token (token was invalidated; status now blocks). The service-layer check `'Account is already scheduled for deletion'` is a safety net that only fires in race conditions. |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation (Zod — `deleteAccountZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `password` | `string` | Yes | min length 1. Must match the user's current password (bcrypt-compared by the service). |

Schema violations -> `400 Bad Request` from `validateRequest` with the Zod error details.

### 2.5 Password Challenge & Side Effects
1. The service loads the user with `+password +tokenVersion` (both `select: false` on the schema).
2. If the user is missing -> `404 NOT_FOUND` (`"message": "User doesn't exist!"`).
3. If `status === DELETED` -> `400 BAD_REQUEST` (`"message": "Account is already scheduled for deletion"`).
4. If the user has no password (Google / Apple social-only account) -> `400 BAD_REQUEST` (`"message": "Password-less accounts (Google/Apple) cannot be deleted via this endpoint yet"`). A future endpoint will accept the social ID-token instead; not built yet.
5. `bcrypt.compare(password, dbUser.password)` — wrong password -> `401 UNAUTHORIZED` (`"message": "Incorrect password"`).
6. **DB write** — `findByIdAndUpdate`:
   - `status = DELETED`
   - `deletedAt = now`
   - `recoveryDeadline = now + 30 days`
   - `deviceTokens = []` (push delivery stops immediately)
   - `$inc tokenVersion: 1` — every JWT this user holds becomes invalid on the next request.
7. The controller clears the `refreshToken` cookie so the browser session can't reuse it.

### 2.6 Recovery Window
- **Length**: exactly **30 days** from `deletedAt`. `recoveryDeadline` is computed once at deletion and stored on the user document.
- **Restoration path**: [auth/10-restore-account.md](../auth/10-restore-account.md) — `POST /auth/restore-account` with `email` + `password`.
- **After 30 days**: a daily cron at `03:00 UTC` ([src/app/modules/user/accountPurgeScheduler.ts](../../../src/app/modules/user/accountPurgeScheduler.ts)) hard-deletes the user document and cascade-deletes their owned content. The user can no longer be restored after this point.

### 2.7 Content Anonymization During the 30-Day Window
The user's `_id` and content stays in the system during the recovery window (otherwise restore would have nothing to restore). To keep that content from leaking the deleted user's name and avatar in other modules' read endpoints, any caller surfacing a user attribution **must** use [User.findPublicById](../../../src/app/modules/user/user.model.ts) — soft-deleted users are projected as `"[Deleted User]"` with the default avatar. See [system-concepts.md — Public User Display](../../system-concepts.md#public-user-display).

Group, ask-imam, and notification modules still join `User` directly today — they will be migrated when those modules are audited. Until then, the deleted user's name still appears in their group posts / comments during the 30-day window (audit-tracked as T2-7).

### 2.8 Cascade on Permanent Purge
When the cron purges a user, it also deletes (per Q2 product decision: hard delete + selective cascade):

| Collection | Removed? |
| :--- | :---: |
| `Notification` (`userId`) | Yes |
| `GroupMember` (`userId`) | Yes |
| `GroupPost` (`userId`) | Yes |
| `PostLike` (`userId`) | Yes |
| `PostComment` (`userId`) | Yes |
| `AskImam` (`userId`) | Yes |
| `ResetToken` (`user`) | Yes |
| `Subscription` (`userId`) | **No — retained for billing / IAP-refund audit** |
| `SubscriptionEvent` (`userId`) | **No — retained for tax / compliance audit** |
| `PendingEmail` (`to: user.email`) | Yes — every queued/SENT/DEAD email row addressed to this user is deleted at purge time. GDPR right-to-erasure also wipes retained mail bodies and recipient addresses. See [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue). |

---

## 3. Request Body
```json
{
  "password": "<the user's current password>"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.delete('/me', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `requestAccountDeletion`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `requestAccountDeletionFromDB`
- **Validation**: [src/app/modules/user/user.validation.ts](../../../src/app/modules/user/user.validation.ts) — `UserValidation.deleteAccountZodSchema`
- **Cron**: [src/app/modules/user/accountPurgeScheduler.ts](../../../src/app/modules/user/accountPurgeScheduler.ts) — `AccountPurgeScheduler` (started in [src/server.ts](../../../src/server.ts))

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `validateRequest(deleteAccountZodSchema)` -> `UserController.requestAccountDeletion`.

---

## 5. Security
- **No per-route rate limit** is wired in code for this endpoint today. Login + restore are rate-limited; if an attacker had a stolen token AND wanted to brute-force the password challenge, the auth middleware's `tokenVersion` rotation policy still requires them to keep stealing fresh tokens. Adding a per-IP rate limit here is recommended hardening but not yet shipped.
- **Token-version invalidation** applies to the request itself (see §2.1) and is bumped by the request itself (see §2.5) — every JWT issued before this call stops working.
- **Refresh-token cookie cleared** in the response.
- **Password is never returned** — even on success.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'account-delete'`). A retried call with the same key returns the original `200` without re-checking the password — important because the second attempt would otherwise hit the `400 "Account is already scheduled for deletion"` guard. See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Account scheduled for deletion. You can restore it within the recovery window.",
  "data": {
    "deletedAt": "2026-05-10T18:33:49.649Z",
    "recoveryDeadline": "2026-06-09T18:33:49.649Z",
    "recoveryWindowDays": 30
  }
}
```

### Error: Validation failed (400)
*Missing `password` in body.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "body.password", "message": "Password is required to confirm account deletion" }
  ]
}
```

### Error: Already scheduled for deletion (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Account is already scheduled for deletion"
}
```

### Error: Social-login-only account (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Password-less accounts (Google/Apple) cannot be deleted via this endpoint yet"
}
```

### Error: Incorrect password (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Incorrect password"
}
```

### Error: Unauthorized (401)
*Any auth-middleware failure case (see §2.1).*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized access"
}
```

### Error: Account suspended (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is suspended. Please contact support."
}
```

### Error: Account verification rejected (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account verification was rejected. Please re-submit your documents."
}
```

### Error: Account no longer active (403)
*Returned for `DELETED`, `RESTRICTED`, or `INACTIVE` status.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is no longer active"
}
```

### Error: Forbidden role (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to access this API"
}
```

### Error: User doesn't exist (404)
*Service-level race condition (user purged between auth lookup and service lookup).*
```json
{
  "success": false,
  "statusCode": 404,
  "message": "User doesn't exist!"
}
```

---

## 7. Related Flows

- **Restore the account during the 30-day window** -> [auth/10-restore-account.md](../auth/10-restore-account.md).
- **Read profile before deciding to delete** -> [03-get-own-profile.md](./03-get-own-profile.md).
- **Change password instead of deleting** -> [auth/09-change-password.md](../auth/09-change-password.md).
- **Forgot password (deletion requires current password)** -> [auth/03-forgot-password.md](../auth/03-forgot-password.md).
- **Cron job that finalizes deletion** -> [src/app/modules/user/accountPurgeScheduler.ts](../../../src/app/modules/user/accountPurgeScheduler.ts) (runs daily at 03:00 UTC; see [system-concepts.md — Time, Dates & Timezones](../../system-concepts.md#time-dates--timezones)).
