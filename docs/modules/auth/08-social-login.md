# 08. Social Login (Google / Apple)

```http
POST /auth/social-login
Content-Type: application/json
Auth: None (Public — provider ID token validated inline)
```

> Unified sign-in / sign-up via Google or Apple ID tokens. Verifies the provider-issued JWT cryptographically (Google: RSA against `googleAudience` array of iOS/Android/Web client IDs; Apple: RSA + nonce-hash match), then either logs an existing user in (matched strictly by `googleId` / `appleId`) or creates a new account. Refuses to auto-link a provider identity to an existing email-based account — that's an OWASP-flagged account-hijack vector. Returns the same `{ accessToken, refreshToken }` envelope as [01-login.md](./01-login.md).

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **Public route** — no `auth` middleware. The provider ID token is the credential.
- Provider field used for user lookup: `googleId` if `provider === 'google'`, `appleId` if `provider === 'apple'`.

### 2.2 Account Status Rules (for existing users)
Mirrors [01-login.md](./01-login.md) §2.2 exactly — both sign-in surfaces produce uniform status-specific messages. Behavior verified at [auth.service.ts](../../../src/app/modules/auth/auth.service.ts) (`socialLoginToDB` status block).

| Status | Outcome |
| :--- | :--- |
| `ACTIVE` (social-login auto-sets `isVerified: true` on creation) | Allowed — tokens issued. |
| `PENDING` (and `isVerified = false`) | `403 Forbidden` (`"message": "Your account is pending verification. Please verify your email."`). |
| `PENDING` (and `isVerified = true`) | `403 Forbidden` (`"message": "Admin Verification Pending. Your account is currently under review."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Your account was rejected."`). Re-submit via [user/13-reverify-account.md](../user/13-reverify-account.md). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Your account has been suspended."`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Your account is restricted. Contact support."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Your account is inactive. Please activate it or contact support."`). |
| `DELETED` | `403 Forbidden` (`"message": "Your account has been deleted. Contact support."`). Recoverable within 30 days via [10-restore-account.md](./10-restore-account.md). |

### 2.3 Role-Based Access
Not applicable — public endpoint.

### 2.4 Input Validation (Zod — `createSocialLoginZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `provider` | `enum` | Yes | `'google'` or `'apple'`. |
| `idToken` | `string` | Yes | Provider's signed ID token. |
| `nonce` | `string` | Conditional | If supplied, min 32 characters. Required for Apple at the service layer (see §2.5). Optional for Google. |
| `deviceToken` | `string` | No | If supplied, registered to the user post-login via `User.addDeviceToken`. |
| `platform` | `enum` | No | `'ios'`, `'android'`, or `'web'`. Stored with `deviceToken` for session list/revoke flows. |
| `appVersion` | `string` | No | Stored with `deviceToken`. |

Schema violations -> `400 Bad Request` from `validateRequest`.

### 2.5 Provider Verification

#### 2.5a Google
1. `googleClient.verifyIdToken({ idToken, audience: googleAudience })` — `audience` is an array of all configured client IDs (iOS, Android, Web).
2. If `tokenPayload || tokenPayload.email` is missing -> `401 "Invalid Google ID token"`.
3. If `tokenPayload.email_verified !== true` -> `401 "Google account email is not verified"`. Prevents an attacker minting tokens for arbitrary unverified addresses.
4. If `nonce` was provided in the request AND `tokenPayload.nonce !== nonce` -> `401 "Nonce mismatch"`. Only enforced when client sends a nonce (Flutter's plugin doesn't expose nonce).

