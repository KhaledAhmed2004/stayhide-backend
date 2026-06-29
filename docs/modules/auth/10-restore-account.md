# 10. Restore Soft-Deleted Account

```http
POST /auth/restore-account
Content-Type: application/json
Auth: None (Public — credentials validated inline)
```

> Restores an account that was soft-deleted via [user/06-delete-account.md](../user/06-delete-account.md) and is still inside its 30-day recovery window. The endpoint takes `email` + `password`, validates both, flips `status: DELETED -> ACTIVE`, clears `deletedAt` / `recoveryDeadline`, bumps `tokenVersion` (so any leftover JWTs from before deletion stay invalid), and issues a fresh access + refresh token pair — same response shape as `POST /auth/login`.
>
> After 30 days the user document is permanently purged by the daily cron at 03:00 UTC; restoration is no longer possible at that point. To prevent enumeration, the response in that case is the same as wrong credentials.

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Status
This is a **public** endpoint — no `auth` middleware. Credentials are validated by the service. The auth middleware's status-block rules do not apply here (the user is in `DELETED` state, which the auth middleware would otherwise block).

| Condition | Outcome |
| :--- | :--- |
| Email not found OR account purged | `401 Unauthorized` (`"message": "Invalid email or password"`) |
| Email found, password mismatch | `401 Unauthorized` (`"message": "Invalid email or password"`) |
| Email found, password OK, `status !== DELETED` | `400 Bad Request` (`"message": "Account is not in recovery state"`) |
| Email found, password OK, `status === DELETED`, recovery deadline passed | `401 Unauthorized` (`"message": "Invalid email or password"`) — same shape as wrong creds (anti-enumeration) |
| Email found, password OK, `status === DELETED`, within 30-day window | `200 OK` — restored, tokens issued |
| Account is password-less (Google/Apple only) | `401 Unauthorized` (`"message": "Invalid email or password"`) — service treats no-password as no-match |

### 2.2 Input Validation (Zod — `createRestoreAccountZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Valid email format. Lowercased by the validator (`.toLowerCase()`). |
| `password` | `string` | Yes | Min length 1. Compared via `bcrypt.compare`. |
| `deviceToken` | `string` | No | If supplied, registered to the restored user via `User.addDeviceToken`. |

Schema violations -> `400 Bad Request` from `validateRequest` with the Zod error details.

### 2.3 Side Effects on Successful Restore
1. `findByIdAndUpdate`:
   - `status = ACTIVE`
   - `deletedAt = null`
   - `recoveryDeadline = null`
   - `$inc tokenVersion: 1`
2. New `accessToken` + `refreshToken` issued via `jwtHelper.createToken` with the bumped `tokenVersion`.
3. `refreshToken` set as an `httpOnly` cookie (production: `secure`, `sameSite: 'lax'`).
4. If `deviceToken` was in the body, registered to the user.

### 2.4 Rate Limiting
- **10 requests / minute / IP**, identified by `routeName: 'auth:login'` (shares the same limiter as `POST /auth/login` since both are credential-validating endpoints — guards against credential-stuffing attacks).
- On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).

---

## 3. Request Body
```json
{
  "email": "user@example.com",
  "password": "<the user's current password>",
  "deviceToken": "fcm-or-apns-token-optional"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/restore-account', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `restoreAccount`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `restoreAccountFromDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createRestoreAccountZodSchema`

**Middleware order**: `loginRateLimit` -> `validateRequest(createRestoreAccountZodSchema)` -> `AuthController.restoreAccount`.

---

## 5. Security
- **Anti-enumeration**: missing email, wrong password, expired recovery window, password-less account — all collapse to the same `401 "Invalid email or password"`. An attacker cannot distinguish "this email exists and is awaiting restore" from "this email is unknown".
- **Rate limit**: shared with login (10/min/IP). See §2.4.
- **`tokenVersion` bumped** on every restore — invalidates any token that may have been stolen and replayed before deletion or during the recovery window.
- **No password disclosure** — even success response only returns tokens.
- **Refresh-token cookie** is set on success (same as login).
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'auth:restore-account'`). A retried call with the same key returns the original `200` with the original token pair without re-bumping `tokenVersion` — important because the second attempt would otherwise hit `400 "Account is not in recovery state"` (the first call already flipped status back to ACTIVE). See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Account restored successfully.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
    { "path": "body.email", "message": "Invalid email address" }
  ]
}
```

### Error: Account is not in recovery state (400)
*Credentials valid, but the account's status is not `DELETED` — i.e., the user is currently active or in some other state. Use `POST /auth/login` instead.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Account is not in recovery state"
}
```

### Error: Invalid email or password (401)
*Returned for: missing email, wrong password, password-less account, OR a soft-deleted account whose recovery window has expired (anti-enumeration).*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid email or password"
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

### Error: Internal failure during restore (500)
*Should never happen in normal operation; included for completeness.*
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Failed to restore account"
}
```

---

## 7. Related Flows

- **The deletion endpoint that triggers this recovery state** -> [user/06-delete-account.md](../user/06-delete-account.md).
- **Standard login (account is `ACTIVE`)** -> [01-login.md](./01-login.md).
- **Forgot password (don't remember password to restore)** -> [03-forgot-password.md](./03-forgot-password.md). After reset, account is still in `DELETED` state until restored — call this endpoint with the new password.
- **Read profile after restore** -> [user/03-get-own-profile.md](../user/03-get-own-profile.md).
- **Refresh expired access token after a long restore session** -> [05-refresh-token.md](./05-refresh-token.md).
