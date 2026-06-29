# 11. Revoke One Session

```http
DELETE /users/me/sessions/:tokenId
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Removes **one** specific device session from the authenticated user's `deviceTokens[]`. The device stops receiving push notifications immediately. The JWT issued to that device **remains valid until natural expiry** — `tokenVersion` is intentionally not bumped (bumping it would invalidate every session, not just this one). For a true "logout this device, invalidate its token now" use [auth/06-logout.md](../auth/06-logout.md) **on the device itself**, or use [12-revoke-all-sessions.md](./12-revoke-all-sessions.md) to nuke everything.

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

### 2.4 Input Validation (Zod — `revokeSessionZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `params.tokenId` | `string` | Yes | Must match `^[0-9a-fA-F]{24}$` (24-char hex MongoDB ObjectId). Invalid -> `400` (`"message": "Invalid Token ID format"`). Missing -> `400` (`"message": "Token ID is required"`). |

### 2.5 Service-Level Behavior
1. `User.findByIdAndUpdate(me, { $pull: { deviceTokens: { _id: tokenId } } }, { new: true })`.
2. If the updated user is missing -> `404` (`"User doesn't exist!"`).
3. If the `tokenId` still appears in the returned array (defensive) -> `404` (`"Session not found"`). In practice `$pull` either removed it or never matched; the defensive check catches edge cases.
4. **`tokenVersion` is NOT bumped.** Only `deviceTokens` is mutated.

### 2.6 Side Effects
- Push delivery to that device stops immediately.
- The device's JWT still works for normal API calls until it expires (short-lived access token; refresh-token rotation will fail because the device-token entry is gone, but only if the refresh flow checks deviceTokens — currently it does not).
- No effect on other sessions.

---

## 3. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.delete('/me/sessions/:tokenId', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `revokeMySession`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `revokeMySessionFromDB`
- **Validation**: [src/app/modules/user/user.validation.ts](../../../src/app/modules/user/user.validation.ts) — `UserValidation.revokeSessionZodSchema`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `validateRequest(revokeSessionZodSchema)` -> `UserController.revokeMySession`. Comes AFTER the fixed `/me/sessions/revoke-all` route in the file so Express doesn't match `revoke-all` as a `:tokenId`.

---

## 4. Security
- **Cannot revoke another user's session** — the service scopes to `req.user.id`. Even with a valid `tokenId` from another user's account, `$pull` will not match because the targeted user is the caller's own.
- **Token-version invalidation** applies (see §2.1).
- **No information leak** — invalid `tokenId` and "not your token" both surface as `404 "Session not found"`.

---

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Session revoked.",
  "data": {
    "tokenId": "664a1b2c3d4e5f6a7b8c9d0e"
  }
}
```

### Error: Invalid Token ID format (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "params.tokenId", "message": "Invalid Token ID format" }
  ]
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

### Error: Session not found (404)
*The `tokenId` is well-formed but doesn't match any of this user's `deviceTokens`.*
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Session not found"
}
```

---

## 6. Related Flows

- **List sessions first to get a `tokenId`** -> [10-list-sessions.md](./10-list-sessions.md).
- **Revoke ALL sessions (logout-all-devices)** -> [12-revoke-all-sessions.md](./12-revoke-all-sessions.md).
- **End the session on the CURRENT device** -> [auth/06-logout.md](../auth/06-logout.md).
