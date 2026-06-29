# 04. Reset Password

```http
POST /auth/reset-password
Authorization: Bearer {{resetToken}}
Content-Type: application/json
Auth: Reset Token (NOT a JWT — opaque 64-char hex)
```

> Commits a new password using the `resetToken` issued by [02-verify-otp.md](./02-verify-otp.md). The token sits in the `Authorization` header (either as raw value or with `Bearer ` prefix — controller accepts both). On success: password is hashed, the user's `tokenVersion` is bumped (every JWT they hold becomes invalid — true global logout), the one-time `isResetPassword` flag is cleared, and every reset token tied to this user is deleted.
>
> After success, the client must redirect to [01-login.md](./01-login.md) and authenticate with the new password.

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **Not a JWT** — the `Authorization` header carries an opaque `resetToken` (64-char hex from `crypto.randomBytes(32).toString('hex')`). The auth middleware is **not** mounted on this route; the service validates the token against the `ResetToken` collection directly.
- The controller accepts both `Bearer <token>` and `<token>` formats ([auth.controller.ts:98-100](../../../src/app/modules/auth/auth.controller.ts#L98-L100)).

| Condition | Outcome |
| :--- | :--- |
| `Authorization` header missing | `400 Bad Request` (`"message": "Reset token is required"`) |
| Token missing in `ResetToken` collection OR expired | `401 Unauthorized` (`"message": "Invalid or expired reset token"`) |
| User no longer has `authentication.isResetPassword === true` (token consumed already, or never granted by verify-otp) | `401 Unauthorized` (`"message": "Invalid request or session. Please click 'Forgot Password' again."`) |
| User's `status === DELETED` | `401 Unauthorized` (`"message": "Invalid request or session. Please click 'Forgot Password' again."`) — the permission lookup excludes DELETED users, so the result is indistinguishable from "no permission" |
| All checks pass | `200 OK` |

### 2.2 Account Status Rules
- The permission lookup excludes `status: USER_STATUS.DELETED` ([auth.service.ts:308](../../../src/app/modules/auth/auth.service.ts#L308)). All other statuses are permitted to reset their password — including `SUSPENDED`, `REJECTED`, and `INACTIVE`. Whether they can subsequently log in is determined by [01-login.md](./01-login.md), not by this endpoint.

### 2.3 Role-Based Access
Not applicable — the resetToken identifies the user; no role check is performed.

### 2.4 Input Validation (Zod — `createResetPasswordZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `newPassword` | `string` | Yes | Must match the project password regex: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]\|;:'",.<>/?]).{8,}$/` — minimum 8 chars, at least one of each: lowercase, uppercase, digit, special char. |

Regex failure -> `400 Bad Request` (`"message": "Password must include upper, lower, number, special and be 8+ chars"`).

### 2.5 Side Effects (single transaction)
On all checks passing:
1. **Reuse check (current)** — `bcrypt.compare(newPassword, dbUser.password)`. Match -> `400 "You have recently used this password. Please choose a different one."` Reset-password has no current-password challenge from the user, so we compare against the stored hash directly.
2. **Reuse check (history)** — `User.isPasswordReused(newPassword, passwordHistory)` against the previous N-1 hashes. Match -> same `400`. Depth is `PASSWORD_HISTORY_DEPTH = 5` ([auth.constants.ts](../../../src/config/auth.constants.ts)).
3. `password = bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS)`.
4. Push the OLD password hash to `passwordHistory` (FIFO, trimmed to depth).
5. `authentication.isResetPassword = false` (consume the one-time flag).
6. `$inc tokenVersion: 1` — every JWT issued under the previous version stops working on the next request.
7. `ResetToken.deleteOne({ _id: <this token> })` — consume the specific token.
8. `ResetToken.deleteMany({ user })` — defensive: nuke any other in-flight reset tokens for this user.

### 2.6 Rate Limit
- **5 requests / minute / IP**, identified by `routeName: 'auth:password-reset'` ([auth.route.ts:25-29](../../../src/app/modules/auth/auth.route.ts#L25-L29)). Shared with forgot-password and verify-otp.
- On exceed -> `429 Too Many Requests`.

---

## 3. Request Body
```json
{
  "newPassword": "NewP@ssw0rd123!"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/reset-password', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `resetPassword`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `resetPasswordToDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createResetPasswordZodSchema`

**Middleware order**: `passwordResetRateLimit` -> `validateRequest(createResetPasswordZodSchema)` -> `AuthController.resetPassword`.

---

## 5. Security
- **Single-use reset token**: consumed on first successful reset; the `ResetToken.deleteMany({ user })` after consumption also wipes any stale tokens from interrupted flows.
- **`tokenVersion` bump (global logout)**: every existing access + refresh token for this user is invalidated. The user must explicitly log in again — defends against the case where an attacker had stolen a token *before* the password reset (they lose it the moment the reset commits). Documented in [system-concepts.md — Token-Version Invalidation Policy](../../system-concepts.md#token-version-invalidation-policy).
- **`isResetPassword` one-time flag**: even if an attacker obtains the resetToken, they can't replay the reset without also obtaining the OTP step's success — the flag is set by [02-verify-otp.md](./02-verify-otp.md) and cleared on reset.
- **Rate limit**: 5/min/IP.
- **Password complexity**: enforced by Zod regex (see §2.4).
- **No password disclosure** in any response.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'auth:reset-password'`). A retried call with the same key returns the original `200` without re-bumping `tokenVersion` or re-consuming the resetToken — important because the second attempt would otherwise hit `401 "Invalid or expired reset token"` (token was already deleted on first call). See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your password has been successfully reset."
}
```

### Error: Validation failed (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "body.newPassword", "message": "Password must include upper, lower, number, special and be 8+ chars" }
  ]
}
```

### Error: Reset token required (400)
*`Authorization` header was not sent.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Reset token is required"
}
```

### Error: Invalid or expired reset token (401)
*Token doesn't exist in the `ResetToken` collection, OR `expireAt <= now`.*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid or expired reset token"
}
```

### Error: Invalid request or session (401)
*Token exists and is valid, but the user no longer carries `authentication.isResetPassword === true` (consumed already), OR the user is soft-deleted. Generic message — anti-enumeration of session state.*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid request or session. Please click 'Forgot Password' again."
}
```

### Error: Password recently used (400)
*The new password matches the current password or one of the previous 4 in `passwordHistory`. Enforces "you can't reuse any of your last 5 passwords."*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "You have recently used this password. Please choose a different one."
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

- **Get a fresh resetToken (started here)** -> [03-forgot-password.md](./03-forgot-password.md) -> [02-verify-otp.md](./02-verify-otp.md).
- **Sign in with the new password** -> [01-login.md](./01-login.md). The previous session's JWTs are now invalid (tokenVersion was bumped).
- **Authenticated user wanting to change password without email OTP** -> [09-change-password.md](./09-change-password.md).
- **Project-wide tokenVersion policy** -> [system-concepts.md](../../system-concepts.md#token-version-invalidation-policy).
