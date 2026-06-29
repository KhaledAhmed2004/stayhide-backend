# 01. Create User (Registration / Admin Create)

```http
POST /users
Content-Type: multipart/form-data
Auth: None (Public Registration) | Bearer {{accessToken}} (SUPER_ADMIN create)
```

> Single endpoint for both **public mobile registration** (`BROTHER` / `SISTER` / `JUMMAH`) and **administrative account creation** (`SUPER_ADMIN`). The difference is detected at the controller level: if a valid `Bearer` token belonging to a `SUPER_ADMIN` is supplied, the request is treated as admin creation; otherwise it is public registration. There is **no `auth` middleware** on this route — the JWT is inspected inline. Any token error silently falls back to public registration.

## 1. Business Rules (Source of Truth)

### 2.1 Authentication Rules
This route does **not** mount the `auth` middleware. The 9 standard auth-failure cases (missing token, malformed header, expired token, etc.) **do not apply** here.

- **No token / invalid token / expired token / role != SUPER_ADMIN** -> request silently proceeds as **public registration** (`isAdmin = false`).
- **Valid `Bearer` token with role `SUPER_ADMIN`** -> request is treated as **admin creation** (`isAdmin = true`).

### 2.2 Email Uniqueness & Pending-Account Cleanup
- **Case-insensitive** — emails are normalized to lowercase by the Zod validator (`.toLowerCase()`) before any lookup or persistence. `User@Example.com` and `user@example.com` are treated as the same address. The user model also enforces `lowercase: true` as a defense-in-depth.
- **Globally unique** — email is checked against all users before insert.
- **Verified conflict**: if a verified user already owns the email -> `409 Conflict` (`"message": "Email already registered"`).
- **Pending account < 24h old**: `409 Conflict` (`"message": "Email already registered and pending verification"`). Client should offer "Resend OTP".
- **Pending account > 24h old**: the stale record is deleted in the same transaction and the new one is created.

### 2.3 Password Requirements (Public Registration)
Enforced by `createUserZodSchema.superRefine` when neither `googleId` nor `appleId` is provided.

