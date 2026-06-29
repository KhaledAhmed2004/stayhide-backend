# 08. Confirm Email Change (Step 2 of 2)

```http
POST /users/me/email-change/confirm
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Step 2 of the self-service email-change flow. The user submits the 6-digit OTP that was emailed to the **new** address by [07-email-change-request.md](./07-email-change-request.md). On a successful match the server commits the change: `email` is updated to the pending value, the `emailChange` subdoc is cleared, and `tokenVersion` is bumped — invalidating every JWT that was issued under the old email. The client must call [auth/01-login.md](../auth/01-login.md) again with the new email.

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

> Note: this endpoint requires the user to still be logged in under the **old** email. If the access token expires between Step 1 and Step 2, refresh it via [auth/05-refresh-token.md](../auth/05-refresh-token.md) before calling this endpoint.

### 2.2 Account Status Rules
| Status | Outcome |
| :--- | :--- |
| `ACTIVE` | Allowed. |
| `PENDING` | Allowed (the auth layer does not block `PENDING`). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation (Zod — `confirmEmailChangeZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `otp` | `string` | Yes | Must match `^\d{6}$` — exactly 6 digits. |

Schema violations -> `400 Bad Request` from `validateRequest` with the Zod error details.

### 2.5 Service-Level Checks
1. Load user with `+emailChange +tokenVersion` (both `select: false`). Missing -> `404` (`"User doesn't exist!"`).
2. If `emailChange` is missing OR any of `newEmail` / `otp` / `expireAt` is null -> `400` (`"No pending email-change request"`).
3. If `expireAt <= now` — clear the stale `emailChange` subdoc, then throw `400` (`"OTP has expired"`). The user can call Step 1 again to start over.
4. If `pending.otp !== otp` -> `400` (`"Invalid OTP"`). The pending change is **not** cleared on a wrong OTP — the user can retry within the 3-minute window.
5. **Re-check uniqueness** at commit time — `User.findOne({ email: pending.newEmail, _id: { $ne: id }, status: { $ne: DELETED } })`. If somebody else grabbed the address while the OTP was outstanding, clear the `emailChange` subdoc and throw `409` (`"This email is already in use"`).
6. Commit (single update):
   - `$set: { email: pending.newEmail, emailChange: { newEmail: null, otp: null, expireAt: null } }`
   - `$inc: { tokenVersion: 1 }`
7. **Race safety net**: even with step 5, a parallel commit from another user could squeeze in between the re-check and the write. The unique index on `email` then throws `E11000`; the service catches it, clears the pending request, and re-surfaces the same `409 "This email is already in use"` — so the two failure modes are indistinguishable from the caller's perspective.
8. Controller clears the `refreshToken` cookie.

### 2.6 Side Effects
- **Identifier change** — `email` on the user document is now the new value (already lowercased in Step 1).
- **`tokenVersion` bumped by 1** — every JWT issued under the old email becomes invalid on the next request. The user must log in again with the new email.
- **`emailChange` subdoc cleared** — pending state is wiped.
- **`refreshToken` cookie cleared** — the browser session can't reuse the now-invalid refresh token.
- **Login (POST /auth/login)** must use the **new email** going forward. The old email no longer matches any account.

### 2.7 OTP Lifecycle (Step-by-step)
| Event | `emailChange.newEmail` | `emailChange.otp` | `emailChange.expireAt` | `tokenVersion` |
|---|---|---|---|---|
| Before Step 1 | `null` | `null` | `null` | `N` |
| After Step 1 | `<new>` | `<6-digit>` | `now + 3m` | `N` |
| After Step 2 success | `null` | `null` | `null` | `N + 1` |
| After Step 2 OTP-expired | `null` | `null` | `null` | `N` |
| After Step 2 wrong-OTP | `<new>` | `<6-digit>` | unchanged | `N` |
| After Step 2 race-409 | `null` | `null` | `null` | `N` |

---

## 3. Request Body
```json
{
  "otp": "123456"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.post('/me/email-change/confirm', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `confirmEmailChange`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `confirmEmailChangeFromDB`
- **Validation**: [src/app/modules/user/user.validation.ts](../../../src/app/modules/user/user.validation.ts) — `UserValidation.confirmEmailChangeZodSchema`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `validateRequest(confirmEmailChangeZodSchema)` -> `UserController.confirmEmailChange`.

---

## 5. Security
- **Wrong OTP does NOT clear the pending change** — users can retry within the TTL. Brute-force is bounded by the 3-minute window plus the 10⁶ keyspace; for stronger protection, add an attempt-counter (future hardening).
- **Race-condition uniqueness check** at commit time prevents two users from confirming the same new email seconds apart.
- **`tokenVersion` bumped** — defense in depth against any token issued under the old email being reused after the change.
- **`refreshToken` cookie cleared** by the controller.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'email-change-confirm'`). A retried call with the same key returns the original `200` without re-trying to consume the OTP — important because the second attempt would otherwise hit the `400 "No pending email-change request"` guard (since the first call already cleared the pending state). See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email changed successfully. Please log in again with the new email.",
  "data": {
    "email": "new.address@example.com"
  }
}
```

### Error: Validation failed (400)
*OTP missing or wrong shape.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "body.otp", "message": "OTP must be exactly 6 digits" }
  ]
}
```

### Error: No pending email-change request (400)
*The user calls confirm without ever calling request, or after a successful confirm/expiry/race-409.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "No pending email-change request"
}
```

### Error: OTP has expired (400)
*More than 3 minutes since Step 1. The `emailChange` subdoc is auto-cleared; the user must call Step 1 again.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "OTP has expired"
}
```

### Error: Invalid OTP (400)
*Wrong code. The pending change is preserved so the user can retry.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid OTP"
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

### Error: Email already in use (409)
*Race: a different user grabbed the new email between Step 1 and Step 2. The pending change is cleared.*
```json
{
  "success": false,
  "statusCode": 409,
  "message": "This email is already in use"
}
```

---

## 7. Related Flows

- **Step 1 — request the change** -> [07-email-change-request.md](./07-email-change-request.md).
- **Re-login with the new email** -> [auth/01-login.md](../auth/01-login.md).
- **Refresh the access token if it expired between Step 1 and Step 2** -> [auth/05-refresh-token.md](../auth/05-refresh-token.md).
- **Read the new identifier on the profile** -> [03-get-own-profile.md](./03-get-own-profile.md).
