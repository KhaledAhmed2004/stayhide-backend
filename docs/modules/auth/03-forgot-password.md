# 03. Forgot Password

```http
POST /auth/forgot-password
Content-Type: application/json
Auth: None (Public — anti-enumeration silent-success)
```

> Initiates the password-reset flow by sending a 6-digit OTP to the user's email. Designed with **silent success** — the response is identical whether the email belongs to a real account or not. An attacker who pastes a list of emails into this endpoint cannot tell which ones are registered. The actual reset happens in two more steps: [02-verify-otp.md](./02-verify-otp.md) (issues a `resetToken`) → [04-reset-password.md](./04-reset-password.md) (commits the new password).

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **Public route** — no `auth` middleware. The email body is not a credential, it's an identity claim that the service neither confirms nor denies in the response (anti-enumeration).

### 2.2 Account Status Rules
- Service performs the OTP write with `status: { $ne: USER_STATUS.DELETED }` ([auth.service.ts:175-178](../../../src/app/modules/auth/auth.service.ts#L175-L178)) — soft-deleted users do **not** receive an OTP even though the response is still `200`. Any other status (`PENDING`, `ACTIVE`, `SUSPENDED`, etc.) is permitted to start a reset.
- This is intentional: the reset is an identity-recovery flow, not an authenticated action. A SUSPENDED user resetting their password is allowed; whether they can subsequently log in is determined by [01-login.md](./01-login.md).

### 2.3 Role-Based Access
Not applicable — public endpoint.

### 2.4 Input Validation (Zod — `createForgetPasswordZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Valid email format. |

Schema violations -> `400 Bad Request` from `validateRequest`. Note that malformed emails fail loudly (Zod 400), but unknown emails return silent 200 — the distinction is between "shape is wrong" (client bug) and "email doesn't exist" (intentional silence).

### 2.5 Anti-Enumeration & Side-Effect Flow
1. `User.findOne({ email })` — if no match, return success without doing anything.
2. If user found, `ResetToken.deleteMany({ user: isExistUser._id })` — invalidate any in-flight reset tokens this user already had (e.g., from a previous interrupted flow).
3. Generate 6-digit OTP via `util/generateOTP.ts`.
4. **Persist `authentication.oneTimeCode` and `authentication.expireAt` FIRST** via `findOneAndUpdate({ email, status: { $ne: DELETED } }, { $set: { authentication } })`. Race fix (T1-1): the email was previously sent before this write, which let a fast user submit the OTP before it was committed and hit "Invalid or expired" on what was a valid code. Save-before-send closes the window.
5. **Enqueue** email via `emailHelper.enqueue(emailTemplate.resetPassword({ otp, email }), { kind: 'forgot_password_otp' })`. The legacy fire-and-forget `sendEmail` (which swallowed SMTP errors) is replaced by the durable queue at [pending-email/](../pending-email/); failures are retried with backoff and dead rows surface in [pending-email/01-list-pending-emails.md](../pending-email/01-list-pending-emails.md). See [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue) for the full contract.
6. **Same `200` response is returned regardless of whether the user existed.**

> **T1-1 security fix folded in**: an earlier version of `forgetPasswordToDB` ran `console.log('Sending email to:', email, 'with OTP:', otp)` immediately before the send — leaking every recovery OTP to stdout / log pipelines. The line has been removed.

### 2.6 OTP TTL
- **3 minutes** (`OTP_TTL_MS` from [auth.constants.ts:1](../../../src/config/auth.constants.ts#L1)). Consistent with verify-otp and the email-change OTP in [user/07-email-change-request.md](../user/07-email-change-request.md).
- Multiple consecutive `forgot-password` calls overwrite the OTP — only the latest is valid. Old reset tokens are also wiped.

### 2.7 Rate Limit
- **5 requests / minute / IP**, identified by `routeName: 'auth:password-reset'` ([auth.route.ts:25-29](../../../src/app/modules/auth/auth.route.ts#L25-L29)). Shared with verify-otp and reset-password.
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
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/forgot-password', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `forgetPassword`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `forgetPasswordToDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createForgetPasswordZodSchema`
- **Template**: [src/shared/emailTemplate.ts](../../../src/shared/emailTemplate.ts) — `resetPassword`

**Middleware order**: `passwordResetRateLimit` -> `validateRequest(createForgetPasswordZodSchema)` -> `AuthController.forgetPassword`.

---

## 5. Security
- **Anti-enumeration**: missing user and successful OTP issuance both return the same `200`. No way to probe which emails are registered.
- **Rate limit**: 5/min/IP (see §2.7).
- **Email delivery is durable, never surfaced to the caller**: SMTP/transport errors are absorbed by the [PendingEmail queue](../../system-concepts.md#email-delivery--retry-queue) — failed sends retry with backoff, terminal failures become `DEAD` rows visible only to SUPER_ADMIN via [pending-email/01-list-pending-emails.md](../pending-email/01-list-pending-emails.md). The caller still sees `200` regardless of delivery state (anti-enumeration is preserved).
- **OTP lifecycle**: stored on `User.authentication` with 3-min TTL; cleared on consumption by [02-verify-otp.md](./02-verify-otp.md); overwritten by any subsequent forgot-password call.
- **Previous reset tokens invalidated**: each successful trigger calls `ResetToken.deleteMany({ user })` so stale tokens from earlier interrupted flows cannot be replayed.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'auth:forgot-password'`). A retried call with the same key returns the original silent `200` without re-sending the OTP. See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200) — Silent (always returned for valid email shape)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Please check your email. We have sent you a one-time passcode (OTP)."
}
```

### Error: Validation failed (400)
*Only fires when the email shape itself is malformed.*
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

- **User enters the OTP they received in the email** -> [02-verify-otp.md](./02-verify-otp.md). For an already-verified user, that endpoint issues a `resetToken`.
- **Use the resetToken to set a new password** -> [04-reset-password.md](./04-reset-password.md).
- **After the password is reset, sign in with new credentials** -> [01-login.md](./01-login.md).
- **OTP didn't arrive — resend** -> [07-resend-otp.md](./07-resend-otp.md). Note: resend-otp is for the registration flow, not the password-reset flow. To get a new password-reset OTP, simply call `forgot-password` again — it will invalidate the previous OTP and issue a fresh one.
- **Authenticated change-password (don't need email OTP)** -> [09-change-password.md](./09-change-password.md).