#### 2.5b Apple
1. **`nonce` is mandatory** at the service layer ([auth.service.ts:434-438](../../../src/app/modules/auth/auth.service.ts#L434-L438)). Missing -> `400 "Nonce is required for Apple sign-in"`.
2. `appleSignin.verifyIdToken(idToken, { audience: APPLE_CLIENT_ID, ignoreExpiration: false })`.
3. If `applePayload.sub` is missing -> `401 "Invalid Apple ID token"`.
4. Apple stores `SHA256(nonce)` in the token. Compute `sha256(raw nonce)` and compare. Mismatch -> `401 "Nonce mismatch"`.

### 2.6 User Resolution & Account Creation
1. Match by `providerField: providerId` (NEVER by email — see §5).
2. **Existing user**: run §2.2 status checks. If pass, register `deviceToken` (if supplied), issue tokens.
3. **No existing user**:
    - If `email` is present in the provider token: `User.findOne({ email })` — if matched -> `409 Conflict` (`"message": "An account with this email already exists. Please sign in with your password and link your social account from settings."`). No auto-linking.
    - If `email` is missing (Apple sign-in where user hides email beyond the first time) -> `400 Bad Request` (`"message": "Email is required to create an account. Please allow email sharing."`).
    - Otherwise create: `{ name, email, verified: true, [providerField]: providerId }`. Re-fetch with `+tokenVersion`. If re-fetch fails -> `500 "Failed to create user"`.
4. Register `deviceToken` (if supplied).
5. Issue `accessToken` + `refreshToken` (both carry `tokenVersion`).
6. Controller sets `refreshToken` as the `httpOnly` cookie.

### 2.7 Rate Limit
- **10 requests / minute / IP**, identified by `routeName: 'auth:social-login'` ([auth.route.ts:19-23](../../../src/app/modules/auth/auth.route.ts#L19-L23)). Same cap as email-password login.
- On exceed -> `429 Too Many Requests`.

---

## 3. Request Body
```json
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "nonce": "aB3xK9mP2qR7sL4nT6vY8wXcZ1uV5oM0jE",
  "deviceToken": "fcm-token-optional",
  "platform": "ios",
  "appVersion": "1.4.0"
}
```

For Apple, `nonce` is required (min 32 chars). For Google, `nonce` is optional (Flutter SDK constraint).

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/social-login', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `socialLogin`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `socialLoginToDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createSocialLoginZodSchema`

**Middleware order**: `socialLoginRateLimit` -> `validateRequest(createSocialLoginZodSchema)` -> `AuthController.socialLogin`.

---

## 5. Security
- **No email-based auto-linking**: matching is strictly by `googleId` / `appleId`. If an attacker creates a Google account at the legitimate user's email, they cannot use this endpoint to hijack the existing password-based account — the 409 conflict response forces them to log in with the password first and link explicitly.
- **`email_verified` check (Google)** prevents minting tokens for arbitrary unverified addresses.
- **Nonce replay protection (Apple required, Google optional)**: Apple stores `SHA256(nonce)` in the token; service verifies `sha256(req.body.nonce) === payload.nonce`.
- **Provider ID-token expiry**: `appleSignin` is configured with `ignoreExpiration: false`; Google's `verifyIdToken` enforces expiry by default.
- **Rate limit**: 10/min/IP (see §2.7).
- **Full account-status block** matches [01-login.md](./01-login.md): every non-ACTIVE status produces its specific 403 message at this endpoint. No status leaks through to the protected-route auth middleware.

---

## 6. Responses

### Success (200) — login or first-time signup
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
    { "path": "body.provider", "message": "Provider is required" }
  ]
}
```

### Error: Apple nonce missing (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Nonce is required for Apple sign-in"
}
```

### Error: Email required (400)
*Apple sign-in where the user hid their email beyond first connect and we don't have it cached.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Email is required to create an account. Please allow email sharing."
}
```

### Error: Invalid Google ID token (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid Google ID token"
}
```

### Error: Google email not verified (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Google account email is not verified"
}
```

### Error: Invalid Apple ID token (401)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid Apple ID token"
}
```

### Error: Nonce mismatch (401)
*Either provider — request-supplied nonce did not match what the provider echoed in the ID token.*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Nonce mismatch"
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

### Error: Email already exists on a different account (409)
*The provider's email matches an existing password-based account that has no `googleId`/`appleId` set. No auto-linking — the user must sign in with their password first, then link from settings (settings flow not yet built).*
```json
{
  "success": false,
  "statusCode": 409,
  "message": "An account with this email already exists. Please sign in with your password and link your social account from settings."
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

### Error: Failed to create user (500)
*Race condition where the freshly-created user vanished before the re-fetch with `+tokenVersion`. Should never happen in normal operation.*
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Failed to create user"
}
```

---

## 7. Related Flows

- **Email-password sign-in instead** -> [01-login.md](./01-login.md).
- **Restore a soft-deleted account before retrying social-login** -> [10-restore-account.md](./10-restore-account.md).
- **Account exists with password — sign in there first, then link social from settings (flow not yet built)** -> [01-login.md](./01-login.md).
- **Refresh the access token** -> [05-refresh-token.md](./05-refresh-token.md).
- **End the current device's session** -> [06-logout.md](./06-logout.md).
- **Complete onboarding after first signup** -> [user/05-complete-onboarding.md](../user/05-complete-onboarding.md).
