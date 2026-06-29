# 05. Refresh Token (with Reuse Detection)

```http
POST /auth/refresh-token
Content-Type: application/json
Auth: Refresh Token (from httpOnly cookie OR body)
```

> Rotates a refresh token. Verifies the inbound refresh JWT, compares its embedded `tokenVersion` against the DB value (**reuse detection**), bumps the DB `tokenVersion`, and issues a fresh access + refresh pair. If a previously-rotated refresh token is replayed (typical attacker behavior with a stolen token after the legitimate client has already rotated), the version check fails and every JWT for the user is invalidated — the user must log in again.
>
> The refresh token is read from the `httpOnly` cookie by default; the body is a fallback for non-browser clients.

## 2. Business Rules (Source of Truth)

### 2.1 Authentication
- **No `auth` middleware** — the inbound refresh JWT itself is the credential.
- Token source priority: `req.cookies.refreshToken` first, then `req.body.refreshToken` ([auth.controller.ts:139-141](../../../src/app/modules/auth/auth.controller.ts#L139-L141)).
- An empty string in both places -> `400 "Refresh token is required"`.

### 2.2 Refresh-Token Validation Cases
Cited from [auth.service.ts:564-608](../../../src/app/modules/auth/auth.service.ts#L564-L608).

| Condition | Outcome |
| :--- | :--- |
| No token in cookie or body | `400 Bad Request` (`"message": "Refresh token is required"`) |
| `jsonwebtoken` throws `JsonWebTokenError` (bad signature / malformed) | Bubbles up through `globalErrorHandler` — typically `401`. |
| `jsonwebtoken` throws `TokenExpiredError` | Bubbles up through `globalErrorHandler` — typically `401`. |
| Decoded payload's `id` not found in DB | `401 Unauthorized` (`"message": "Invalid refresh token"`) |
| User found but `status === DELETED` | `403 Forbidden` (`"message": "User account is deleted"`) |
| JWT's `tokenVersion !== dbUser.tokenVersion` (**reuse detection**) | `401 Unauthorized` (`"message": "Refresh token expired or already used. Please login again."`) |
| `findByIdAndUpdate` returns null (extremely rare DB race) | `500 Internal Server Error` (`"message": "Failed to rotate token"`) |
| All checks pass | `200 OK` with new tokens, rotated cookie. |

### 2.3 Account Status Rules
- Only `DELETED` is explicitly blocked at this endpoint ([auth.service.ts:585](../../../src/app/modules/auth/auth.service.ts#L585)). Other non-active statuses (`SUSPENDED`, `REJECTED`, etc.) **can refresh** — they were able to obtain a refresh token in the past (before status flipped) and are not actively blocked here. They will be blocked by the auth middleware on the next protected call, however.
- This design is intentional: refresh is a token-rotation step, not an authorization step. The user's *next* request through a protected endpoint will hit the auth middleware's broader status block.

### 2.4 Role-Based Access
Not applicable — the JWT carries the role; no allow-list check at this endpoint.

### 2.5 Input Validation (Zod — `createRefreshTokenZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `refreshToken` (body) | `string` | No | Optional. The validator allows empty body since the refresh token usually rides in the cookie. The controller resolves cookie-vs-body itself. |

### 2.6 Token Rotation (Side Effects)
On all checks passing:
1. **Conditional `$inc`** — `findOneAndUpdate({ _id, tokenVersion: <jwt-version> }, { $inc: { tokenVersion: 1 } })`. The match-on-version clause is the race guard: two parallel valid refreshes both pass the explicit version check earlier, but only the FIRST conditional update matches; the second finds no document and returns null. The null is surfaced as the same `401 "Refresh token expired or already used. Please login again."` that natural reuse-detection produces — semantically correct, since the second client really did use a refresh token that's stale by the time the bump committed.
2. Issue new `accessToken` + `refreshToken` JWTs, both embedding the bumped version.
3. Controller sets the new `refreshToken` as the `httpOnly` cookie (production: `secure`, `sameSite: 'lax'`).
4. Response body returns `{ accessToken, refreshToken }`.

### 2.7 Why `tokenVersion` is bumped on every rotation
A naive refresh design just verifies-and-reissues without bumping. That leaves stolen refresh tokens viable as long as they're valid. By bumping on every rotation, only the **most recent** refresh token works; any earlier one is permanently dead — and a replay of an earlier token triggers the reuse-detection 401 that should prompt the client to re-authenticate.

### 2.8 Rate Limit
- **20 requests / minute / IP**, identified by `routeName: 'auth:refresh'` ([auth.route.ts](../../../src/app/modules/auth/auth.route.ts)). Higher than login (10/min) because well-behaved clients refresh automatically in the background.
- On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).

---

## 3. Request Body
Either send the token in the `refreshToken` cookie (preferred), or in the body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Empty body (`{}`) is accepted as long as the cookie is present.

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/refresh-token', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `refreshToken`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `refreshTokenToDB`
- **Validation**: [src/app/modules/auth/auth.validation.ts](../../../src/app/modules/auth/auth.validation.ts) — `AuthValidation.createRefreshTokenZodSchema`

**Middleware order**: `refreshTokenRateLimit` -> `validateRequest(createRefreshTokenZodSchema)` -> `AuthController.refreshToken`.

---

## 5. Security
- **Reuse detection** via `tokenVersion`: replaying a stolen / already-rotated refresh token fails with a distinctive 401 message that the client should treat as "force the user to log in again, this session may be compromised".
- **Every successful rotation bumps the version**, invalidating the just-used refresh token. There is no concept of a long-lived non-rotating refresh.
- **Rate limit**: 20/min/IP (see §2.8).
- **Refresh-token cookie**: `httpOnly`, `secure` in production, `sameSite: 'lax'`. Body fallback exists for non-browser clients.
- **DELETED accounts blocked** — see §2.3.

---

## 6. Responses

### Success (200) — rotation applied
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Error: Refresh token required (400)
*No token in cookie or body.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Refresh token is required"
}
```

### Error: Invalid refresh token (401)
*JWT decoded successfully but its `id` does not match any user (account purged or token tampered).*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid refresh token"
}
```

### Error: Token reuse detected / expired (401)
*JWT's `tokenVersion` no longer matches DB. Either an attacker replayed an old token after the legitimate client rotated, OR the user's `tokenVersion` was bumped server-side (password reset, change-password, restore-account, logout-all-devices).*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Refresh token expired or already used. Please login again."
}
```

### Error: User account is deleted (403)
*User in the token is soft-deleted. Restoration path: [10-restore-account.md](./10-restore-account.md).*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "User account is deleted"
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

- **Triggered when the access token returns `401`** during normal protected-route use. Most clients run refresh in the background and retry the original request.
- **The user must log back in** if this endpoint returns the reuse-detection 401 -> [01-login.md](./01-login.md).
- **Restore a soft-deleted account** if 403 fires -> [10-restore-account.md](./10-restore-account.md).
- **Sign in fresh after global logout** -> [01-login.md](./01-login.md) (or [08-social-login.md](./08-social-login.md)).
- **Project-wide tokenVersion policy** -> [system-concepts.md](../../system-concepts.md#token-version-invalidation-policy).
