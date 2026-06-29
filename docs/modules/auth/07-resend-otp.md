# 07. Resend Verification OTP (Registration Flow)

```http
POST /auth/resend-otp
Content-Type: application/json
Auth: None (Public)
```

> Re-issues the 6-digit registration verification OTP that gets sent during account creation. **Only for the registration flow** — to obtain a fresh password-reset OTP, call [03-forgot-password.md](./03-forgot-password.md) again, which overwrites the existing OTP and invalidates prior reset tokens.
>
> The service-layer helper `sendVerificationOTP` ([authHelpers.ts:18-57](../../../src/helpers/authHelpers.ts#L18-L57)) enforces a **60-second cooldown** between consecutive resends. The TTL on the issued OTP is **10 minutes** (longer than the password-reset OTP's 3 minutes because registration tolerates slower mail-checking).
>
> Two layers of throttling protect this endpoint:
> - **Per-user 60s cooldown** at the service layer (blocks repeated taps on the same email).
> - **Per-IP 5/min route limit** (blocks an attacker sweeping many emails from one host).

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **Public route** — no `auth` middleware. The email body is the identity claim.

### 2.2 Account Status Rules
- Service throws `400 "User doesn't exist!"` if `User.findOne({ email })` returns nothing — including for soft-deleted users (the find isn't status-filtered, but a typical DELETED user won't be on the resend path).
- Service throws `400 "User is already verified!"` if `user.isVerified === true` — covers the case where someone tries to resend a registration OTP for an already-active account.
- Other statuses (`PENDING`, `SUSPENDED`, etc.) do not block resend at this endpoint; the registration flow normally only fires for `PENDING` users.

### 2.3 Role-Based Access
Not applicable — public endpoint.

### 2.4 Input Validation (Zod — `createResendOtpZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Valid email format. Lowercased by the validator (`.toLowerCase()`) to match the storage normalization. |

Schema violations -> `400 Bad Request` from `validateRequest`.

### 2.5 Resend Cooldown
Enforced inside `sendVerificationOTP` ([authHelpers.ts:33-35](../../../src/helpers/authHelpers.ts#L33-L35)):

- The previous OTP's `expireAt` is used to compute when it was *sent* (`lastSent = expireAt - 10min`).
- If `now - lastSent < 60 seconds`, the helper throws **`429 Too Many Requests`** with message `"Please wait 60 seconds before requesting another OTP"`.
- After the cooldown elapses, a fresh 6-digit OTP is generated and `expireAt` is reset to `now + 10 minutes`.

### 2.6 OTP TTL
- **10 minutes** ([authHelpers.ts:10](../../../src/helpers/authHelpers.ts#L10) — `OTP_EXPIRY_MINUTES = 10`). Distinct from the password-reset OTP's 3-minute TTL because registration is more forgiving of slow inbox checks.

### 2.7 Side-Effect Flow
1. Lookup user by email; not found -> `400 "User doesn't exist!"`.
2. If already verified -> `400 "User is already verified!"`.
3. Check the 60-second resend cooldown — if violated -> `429`.
4. Generate OTP, persist to `user.authentication.{oneTimeCode, expireAt}`.
5. **Enqueue** email via `emailHelper.enqueue(emailTemplate.createAccount({ name, email, otp }), { kind: 'registration_otp' })`. Durable — SMTP failures retry with backoff; see [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue).
6. Return `{ otp }` from the helper (the controller ignores this — only the success envelope reaches the client).

### 2.8 Rate Limit (Route-Level)
- **5 requests / minute / IP**, identified by `routeName: 'auth:resend-otp'` ([auth.route.ts](../../../src/app/modules/auth/auth.route.ts)). Closes the email-enumeration / OTP-spam window where an attacker hits many addresses at once (the per-user cooldown alone cannot stop that).
- On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).

---

## 3. Request Body
```json
{
  "email": "user@example.com"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/resend-otp', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `resendVerifyEmail`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `resendVerifyEmailToDB` (delegates to `sendVerificationOTP`)
- **Helper**: [src/helpers/authHelpers.ts](../../../src/helpers/authHelpers.ts) — `sendVerificationOTP`
- **Template**: [src/shared/emailTemplate.ts](../../../src/shared/emailTemplate.ts) — `createAccount`

**Middleware order**: `resendOtpRateLimit` -> `validateRequest(createResendOtpZodSchema)` -> `AuthController.resendVerifyEmail`.

---

## 5. Security
- **60-second per-user cooldown** between resends (§2.5).
- **5/min per-IP route limit** (§2.8) — protects against sweeps where an attacker rotates through many emails on one IP.
- **No anti-enumeration**: this endpoint *does* reveal whether an email exists (the `400 "User doesn't exist!"` response differs from `200`). This is a deliberate tradeoff for UX on the registration screen, but worth noting if you ever require anti-enumeration parity with [03-forgot-password.md](./03-forgot-password.md).
- **Already-verified guard** prevents an attacker from spamming OTPs at an active user.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'auth:resend-otp'`). A retried call with the same key returns the original `200` without re-sending the OTP — protects against the user-facing "I tapped twice" scenario that would otherwise trip the 60-second cooldown on the second call. See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Verification code has been resent to your email.",
  "data": {
    "otp": "123456"
  }
}
```

> Note: the OTP is included in the response body for development convenience. In production, this should be removed so the OTP only reaches the user via email.

### Error: Validation failed (400)
*Missing or non-email `email` field — caught by Zod before the service runs.*
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

### Error: User doesn't exist (400)
*Well-formed email that does not match any account.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "User doesn't exist!"
}
```

### Error: User already verified (400)
*This endpoint is only for the registration flow. An active user trying to resend the registration OTP gets this. To reset their password, use [03-forgot-password.md](./03-forgot-password.md).*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "User is already verified!"
}
```

### Error: Cooldown active (429)
*Less than 60 seconds since the previous OTP was issued (per-user check).*
```json
{
  "success": false,
  "statusCode": 429,
  "message": "Please wait 60 seconds before requesting another OTP"
}
```

### Error: Rate limit exceeded (429)
*More than 5 requests from the same IP in the last minute (per-IP check).*
```json
{
  "success": false,
  "statusCode": 429,
  "message": "Too many requests, please try again later"
}
```

---

## 7. Related Flows

- **Original registration that triggered the first OTP** -> [user/01-create-user.md](../user/01-create-user.md).
- **Verify the OTP once received** -> [02-verify-otp.md](./02-verify-otp.md).
- **Forgot password (different flow — does NOT use this endpoint)** -> [03-forgot-password.md](./03-forgot-password.md).
- **First sign-in after verification** -> [01-login.md](./01-login.md).