- Required when `googleId` and `appleId` are both absent.
- Regex: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/`
    - Min 8 characters
    - At least 1 lowercase letter
    - At least 1 uppercase letter
    - At least 1 digit
    - At least 1 special character
- **Password history**: registration starts with an empty `passwordHistory`. The current password isn't "previous" yet — history populates on the first change/reset. See [system-concepts.md — Password Policy](../../system-concepts.md#password-policy).

### 2.4 Role Assignment (RBAC)
- The Zod schema accepts `role` as `BROTHER | SISTER | JUMMAH` — `SUPER_ADMIN` cannot be supplied through this route's body.
- Admin path forces `isVerified: true` and `status: ACTIVE` server-side regardless of body.
- Public path forces `isVerified: false` and `status: PENDING`.
- **Workflow**:
    - **BROTHER / SISTER**: Creation (`PENDING`) -> OTP Verification (`isVerified: true`, status stays `PENDING`) -> Admin Approval (`ACTIVE`).
    - **JUMMAH**: Creation (`PENDING`) -> OTP Verification (`isVerified: true`, status auto-activated to `ACTIVE`).

### 2.5 File Handling
File upload is processed by `fileHandler` **before** validation, with an explicit override for this route: `{ maxFileSizeMB: 100 }`.

- **Fields** (each `maxCount: 1`):
    - `profileImage` -> `users/profiles`
    - `verificationImage` -> `users/verifications`
    - `verificationVideo` -> `users/videos`
- **Per-file size cap**: 100 MB (overrides the global 10 MB default).
- **Allowed MIME types**:
    - Images: `image/jpeg`, `image/png`, `image/jpg`, `image/webp`
    - Videos: `video/mp4`, `video/webm`
- **File-validity rules** for the **public** path:
    - **BROTHER / SISTER**: `profileImage` required (image), `verificationImage` required (image), `verificationVideo` required (video).
    - **JUMMAH**: These files are **optional**; only `name`, `email`, `password`, and `dateOfBirth` are required.
- **Admin path**: all three are optional. The schema marks them optional and the service does not enforce them when `isAdmin === true`.
- **Image processing**: 800px-width resize, PNG palette-compressed level 8, JPEG/WebP quality 80.
- **Multer error mapping** (all -> `400 Bad Request`):
    - `LIMIT_FILE_SIZE` -> `"File too large for field 'X'. Max 100 MB."`
    - `LIMIT_UNEXPECTED_FILE` -> `"Unexpected file field 'X'."`
    - Wrong MIME -> `"Invalid file type 'X'. Allowed for Y: [list]"` or `"Unsupported file type 'X'"`

### 2.6 Input Validation (Zod — `createUserZodSchema`)
The body schema is `.strict()` — extra fields cause a `400 Bad Request`.

| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | min length 1 |
| `email` | `string` | Yes | valid email format |
| `role` | `enum` | Yes | `BROTHER`, `SISTER`, or `JUMMAH` |
| `revertDate` | `string` | Conditional | Required only for `BROTHER` and `SISTER`. |
| `dateOfBirth` | `string` | Yes | full ISO 8601 timestamp, computed age must be `>= 16` |
| `password` | `string` | Conditional | required if `googleId`/`appleId` absent; must match regex above |
| `profileImage` | `string` | No (set by fileHandler) | — |
| `verificationImage` | `string` | Conditional | Required only for `BROTHER` and `SISTER` (in public path). |
| `verificationVideo` | `string` | Conditional | Required only for `BROTHER` and `SISTER` (in public path). |
| `googleId` | `string` | No | — |
| `appleId` | `string` | No | — |
| `aboutMe` | `string` | No | Short biography or intro |
| `revertStory` | `string` | No | Personal story of converting to Islam |
| `interests` | `string[]` | No | Array of strings (tags) |
| `captchaToken` | `string` | Required in prod (when `TURNSTILE_SECRET` env is set) | Cloudflare Turnstile token from the client widget. Verified server-side. Optional in dev (env unset). |

### 2.7 Atomicity (Mongoose Session)
The whole flow runs inside a Mongoose transaction (`session.startTransaction`):
1. Email lookup (with session)
2. Stale-pending cleanup (`findByIdAndDelete` with session)
3. `User.create` (with session)
4. Public path only: `sendVerificationOTP(email, session)`
5. `commitTransaction`

If any step throws, `abortTransaction` runs and the user record is rolled back. OTP delivery failure aborts the user creation.

### 2.8 OTP Rules (Public Registration Only)
- **Expiration**: 10 minutes (controlled by `sendVerificationOTP` / `authHelpers`).
- **Resend cooldown**: 60 seconds.
- **Max daily resends**: 5.
- **Max verification attempts**: 5 per OTP.

---

## 3. Status Lifecycle

| Status | Meaning | Can Login? |
| :--- | :--- | :--- |
| `PENDING` | Registered but email not verified. | No |
| `ACTIVE` | Email verified and approved by admin. | Yes |
| `SUSPENDED` | Temporarily blocked for rules violation. | No |
| `RESTRICTED` | Account access revoked (auth-blocked at middleware). | No |
| `REJECTED` | Verification video/ID rejected by admin. | No |
| `INACTIVE` | Inactive account. | No |
| `DELETED` | Account marked for deletion (soft-delete). | No |

> Note: the `USER_STATUS.DELETED` enum maps to the string `'DELETE'` internally — see [src/enums/user.ts](file:///src/enums/user.ts). Client/UI code should always go through the enum name.

---

## 4. Storage Strategy
Files persisted under `/uploads` with route-defined subfolders:
- `/uploads/users/profiles/`
- `/uploads/users/verifications/`
- `/uploads/users/videos/`

**Naming**: filenames are sanitized (no traversal), prefixed with timestamp + random string.

**Default profile image** — when a user is created without uploading a `profileImage`, the model assigns the self-hosted SVG at `/default-avatar.svg` (file in [public/default-avatar.svg](../../../public/default-avatar.svg), served by `app.use(express.static('public'))` in [src/app.ts](../../../src/app.ts)). The path is relative — clients resolve against `{{baseUrl}}`. SVG is lightweight, scalable, and removes the previous third-party CDN dependency on `i.ibb.co`. To customize the avatar, replace the SVG file in `public/` (no schema or code change needed).

---

## 5. Request Body (Form-Data)

| Field | Type | Required (Public) | Required (Admin) | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | Yes | The user's full legal name as it should appear on their profile. | `Jane Doe` |
| `email` | `string` | Yes | Yes | Primary email address. Must be globally unique and valid. | `jane@example.com` |
| `password` | `string` | Yes (if no `googleId`/`appleId`) | Yes (if no `googleId`/`appleId`) | Account password. Must be 8+ chars with mixed case, digit, and special char. | `StrongPassword123!` |
| `role` | `enum` | Yes (`BROTHER`/`SISTER`/`JUMMAH`) | Yes (`BROTHER`/`SISTER`/`JUMMAH`) | User role. Limited to `BROTHER`, `SISTER`, or `JUMMAH` during public registration. | `SISTER` |
| `revertDate` | `string` | Conditional | Yes | The date the user converted to Islam in Full ISO 8601 format. Required only for `BROTHER` and `SISTER`. | `2024-05-11T00:00:00.000Z` |
| `dateOfBirth` | `string` | Yes | Yes | User's birth date in Full ISO 8601 format. Must be 16+ years old. | `1995-05-15T00:00:00.000Z` |
| `googleId` | `string` | No | No | Optional OAuth ID from Google. | `1234567890` |
| `appleId` | `string` | No | No | Optional OAuth ID from Apple. | `000123.abc.0987` |
| `profileImage` | `file` | No (Conditional) | No | Profile photo upload (multipart). Optional for `JUMMAH`. | — |
| `verificationImage` | `file` | Conditional | No | Government ID or proof image for admin verification. Required only for `BROTHER` and `SISTER`. | — |
| `verificationVideo` | `file` | Conditional | No | Short face-verification video for admin review. Required only for `BROTHER` and `SISTER`. | — |
| `aboutMe` | `string` | No | No | A short biography or intro about the user. | `I am a teacher...` |
| `revertStory` | `string` | No | No | The user's personal story of converting to Islam. | `I found Islam through...` |
| `interests` | `array` | No | No | Array of strings representing user interests. | `["Quran", "Arabic"]` |

---

## 6. Implementation
- **Route**: [src/app/modules/user/user.route.ts](file:///src/app/modules/user/user.route.ts) — `router.post('/', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `createUser`
- **Service**: [src/app/modules/user/user.service.ts](file:///src/app/modules/user/user.service.ts) — `createUserToDB`
- **Validation**: [src/app/modules/user/user.validation.ts](file:///src/app/modules/user/user.validation.ts) — `UserValidation.createUserZodSchema`

**Middleware order**: `idempotency('registration')` -> `fileHandler([...], { maxFileSizeMB: 100 })` -> `validateRequest(createUserZodSchema)` -> `UserController.createUser`.

The controller inspects `req.headers.authorization` itself; only a valid `Bearer` JWT with role `SUPER_ADMIN` flips the service into admin mode (`isAdmin = true`).

---

## 7. Security
- **Idempotency**: `idempotency('registration')` prevents double-submission of the same registration request.
- **CAPTCHA (Cloudflare Turnstile)**: when the `TURNSTILE_SECRET` env var is set, the [verifyCaptcha](../../../src/app/middlewares/captcha.ts) middleware verifies the client-supplied `captchaToken` against Cloudflare's `/siteverify` endpoint. Token must accompany every registration request. Failed verification -> `401 Unauthorized` (`"message": "Captcha verification failed. Please try again."`). When the env is unset (dev), the middleware no-ops — devs can register without setting up a Cloudflare account, but **production deployments MUST set the env to activate bot protection**. Client-side: render the Turnstile widget on the register screen and send its token as `captchaToken` in the multipart body.
- **MIME validation**: enforced against file headers (not just extensions).
- **Rate limit**: None (Public Registration / Admin Create).
- **Admin bypass**: valid `SUPER_ADMIN` tokens bypass public registration rules.
- **Path sanitization**: filenames sanitized to prevent directory traversal.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'registration'`). See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency) for the full contract.

---

## 8. Responses

### Success — Public Registration (201)
*The controller returns the same message for both flows; `status` and `isVerified` differ.*
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User created successfully. Please verify your email with the OTP sent.",
  "data": {
    "email": "user@example.com",
    "isVerified": false,
    "status": "PENDING"
  }
}
```

### Success — Admin Creation (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User created successfully. Please verify your email with the OTP sent.",
  "data": {
    "email": "new_admin@example.com",
    "isVerified": true,
    "status": "ACTIVE"
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
    { "path": "body.password", "message": "Password must include upper, lower, number, special and be 8+ chars" },
    { "path": "body.revertDate", "message": "Invalid date: 2024-05-11T00:00:00.000Z" },
    { "path": "body.dateOfBirth", "message": "Minimum age is 16 years based on 1995-05-15T00:00:00.000Z" }
  ]
}
```

### Error: File too large (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "File too large for field 'verificationVideo'. Max 100 MB."
}
```

### Error: Unsupported file type (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid file type 'application/pdf'. Allowed for images: image/jpeg, image/png, image/jpg, image/webp"
}
```

### Error: User-create failure (400)
*Internal — only fires if `User.create` returns falsy after the transaction.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Failed to create user"
}
```

### Error: Captcha verification failed (401)
*Only fires when `TURNSTILE_SECRET` is configured. Token was missing, expired, malformed, or rejected by Cloudflare.*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Captcha verification failed. Please try again."
}
```

### Error: Email already registered (409)
*Verified user owns the email.*
```json
{
  "success": false,
  "statusCode": 409,
  "message": "Email already registered"
}
```

### Error: Email pending verification (409)
*Pending user owns the email and was created less than 24 hours ago.*
```json
{
  "success": false,
  "statusCode": 409,
  "message": "Email already registered and pending verification"
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

## 9. Related Flows

- **After successful public registration** -> verify the OTP sent to the user's email: [auth/02-verify-otp.md](../auth/02-verify-otp.md). Successful verification flips `status: PENDING -> ACTIVE`.
- **OTP not received / expired** -> request a fresh one: [auth/07-resend-otp.md](../auth/07-resend-otp.md).
- **Alternative registration path** (no password, no OTP) -> [auth/08-social-login.md](../auth/08-social-login.md).
- **First sign-in after verification** -> [auth/01-login.md](../auth/01-login.md).
```
