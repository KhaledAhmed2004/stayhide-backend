# 06. Logout (Single Device)

```http
POST /auth/logout
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN, ADMIN, BROTHER, SISTER, JUMMAH)
```

> Ends the **current device's** push session and clears the `refreshToken` browser cookie. Removes the supplied `deviceToken` from the user's `deviceTokens[]` array so the device stops receiving FCM/APNs notifications. **Does NOT bump `tokenVersion`** — the JWT itself remains valid until natural expiry (short-lived access token; refresh-token flow will continue to work on this device until the user logs back in elsewhere). To globally invalidate every session on every device, use [user/12-revoke-all-sessions.md](../user/12-revoke-all-sessions.md) (bumps `tokenVersion`).
>
> This is a per-device logout — typical "sign out on this phone" button behavior.

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

A non-active user calling logout is an unusual case (the auth middleware will probably block them before they can call this) but the table is included for completeness.

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `ADMIN`, `BROTHER`, `SISTER`, `JUMMAH` ([auth.route.ts:50](../../../src/app/modules/auth/auth.route.ts#L50)).
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation
- **No Zod schema** is attached to this route. `deviceToken` is optional in the body.

### 2.5 Service-Level Behavior
1. If `deviceToken` is **omitted**, the service returns early (no-op). The controller still clears the `refreshToken` cookie — a client that lost / never registered its push token can still end its session cleanly.
2. If `deviceToken` is **supplied**, `User.removeDeviceToken(user.id, deviceToken)` pulls the matching entry from `deviceTokens[]`. No error if the token wasn't present.
3. Controller clears the `refreshToken` cookie in every successful case.

### 2.6 Side Effects
- The targeted device stops receiving push notifications immediately.
- The `refreshToken` cookie is wiped on the response.
- **`tokenVersion` is NOT bumped.** The access token still works on this device until expiry — but with the refresh-token cookie gone, the client can no longer extend its session naturally. For true global invalidation use [user/12-revoke-all-sessions.md](../user/12-revoke-all-sessions.md).

---

## 3. Request Body
`deviceToken` is optional. Send it to stop push delivery to a specific device; omit it to just end the current cookie session.

```json
{
  "deviceToken": "fcm-or-apns-token-of-this-device"
}
```

Or, for a session-only logout:
```json
{}
```

---

## 4. Implementation
- **Route**: [src/app/modules/auth/auth.route.ts](../../../src/app/modules/auth/auth.route.ts) — `router.post('/logout', ...)`
- **Controller**: [src/app/modules/auth/auth.controller.ts](../../../src/app/modules/auth/auth.controller.ts) — `logoutUser`
- **Service**: [src/app/modules/auth/auth.service.ts](../../../src/app/modules/auth/auth.service.ts) — `logoutUserFromDB`

**Middleware order**: `auth(SUPER_ADMIN, ADMIN, BROTHER, SISTER, JUMMAH)` -> `AuthController.logoutUser`. No `validateRequest`, no `rateLimitMiddleware`.

---

## 5. Security
- **No per-route rate limit** — protected routes are implicitly protected by auth.
- **Token-version invalidation** applies (see §2.1).
- **JWT not invalidated** by this endpoint by design — see §2.6. For "I lost my phone" use [user/12-revoke-all-sessions.md](../user/12-revoke-all-sessions.md).
- **No leak about whether deviceToken existed** — `removeDeviceToken` is silent on non-match.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged out successfully."
}
```

### Error: Unauthorized (401)
*Any auth-middleware failure case (see §2.1). Example for missing token:*
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

- **Log this device back in** -> [01-login.md](./01-login.md).
- **Revoke a specific OTHER device** -> [user/11-revoke-session.md](../user/11-revoke-session.md).
- **Log out of every device (bumps tokenVersion)** -> [user/12-revoke-all-sessions.md](../user/12-revoke-all-sessions.md).
- **List active sessions** -> [user/10-list-sessions.md](../user/10-list-sessions.md).
