# 10. List My Active Sessions

```http
GET /users/me/sessions
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Lists every device session for the authenticated user. A "session" is one entry in `User.deviceTokens[]` — typically created at login on each device (mobile / tablet / browser). The response returns metadata only: **the raw FCM/APNs push token is never exposed**, only the subdoc id (`tokenId`), `platform`, `appVersion`, and `lastSeenAt`. The client uses `tokenId` to address a specific session in [11-revoke-session.md](./11-revoke-session.md).

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

### 2.5 Returned Fields
For each `deviceTokens[]` entry:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `tokenId` | `string` (24-char hex) \| `null` | Mongoose subdoc `_id`. Use this to address a specific session in [11-revoke-session.md](./11-revoke-session.md). May be `null` for legacy tokens written before the schema added `_id`s to subdocs — those rows will refresh on next login. |
| `tokenPrefix` | `string` (e.g. `"…XYZA12"`) \| `null` | Last 6 chars of the raw push token, for UI display ("the device ending in XYZA12"). Safe to expose. `null` on legacy rows (pre-T1-4 hashing) — UI should fall back to "Device". |
| `platform` | `'ios' \| 'android' \| 'web' \| null` | From the device registration. |
| `appVersion` | `string \| null` | Client-reported version. |
| `userAgent` | `string \| null` | Raw User-Agent header captured on the last credential-issuing call (login / social-login / restore). Lets the UI label sessions like "Mac · Chrome 124". `null` on legacy rows. |
| `lastSeenCity` | `string \| null` | Resolved city / country from the last-seen IP (e.g. `"Chicago, IL"`). `null` when GeoIP is unconfigured or the IP is private / loopback — see [system-concepts.md — Sessions Metadata](../../system-concepts.md#sessions-metadata). |
| `firstSeenAt` | `Date \| null` | First time this device was registered. Lets UI distinguish "active for 2 years" vs "new this morning". |
| `lastSeenAt` | `Date \| null` | Last time this device hit a logged endpoint. |

**Never returned**: the raw push `token` (FCM/APNs credential), the `tokenHash`, or the `lastSeenIpHash`. Both hashes are HMAC-SHA256 keyed by the JWT secret. See [system-concepts.md — Device-Token Storage](../../system-concepts.md#device-token-storage) and [Sessions Metadata](../../system-concepts.md#sessions-metadata).

---

## 3. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.get('/me/sessions', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `listMySessions`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `listMySessionsFromDB`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `UserController.listMySessions`. No `fileHandler`, no `validateRequest`, no `rateLimitMiddleware`.

---

## 4. Security
- **No per-route rate limit** is wired today.
- **Token-version invalidation** applies (see §2.1).
- **No raw push-token disclosure** — see §2.5.
- **Read-only** — no side effects, no DB writes.

---

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Active sessions retrieved.",
  "data": {
    "sessions": [
      {
        "tokenId": "664a1b2c3d4e5f6a7b8c9d0e",
        "tokenPrefix": "…XYZA12",
        "platform": "ios",
        "appVersion": "1.4.0",
        "userAgent": "Tbsosick/1.4.0 CFNetwork/1494.0.7 Darwin/23.4.0",
        "lastSeenCity": "Chicago, IL",
        "firstSeenAt": "2026-04-12T08:11:00.000Z",
        "lastSeenAt": "2026-05-10T18:30:00.000Z"
      },
      {
        "tokenId": "664a1b2c3d4e5f6a7b8c9d0f",
        "tokenPrefix": "…M3N4P5",
        "platform": "android",
        "appVersion": "1.3.2",
        "userAgent": "Tbsosick/1.3.2 Android/14",
        "lastSeenCity": null,
        "firstSeenAt": "2026-05-01T12:00:00.000Z",
        "lastSeenAt": "2026-05-08T14:22:11.000Z"
      }
    ]
  }
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

- **Revoke ONE session** -> [11-revoke-session.md](./11-revoke-session.md).
- **Revoke ALL sessions (logout-all-devices)** -> [12-revoke-all-sessions.md](./12-revoke-all-sessions.md).
- **End the session on the CURRENT device only** -> [auth/06-logout.md](../auth/06-logout.md).
- **Read current profile** -> [03-get-own-profile.md](./03-get-own-profile.md).
