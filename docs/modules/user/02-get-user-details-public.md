# 02. Get Public User Details

```http
GET /users/:userId/public
Authorization: Bearer {{accessToken}}
```

> Retrieves public profile information of another user.

## Implementation
- **Route**: [user.route.ts](file:///src/app/modules/user/user.route.ts)
- **Controller**: [user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserDetailsById`
- **Service**: [user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserDetailsByIdFromDB`

### Business Logic
1. **Retrieval**: Fetches the user by ID.
2. **Access Control**: 
   - Regular users (`BROTHER`/`SISTER`/`JUMMAH`) can only view `ACTIVE` users of the same role.
3. **Field Selection**: Only public fields are returned:
   - `id`, `name`, `role`, `profileImage`, `interests`, `isVerified`, `createdAt`
   - `location` (flattened to `country`, `city`, `latitude`, `longitude`)
4. **Connection Status**: Includes `connectionStatus`, `connectionId`, and `chatId` relative to the requester.

### 2.2 Account Status Rules (Requester)
Checked after the DB lookup in the auth middleware.

| Requester Status | Outcome |
| :--- | :--- |
| `ACTIVE` | Allowed. |
| `PENDING` | Allowed (the auth layer does not block `PENDING`). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

### 2.3 Role-Based Access (Requester vs. Target)
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`.
- **Other requester roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).
- **Cross-gender match** (the service enforces this beyond the route's `auth` allow-list):
    - `SUPER_ADMIN` may view any target regardless of role.
    - For non-admin requesters, `requester.role` must equal `target.role`. Mismatch -> `403 Forbidden` (`"message": "You don't have permission to view this profile"`).

### 2.4 Target Visibility Rules
Enforced by the service after the DB lookup.

- **Target must exist** in DB.
- **Target `status` must be `ACTIVE`** — any other status (PENDING, SUSPENDED, DELETED, RESTRICTED, REJECTED, INACTIVE) is treated as not found.
- **Target must not have `deletedAt`** set (soft-delete check).
- Any failure of the above -> `404 Not Found` (`"message": "User not found"`).

### 2.5 Input Validation (Zod — `getUserDetailsZodSchema`)
- `params.userId` is a **string** matching the regex `/^[0-9a-fA-F]{24}$/` (24-char hex MongoDB ObjectId).
- Invalid format -> `400 Bad Request` from `validateRequest` with `"message": "Invalid User ID format"`.
- Missing `userId` -> `400 Bad Request` with `"message": "User ID is required"`.

---

## 3. Response Fields

### Returned (Limited Public Profile)
The service selects exactly these fields from the User document:
`_id`, `name`, `role`, `profileImage`, `location`, `isVerified`, `revertDate`, `aboutMe`, `interests`, `createdAt`.

The service then **flattens** `location` into top-level `country` and `city` and removes the nested `location` object before returning. Internal status flags (`status`, `deletedAt`) are stripped.

### Excluded (Private)
- `email`, `phone`, `dateOfBirth`, `password`
- `authentication` (OTP / reset state)
- `deviceTokens`, `tokenVersion`
- `googleId`, `appleId`
- `verificationImage`, `verificationVideo`
- `status`, `deletedAt`, `updatedAt`

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](file:///src/app/modules/user/user.route.ts) — `router.get('/:userId/user', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `getUserDetailsById`
- **Service**: [src/app/modules/user/user.service.ts](file:///src/app/modules/user/user.service.ts) — `getUserDetailsByIdFromDB`
- **Validation**: [src/app/modules/user/user.validation.ts](file:///src/app/modules/user/user.validation.ts) — `UserValidation.getUserDetailsZodSchema`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `rateLimitMiddleware({ windowMs: 60s, max: 60, routeName: 'public-user-details' })` -> `validateRequest(getUserDetailsZodSchema)` -> `UserController.getUserDetailsById`.

### Service business logic (`getUserDetailsByIdFromDB`)
1. `User.findById(userId).select('_id name role profileImage location isVerified revertDate aboutMe interests createdAt status deletedAt')` — projection includes `status` and `deletedAt` only for the visibility check.
2. If `!user || user.status !== ACTIVE || user.deletedAt` -> throw `ApiError(404, 'User not found')`.
3. If `requester.role !== SUPER_ADMIN` and `requester.role !== user.role` -> throw `ApiError(403, "You don't have permission to view this profile")`.
4. Flatten `location.country` / `location.city` to top-level fields, drop `location`.
5. Strip `status` and `deletedAt` from the response.

---

## 5. Security
- **Rate limit**: 60 requests / minute / IP, identified by `routeName: 'public-user-details'`. On exceed -> `429 Too Many Requests` (`"message": "Too many requests, please try again later"`).
- **Token-version invalidation** applies (see §2.1).
- **No `verificationImage` / `verificationVideo`** is ever exposed through this endpoint.
- **HTTP cache**: responses are user-scoped and may change the moment the target updates their profile or status. The server emits `Cache-Control: private, no-store, max-age=0` and `Pragma: no-cache` so shared proxies cannot cache the body. Clients treat each call as fresh.

---

## 6. Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User details retrieved successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "John Doe",
    "role": "BROTHER",
    "profileImage": "/default-avatar.svg",
    "interests": ["Islamic History", "Coding"],
    "isVerified": true,
    "createdAt": "2026-03-15T10:30:00.000Z",
    "connectionStatus": "PENDING_SENT",
    "connectionId": "664a1b2c3d4e5f6a7b8c9d0f"
  }
}
```

### Error: Invalid User ID format (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "params.userId", "message": "Invalid User ID format" }
  ]
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

### Error: Account suspended (403)
*Requester is suspended.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is suspended. Please contact support."
}
```

### Error: Account no longer active (403)
*Requester is `DELETED`, `RESTRICTED`, or `INACTIVE`.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account is no longer active"
}
```

### Error: Account verification rejected (403)
*Requester is `REJECTED` — must re-submit verification documents before regaining access.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Account verification was rejected. Please re-submit your documents."
}
```

### Error: Forbidden role at route level (403)
*Requester role is not in the route's allow-list.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to access this API"
}
```

### Error: Cross-gender view (403)
*Service-level — non-admin requester role does not match target role.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to view this profile"
}
```

### Error: Not Found (404)
*Target does not exist, is not `ACTIVE`, or has `deletedAt`.*
```json
{
  "success": false,
  "statusCode": 404,
  "message": "User not found"
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

- **Prerequisite — obtain `accessToken`**: [auth/01-login.md](../auth/01-login.md) or [auth/08-social-login.md](../auth/08-social-login.md).
- **Token expired during use** -> [auth/05-refresh-token.md](../auth/05-refresh-token.md).
- **View your own profile (full fields)** -> [03-get-own-profile.md](./03-get-own-profile.md).
