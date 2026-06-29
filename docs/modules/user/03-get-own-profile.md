# 03. Get Own Profile

```http
GET /users/me
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Returns the **full** profile of the currently authenticated user, including private fields hidden from the public endpoint. Read-only — no DB writes, no side effects.

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
Checked after the DB lookup in the auth middleware. **`DELETED` returns 403, not 404** — the auth middleware short-circuits before the service ever runs.

| Status | Outcome |
| :--- | :--- |
| `ACTIVE` | Allowed. |
| `PENDING` | Allowed. The endpoint is intentionally usable for pending users so the app can show "verification in progress". |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

> The codebase does not define a `BANNED` status. Do not document `BANNED`.

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation
- **No request body, no params, no query.** No Zod schema is attached.

### 2.5 Read-Path Optimization
- **Lean read**: the service uses `.lean()` so the Mongoose document is returned as a plain object (no save methods, no virtuals).
- **Field selection**: `.select('-password -authentication -tokenVersion -deviceTokens -deletedAt')` — these five fields are guaranteed to never appear in the response.

### 2.6 Service-Level Existence Check
The auth middleware already throws `401 "User no longer exists"` if the JWT user is missing in DB. The service check (`if (!isExistUser) throw ApiError(404, "User doesn't exist!")`) is only reachable in a race where the user is deleted between the auth lookup and the service lookup. Documented for completeness.

---

## 3. Response Fields

### Returned (Owner-Only)
All User document fields **except** the excluded list below. Notably included:
- `_id`, `name`, `email`, `role`
- `dateOfBirth`, `revertDate`
- `profileImage`, `verificationImage`, `verificationVideo` (owner can review their own submission)
- `aboutMe`, `revertStory`, `interests`
- `location` (full nested object: `country`, `city`, `coordinates`)
- `isVerified`
- `status`
- `googleId`, `appleId` (if present)
- `createdAt`, `updatedAt`

### Strictly Excluded (Stripped by `.select('-…')`)
- `password`
- `authentication` (active OTPs / reset state)
- `tokenVersion`
- `deviceTokens`
- `deletedAt`

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](file:///src/app/modules/user/user.route.ts) — `router.get('/me', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserProfile`
- **Service**: [src/app/modules/user/user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserProfileFromDB`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `UserController.getUserProfile`. No `fileHandler`, no `validateRequest`, no `rateLimitMiddleware`.

### Service business logic (`getUserProfileFromDB`)
1. Resolve `id` from the JWT payload.
2. `User.findById(id).select('-password -authentication -tokenVersion -deviceTokens -deletedAt').lean()`.
3. If the result is falsy, throw `ApiError(404, "User doesn't exist!")` (rare race; usually pre-empted by auth's 401).
4. Return the lean object as the controller's `data`.

### Controller (`getUserProfile`)
- Status: `200 OK`
- Message: `"Profile data retrieved successfully"`

---

## 5. Security
- **No per-route rate limit** is wired in code for this endpoint.
- **Token-version invalidation** applies (see §2.1) — bumping `User.tokenVersion` invalidates all currently-issued JWTs.
- **No relational population** is performed; all returned fields are direct properties of the User document.
- **HTTP cache**: this response contains the user's full private profile (email, dateOfBirth, verification artefacts). The server now emits `Cache-Control: private, no-store, max-age=0` and `Pragma: no-cache` so shared proxies cannot cache the body and clients cannot persist it to disk. Clients should still re-fetch after a profile update.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile data retrieved successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "SISTER",
    "dateOfBirth": "1995-05-15T00:00:00.000Z",
    "revertDate": "2024-05-11T00:00:00.000Z",
    "profileImage": "uploads/users/profiles/pic.jpg",
    "verificationImage": "uploads/users/verifications/id.jpg",
    "verificationVideo": "uploads/users/videos/face.mp4",
    "aboutMe": "Short intro",
    "revertStory": "My journey…",
    "interests": ["Quran Study", "Fitness"],
    "location": {
      "country": "USA",
      "city": "New York",
      "coordinates": { "lat": 40.7128, "lng": -74.006 }
    },
    "status": "ACTIVE",
    "googleId": "1234567890",
    "appleId": "apple_id_98765",
    "isVerified": true,
    "createdAt": "2026-05-09T10:00:00.000Z",
    "updatedAt": "2026-05-10T12:00:00.000Z"
  }
}
```

### Error: Unauthorized (401)
*Any of the auth-failure cases listed in §2.1. Example for missing token:*
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

### Error: User no longer exists (401)
*Auth-layer check — JWT user id missing in DB.*
```json
{
  "success": false,
  "statusCode": 401,
  "message": "User no longer exists"
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

### Error: Account no longer active (403)
*Returned for `DELETED`, `RESTRICTED`, or `INACTIVE` status.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is no longer active"
}
```

### Error: Account verification rejected (403)
*Returned for `REJECTED` status — must re-submit verification documents before regaining access.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account verification was rejected. Please re-submit your documents."
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
*Service-level race condition (user deleted between auth lookup and service lookup).*
```json
{
  "success": false,
  "statusCode": 404,
  "message": "User doesn't exist!"
}
```

---

## 7. Related Flows

- **Prerequisite — obtain `accessToken`**: [auth/01-login.md](../auth/01-login.md) or [auth/08-social-login.md](../auth/08-social-login.md).
- **Token expired** -> [auth/05-refresh-token.md](../auth/05-refresh-token.md).
- **Update profile fields / image** -> [04-update-own-profile.md](./04-update-own-profile.md).
- **Change password** -> [auth/09-change-password.md](../auth/09-change-password.md).
- **Forgot password (locked out)** -> [auth/03-forgot-password.md](../auth/03-forgot-password.md).
- **End the session on this device** -> [auth/06-logout.md](../auth/06-logout.md).
