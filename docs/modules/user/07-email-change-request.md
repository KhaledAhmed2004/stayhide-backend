# 07. Request Email Change (Step 1 of 2)

```http
POST /users/me/email-change/request
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Step 1 of the self-service email-change flow. The user supplies a new email address and their current password; the server validates the password, checks the new email isn't already in use, stores the pending change on the user document, and:
>
> - sends a **6-digit OTP** to the **new** email address (proves the user controls that inbox)
> - sends a **heads-up notification** to the **old** email address (catches takeover attempts where an attacker has the password but not the original inbox)
>
> The change is **not committed yet**. Step 2 ([08-email-change-confirm.md](./08-email-change-confirm.md)) verifies the OTP and commits the new email.

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

### 2.4 Input Validation (Zod — `requestEmailChangeZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `newEmail` | `string` | Yes | Valid email format. Lowercased by the validator (`.toLowerCase()`). |
| `password` | `string` | Yes | Min length 1. Must match the user's current password (bcrypt-compared by the service). |

Schema violations -> `400 Bad Request` from `validateRequest` with the Zod error details.

### 2.5 Service-Level Checks
1. Load user with `+password` (select: false on the schema). Missing -> `404` (`"User doesn't exist!"`).
2. If `dbUser.password` is empty (Google/Apple-only account) -> `400` (`"Password-less accounts (Google/Apple) cannot change email via this endpoint yet"`).
3. `bcrypt.compare(password, dbUser.password)` — wrong password -> `401` (`"Incorrect password"`).
4. If `newEmail === dbUser.email` -> `400` (`"New email is the same as the current email"`).
5. Uniqueness — `User.findOne({ email: newEmail, _id: { $ne: id }, status: { $ne: DELETED } })`. Match -> `409` (`"This email is already in use"`). Soft-deleted users do **not** block the address (their account will be purged in ≤30 days; see [06-delete-account.md](./06-delete-account.md)).
6. Generate 6-digit numeric OTP (`util/generateOTP.ts`).
7. **Persist** `emailChange = { newEmail, otp, expireAt: now + OTP_TTL_MS }` on the user document.
8. **Enqueue** `emailTemplate.changeEmail({ newEmail, otp })` to the new email via `emailHelper.enqueue(..., { kind: 'email_change_otp' })`. Durable — see [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue).
9. **Enqueue** `emailTemplate.emailChangeNotification({ oldEmail, newEmail })` to the old email via `emailHelper.enqueue(..., { kind: 'email_change_notification' })`. Same durability guarantee — the heads-up to the old address survives SMTP blips, so a hijacker can't race a successful change before the legitimate owner sees the warning.

### 2.6 OTP TTL
- **3 minutes** (`OTP_TTL_MS` from [src/config/auth.constants.ts](../../../src/config/auth.constants.ts)). Same TTL as the password-reset OTP — kept consistent so client UI can use a single countdown.
- A second `request` overwrites any existing pending change (newest OTP wins). Old OTPs become unusable immediately.

### 2.7 Side Effects (this endpoint)
- **No identifier change yet** — `email` is unchanged on the user document. Only `emailChange` subdoc is populated.
- **No `tokenVersion` bump** — sessions remain valid through Step 1. Bump happens at confirm.
- **Two emails dispatched**: OTP to new, heads-up to old. Delivery is best-effort; failures are logged, not raised.

---

## 3. Request Body
```json
{
  "newEmail": "new.address@example.com",
  "password": "<the user's current password>"
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.post('/me/email-change/request', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `requestEmailChange`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `requestEmailChangeFromDB`
- **Validation**: [src/app/modules/user/user.validation.ts](../../../src/app/modules/user/user.validation.ts) — `UserValidation.requestEmailChangeZodSchema`
- **Templates**: [src/shared/emailTemplate.ts](../../../src/shared/emailTemplate.ts) — `changeEmail`, `emailChangeNotification`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `validateRequest(requestEmailChangeZodSchema)` -> `UserController.requestEmailChange`.

---

## 5. Security
- **No per-route rate limit** is wired today. Future hardening: add a low-cap limiter (e.g., 5 req/hour/user) to slow OTP-spam abuse where an attacker with a stolen token tries dozens of `newEmail` values to harvest existence info from the uniqueness check. The `409` response **does** leak existence; a rate limit + an enumeration-resistant message would close the gap.
- **Password challenge** — defense in depth against stolen-token email hijack.
- **Heads-up notification** — gives the legitimate owner of the OLD email a chance to react before the OTP on the NEW email is verified.
- **No password disclosure** in any response.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'email-change-request'`). A retried call with the same key returns the original `200` without sending a second OTP / heads-up email — important because each duplicate send would otherwise spam the user. See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Verification code sent to the new email. Confirm within the OTP window to complete the change.",
  "data": {
    "newEmail": "new.address@example.com",
    "expireAt": "2026-05-10T18:36:49.649Z",
    "otpTtlSeconds": 180
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
    { "path": "body.newEmail", "message": "Invalid email address" }
  ]
}
```

### Error: Same as current email (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "New email is the same as the current email"
}
```

### Error: Social-login-only account (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Password-less accounts (Google/Apple) cannot change email via this endpoint yet"
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

### Error: Email already in use (409)
*A different active user already owns the requested address.*
```json
{
  "success": false,
  "statusCode": 409,
  "message": "This email is already in use"
}
```

---

## 7. Related Flows

- **Step 2 — confirm with OTP** -> [08-email-change-confirm.md](./08-email-change-confirm.md).
- **Forgot the current password (required by this endpoint)** -> [auth/03-forgot-password.md](../auth/03-forgot-password.md).
- **Read current profile after change** -> [03-get-own-profile.md](./03-get-own-profile.md).
- **Re-login after the change is confirmed** -> [auth/01-login.md](../auth/01-login.md). The new email becomes the login identifier.
