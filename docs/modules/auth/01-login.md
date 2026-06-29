# 01. Login (Email + Password)

```http
POST /auth/login
Content-Type: application/json
Auth: None (Public — credentials validated inline)
```

> Standard email + password sign-in. Returns an access-token / refresh-token pair. The refresh token is also set as an `httpOnly` cookie so browser clients don't have to handle it in JS. Status checks happen at the service layer **before** password comparison so the user gets the right reason (suspended / rejected / unverified) instead of a generic 401.

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **Public route** — no `auth` middleware. The body credentials are the only auth.
- Status checks happen **before** password compare to surface the correct failure reason. A wrong password on an `ACTIVE` user returns `401 Invalid email or password`; the same password on a `SUSPENDED` user returns the status-specific `403`.

### 2.2 Account Status Rules
Enforced by the login service at [src/app/modules/auth/auth.service.ts:48-88](../../../src/app/modules/auth/auth.service.ts#L48-L88). Each status maps to a distinct message — clients can branch UI on it.

| Status | Outcome |
| :--- | :--- |
| `ACTIVE` (and `isVerified = true`) | Allowed — tokens issued. |
| `ACTIVE` but `isVerified = false` | `401 Unauthorized` (`"message": "Please verify your account, then try to login again"`). |
| `PENDING` (and `isVerified = false`) | `403 Forbidden` (`"message": "Your account is pending verification. Please verify your email."`). |
| `PENDING` (and `isVerified = true`) | `403 Forbidden` (`"message": "Admin Verification Pending. Your account is currently under review."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Your account was rejected."`). Re-submit via [user/13-reverify-account.md](../user/13-reverify-account.md). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Your account has been suspended."`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Your account is restricted. Contact support."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Your account is inactive. Please activate it or contact support."`). |
| `DELETED` | `403 Forbidden` (`"message": "Your account has been deleted. Contact support."`). Recoverable within 30 days via [10-restore-account.md](./10-restore-account.md). |

### 2.3 Role-Based Access
Not applicable — login is public. Roles are read from the resolved user **after** authentication and embedded in the issued JWT.

### 2.4 Input Validation (Zod — `createLoginZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Valid email format. |
| `password` | `string` | Yes | Non-empty (`.min(1)`). The password-strength regex is **not** enforced on login — only on register/reset/change. |
| `deviceToken` | `string` | No | If supplied, registered to the user via `User.addDeviceToken` for push delivery. |
| `platform` | `enum` | No | `'ios'`, `'android'`, or `'web'`. Stored with `deviceToken`. |
| `appVersion` | `string` | No | Stored with `deviceToken`. |

Schema violations -> `400 Bad Request` from `validateRequest` with the Zod error details.

### 2.5 Credential & Side-Effect Flow
1. `User.findOne({ email }).select('+password +tokenVersion')` — both fields are `select: false` on the schema.
2. If no user -> `401 "Invalid email or password"` (anti-enumeration; same message as wrong password).
3. Status block (see §2.2).
4. `verified` flag check.
5. `password` presence — missing -> `400 "Password is required!"`. (Should be caught by Zod but defended at the service layer too.)
6. `bcrypt.compare(password, dbUser.password)` — mismatch -> `401 "Invalid email or password"`.
7. Issue `accessToken` + `refreshToken` (both embed `tokenVersion`).
8. If `deviceToken` was in the body, register it via `User.addDeviceToken`.
9. Controller sets `refreshToken` as an `httpOnly` cookie (production: `secure`, `sameSite: 'lax'`).

### 2.6 Rate Limit
- **10 requests / minute / IP**, identified by `routeName: 'auth:login'` ([auth.route.ts:13-17](../../../src/app/modules/auth/auth.route.ts#L13-L17)). Guards against credential-stuffing.
- On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).

---

## 3. Request Body
```json
{
  "email": "user@example.com",
  "password": "P@ssw0rd!",
  "deviceToken": "fcm-or-apns-token-optional",
  "platform": "ios",
  "appVersion": "1.0.0"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/login', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `loginUser`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `loginUserFromDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createLoginZodSchema`

**Middleware order**: `loginRateLimit` -> `validateRequest(createLoginZodSchema)` -> `AuthController.loginUser`.

---

## 5. Security
- **Rate limit**: 10/min/IP (see §2.6).
- **Anti-enumeration**: missing user and wrong password both return the same `401 "Invalid email or password"`. An attacker cannot distinguish "this email exists" from "this email is unknown" via credential trial. Status-specific responses (suspended, rejected, etc.) only fire when the password would otherwise have been validated — so this is only exposed to the legitimate owner.
- **`tokenVersion` invalidation**: the JWT carries the user's current `tokenVersion`. Future password reset / change / logout-all-devices bumps it, instantly invalidating every issued token. See [system-concepts.md — Token-Version Invalidation Policy](../../system-concepts.md#token-version-invalidation-policy).
- **Refresh-token cookie**: `httpOnly`, `secure` in production, `sameSite: 'lax'`.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged in successfully.",
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

### Error: Password required (400)
*Defensive — Zod normally catches missing password first.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Password is required!"
}
```

### Error: Invalid email or password (401)
*Returned for: unknown email OR wrong password (anti-enumeration).*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid email or password"
}
```

### Error: Account not verified (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Please verify your account, then try to login again"
}
```

### Error: Account pending approval (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Your account is pending approval."
}
```

### Error: Account rejected (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Your account was rejected."
}
```

### Error: Account suspended (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Your account has been suspended."
}
```

### Error: Account restricted (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Your account is restricted. Contact support."
}
```

### Error: Account inactive (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Your account is inactive. Please activate it or contact support."
}
```

### Error: Account deleted (403)
*Recoverable within 30 days via [10-restore-account.md](./10-restore-account.md).*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Your account has been deleted. Contact support."
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

- **First-time email verification (auto-login after OTP)** -> [02-verify-otp.md](./02-verify-otp.md).
- **Forgot password** -> [03-forgot-password.md](./03-forgot-password.md) -> [02-verify-otp.md](./02-verify-otp.md) (issues reset token) -> [04-reset-password.md](./04-reset-password.md).
- **Refresh access token** -> [05-refresh-token.md](./05-refresh-token.md).
- **Sign in via Google/Apple instead** -> [08-social-login.md](./08-social-login.md).
- **Account deleted but inside recovery window** -> [10-restore-account.md](./10-restore-account.md).
- **Account rejected — re-submit verification** -> [user/13-reverify-account.md](../user/13-reverify-account.md).
- **End the current session** -> [06-logout.md](./06-logout.md).
- **Read own profile after login** -> [user/03-get-own-profile.md](../user/03-get-own-profile.md).
