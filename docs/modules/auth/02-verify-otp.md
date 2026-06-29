# 02. Verify OTP

```http
POST /auth/verify-otp
Content-Type: application/json
Auth: None (Public — OTP validated inline)
```

> Single endpoint that handles **two distinct flows** based on the user's `isVerified` state at the moment of OTP submission:
>
> - **Registration flow** (`isVerified: false`): flips the user to `isVerified: true` and clears the OTP.
>     - **BROTHER / SISTER role**: Status remains `PENDING` (new users). Returns a success message but **no tokens**. The user must wait for admin approval.
>     - **JUMMAH role**: Status auto-transitions to `ACTIVE`. **Auto-logs the user in** by issuing tokens (`accessToken`, `refreshToken`).
>     - **Existing users** (e.g. email change where status is already `ACTIVE`): **Auto-logs the user in** by issuing tokens.
> - **Forgot-password flow** (`isVerified: true`): sets the one-time `authentication.isResetPassword = true` flag, clears the OTP, and returns a freshly-generated `resetToken`.
>
> The branch is decided server-side from the user's existing `isVerified` state.

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **Public route** — no `auth` middleware. The `(email, otp)` pair is the credential.

### 2.2 Account Status Rules
- The lookup explicitly excludes `DELETED` users.
- For `PENDING` users: OTP verification is allowed, but auto-login is blocked (see §2.6a).

### 2.3 Side Effects

#### 2.6a — Registration flow (`isVerified === false`)
On match:
1. `isVerified = true`, `authentication.oneTimeCode = null`, `authentication.expireAt = null`.
2. **Dynamic Auto-Activation for JUMMAH**:
    - If `role === 'JUMMAH'`, status is automatically updated to `ACTIVE`.
3. **Conditional Response**:
    - If user status is `PENDING` (applicable to `BROTHER` and `SISTER` roles): Returns success data with `email`, `isVerified`, and `status`. No tokens. Message: `"Email verified successfully. Your account is now pending admin approval. You will receive an email once an administrator approves your account."`.
    - If user status is `ACTIVE` (applicable to `JUMMAH` role due to auto-activation, or existing users on email change): Issues `accessToken` + `refreshToken` and returns them in `data`. Message: `"Email verify successfully"`.

#### 2.6b — Forgot-password flow (`verified === true`)
On match:
1. `authentication.isResetPassword = true`, `authentication.oneTimeCode = null`, `authentication.expireAt = null`.
2. Generate `resetToken = crypto.randomBytes(32).toString('hex')`.
3. `ResetToken.create({ user, token, expireAt: now + RESET_TOKEN_TTL_MS })` — TTL is **5 minutes** ([auth.constants.ts:2](../../../src/config/auth.constants.ts#L2)).
4. Return `{ resetToken }`.
5. Message: `"Verification Successful: Please securely store and utilize this code for reset password"`.

### 2.7 OTP TTL
- OTP is set with `expireAt = Date.now() + OTP_TTL_MS` (3 minutes from [auth.constants.ts:1](../../../src/config/auth.constants.ts#L1)) at registration time and by `POST /auth/forgot-password`.
- Resend cooldown of 60s is enforced by [07-resend-otp.md](./07-resend-otp.md).
- The email itself is delivered through the durable [PendingEmail queue](../../system-concepts.md#email-delivery--retry-queue) — SMTP failures retry with backoff, so a transient outage delays the OTP a few seconds rather than dropping it silently.

### 2.8 Rate Limit
- **5 requests / minute / IP**, identified by `routeName: 'auth:password-reset'` ([auth.route.ts:25-29](../../../src/app/modules/auth/auth.route.ts#L25-L29)). Shared with the forgot/reset endpoints.
- On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).

---

## 3. Request Body
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/verify-otp', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `verifyEmail`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `verifyEmailToDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createVerifyEmailZodSchema`

**Middleware order**: `passwordResetRateLimit` -> `validateRequest(createVerifyEmailZodSchema)` -> `AuthController.verifyEmail`.

The controller sets the `refreshToken` cookie on the success path that returns tokens (registration auto-login). The forgot-password success path returns `resetToken` in the body only — no cookie.

---

## 5. Security
- **Rate limit**: 5/min/IP (see §2.8).
- **Anti-enumeration**: wrong OTP, expired OTP, unknown email, and soft-deleted user all collapse to the same `400 "Invalid or expired verification code"`. An attacker can't probe email existence via this endpoint.
- **Atomic lookup** (see §2.5) — no race window for double-submit consuming the OTP twice.
- **OTP cleared on success** — even if the same OTP is somehow resubmitted, the second call returns the generic 400 (lookup misses because `oneTimeCode = null` after the first commit).
- **`resetToken` lifecycle**: stored in a separate `ResetToken` collection with 5-min TTL. Single-use — the reset-password endpoint deletes it on consumption.

---

## 6. Responses

### Success (200) — Registration flow (auto-login)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verify successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Success (200) — Registration flow (pending approval)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully. Your account is now pending admin approval. You will receive an email once an administrator approves your account.",
  "data": {
    "email": "user@example.com",
    "isVerified": true,
    "status": "PENDING"
  }
}
```

### Success (200) — Forgot-password flow (resetToken issued)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Verification Successful: Please securely store and utilize this code for reset password",
  "data": {
    "resetToken": "a3f8c2e1b4d7..."
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
    { "path": "body.otp", "message": "OTP is required" }
  ]
}
```

### Error: OTP required (400)
*Defensive service-layer guard — usually caught by Zod first.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "OTP is required"
}
```

### Error: Invalid or expired verification code (400)
*Wrong OTP, expired OTP, unknown email, or soft-deleted user — all collapse to this message.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid or expired verification code"
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

- **Send the OTP (registration path triggers it automatically; resend path)** -> [07-resend-otp.md](./07-resend-otp.md).
- **Start the forgot-password flow (sends the OTP)** -> [03-forgot-password.md](./03-forgot-password.md).
- **Use the issued `resetToken` to change the password** -> [04-reset-password.md](./04-reset-password.md).
- **First sign-in after registration auto-login expires** -> [01-login.md](./01-login.md).
- **Refresh the auto-issued access token** -> [05-refresh-token.md](./05-refresh-token.md).
- **Complete onboarding after registration auto-login** -> [user/05-complete-onboarding.md](../user/05-complete-onboarding.md).
