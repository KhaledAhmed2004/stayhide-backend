# 12. Revoke All Sessions (Logout All Devices)

```http
POST /users/me/sessions/revoke-all
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Nukes every device session for the authenticated user — clears `deviceTokens[]` entirely **and** bumps `tokenVersion`. Every JWT this user holds (including the one used to call this endpoint) becomes invalid on the next request. The classic "log me out everywhere" / "I lost my phone" button.
>
> This is **the only user-callable mechanism** to invalidate every active JWT. Password reset and password change also bump `tokenVersion` (see [system-concepts.md — Token-Version Invalidation Policy](../../system-concepts.md#token-version-invalidation-policy)).

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
| `PENDING` | Allowed. |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation
- **No request body, no params, no query.** No Zod schema is attached.

### 2.5 Service-Level Behavior
Single update:
```ts
User.findByIdAndUpdate(me, {
  $set: { deviceTokens: [] },
  $inc: { tokenVersion: 1 },
}, { new: true });
```

If user is missing -> `404` (`"User doesn't exist!"`). Otherwise success.

### 2.6 Side Effects
- All entries in `deviceTokens[]` are removed — push delivery stops on every device.
- `tokenVersion` is incremented by 1 — every JWT (access + refresh) issued under the previous value is rejected by the auth middleware's tokenVersion check on the very next request.
- The controller clears the `refreshToken` cookie on the browser making the request, so the current tab can't retry with a now-invalid refresh token.
- **The user must log in again on every device** they want to use.

---

## 3. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.post('/me/sessions/revoke-all', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `revokeAllMySessions`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `revokeAllMySessionsFromDB`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `UserController.revokeAllMySessions`. No `validateRequest`, no `rateLimitMiddleware`.

Declared **before** `DELETE /me/sessions/:tokenId` in the route file so Express matches `revoke-all` as a fixed path rather than interpreting it as a `:tokenId` value.

---

## 4. Security
- **No per-route rate limit** is wired today.
- **`tokenVersion` bumped** — this is the policy-approved trigger for global session invalidation; see [system-concepts.md — Token-Version Invalidation Policy](../../system-concepts.md#token-version-invalidation-policy).
- **Refresh cookie cleared** by the controller.
- **Cannot affect another user** — service scopes to `req.user.id`.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'sessions-revoke-all'`). A retried call with the same key returns the original `200` without re-bumping `tokenVersion` (which would otherwise be a confusing double-bump). See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "All sessions revoked. Please log in again.",
  "data": {
    "revokedAt": "2026-05-10T18:36:49.649Z"
  }
}
```

### Error: Unauthorized (401)
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

### Error: User doesn't exist (404)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "User doesn't exist!"
}
```

---

## 6. Related Flows

- **List sessions before revoking** -> [10-list-sessions.md](./10-list-sessions.md).
- **Revoke ONE specific session** -> [11-revoke-session.md](./11-revoke-session.md).
- **Log back in after revoking** -> [auth/01-login.md](../auth/01-login.md).
- **Project-wide tokenVersion policy** -> [system-concepts.md](../../system-concepts.md#token-version-invalidation-policy).
