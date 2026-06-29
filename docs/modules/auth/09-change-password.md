# 09. Change Password (Authenticated)

```http
POST /auth/change-password
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN, ADMIN, BROTHER, SISTER, JUMMAH)
```

> For an already-logged-in user who wants to change their password without going through the email OTP flow. Validates the current password (defense-in-depth against stolen-token mutation), enforces the password-strength regex on the new password, hashes and stores it, and **bumps `tokenVersion`** — every JWT the user holds becomes invalid on the next request (true global logout). The client must re-authenticate after success.
>
> For unauthenticated password recovery (forgot password), use [03-forgot-password.md](./03-forgot-password.md) → [02-verify-otp.md](./02-verify-otp.md) → [04-reset-password.md](./04-reset-password.md).

## 2. Business Rules (Source of Truth)

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
| `ACTIVE` | Allowed. |
| `PENDING` | Allowed (the auth layer does not block `PENDING`). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `ADMIN`, `BROTHER`, `SISTER`, `JUMMAH` ([auth.route.ts:81](../../../src/app/modules/auth/auth.route.ts#L81)).
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation (Zod — `createChangePasswordZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `currentPassword` | `string` | Yes | Non-empty. Compared via `bcrypt.compare` against the stored hash. |
| `newPassword` | `string` | Yes | Must match `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]\|;:'",.<>/?]).{8,}$/` — min 8 chars + lowercase + uppercase + digit + special char. |

Regex failure -> `400 Bad Request` (`"message": "Password must include upper, lower, number, special and be 8+ chars"`).

### 2.5 Service-Level Flow
1. `User.findById(user.id).select('+password +passwordHistory')`. Missing -> `400 "User doesn't exist!"` (rare race).
2. `bcrypt.compare(currentPassword, dbUser.password)` — mismatch -> `400 "Password is incorrect"`.
3. If `currentPassword === newPassword` (plaintext string equality) -> `400 "Please give different password from current password"`.
4. **Password-history reuse check** — `User.isPasswordReused(newPassword, passwordHistory)` runs bcrypt.compare against each of the previous N-1 hashes. Match -> `400 "You have recently used this password. Please choose a different one."` Depth is `PASSWORD_HISTORY_DEPTH = 5` ([auth.constants.ts](../../../src/config/auth.constants.ts)), so combined with the same-as-current check above, the user is blocked from reusing any of their last 5 passwords.
5. `password = bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS)`.
6. Push the OLD password hash to `passwordHistory` (FIFO, trimmed to depth).
7. **`$inc: { tokenVersion: 1 }`** — every issued JWT for this user becomes invalid on the next request.

### 2.6 Side Effects (CRITICAL — `tokenVersion` bump)
This endpoint **invalidates every active session for the user**, including the session that just called it. The client should:
1. Receive the `200` response.
2. Force the user back to the login screen.
3. The previously-issued access token continues to work for the remaining seconds until expiry (because the auth middleware reads `tokenVersion` from DB on every request — the very next call will see the bumped version and return `401 "Session invalidated — please log in again"`). The refresh token has already been invalidated server-side.

This is documented project-wide policy: changing the password rotates `tokenVersion`. See [system-concepts.md — Token-Version Invalidation Policy](../../system-concepts.md#token-version-invalidation-policy).

### 2.7 Rate Limit
- **No per-route rate limit** is wired on this endpoint today. Protected by the `auth` middleware (must be logged in) and by the `currentPassword` requirement (an attacker with a stolen token alone cannot brute-force the password change because each attempt requires guessing the current password, which is server-side bcrypt-checked).

---

## 3. Request Body
```json
{
  "currentPassword": "OldP@ssw0rd!",
  "newPassword": "NewP@ssw0rd123!"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/change-password', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `changePassword`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `changePasswordToDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createChangePasswordZodSchema`

**Middleware order**: `auth(SUPER_ADMIN, ADMIN, BROTHER, SISTER, JUMMAH)` -> `validateRequest(createChangePasswordZodSchema)` -> `AuthController.changePassword`.

---

## 5. Security
- **Current-password challenge**: defense-in-depth against stolen-token misuse.
- **Password complexity**: enforced by Zod regex (§2.4).
- **No-op guard**: rejects `newPassword === currentPassword` so the user can't silently no-op the rotation.
- **`tokenVersion` bump (global logout)**: see §2.6.
- **No rate limit** (see §2.7) — the current-password requirement is the throttle.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your password has been successfully changed"
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

### Error: User doesn't exist (400)
*Race: user purged between auth-middleware lookup and service lookup.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "User doesn't exist!"
}
```

### Error: Current password incorrect (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Password is incorrect"
}
```

### Error: New same as current (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Please give different password from current password"
}
```

### Error: Password recently used (400)
*The new password matches one of the user's previous 4 passwords stored in `passwordHistory`. Combined with the same-as-current check, this enforces "you can't reuse any of your last 5 passwords."*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "You have recently used this password. Please choose a different one."
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

### Error: Expired token (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Token has expired"
}
```

### Error: Session invalidated (401)
*Most likely cause on this endpoint: a previous `change-password` or `reset-password` already bumped `tokenVersion`.*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Session invalidated — please log in again"
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

---

## 7. Related Flows

- **Forgot password (don't know current password)** -> [03-forgot-password.md](./03-forgot-password.md) -> [02-verify-otp.md](./02-verify-otp.md) -> [04-reset-password.md](./04-reset-password.md).
- **Sign back in after the `tokenVersion` bump** -> [01-login.md](./01-login.md).
- **Refresh expired access token before the change** -> [05-refresh-token.md](./05-refresh-token.md).
- **Project-wide tokenVersion policy** -> [system-concepts.md](../../system-concepts.md#token-version-invalidation-policy).
