# 04. Update Own Profile

```http
PATCH /users/me
Content-Type: multipart/form-data
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Allows the currently authenticated user to update their own profile (text fields and an optional new `profileImage`). The previous profile image is unlinked from disk when a new one is uploaded.

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
- **`tokenVersion` in JWT does not match DB** (force-logout / password-reset / status-flip invalidation) -> `401 Unauthorized` (`"message": "Session invalidated — please log in again"`).

### 2.2 Account Status Rules
Checked after the DB lookup in the auth middleware.

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

### 2.4 Input Validation (Zod — `updateUserZodSchema`)
All fields are **optional**. The schema is a plain Zod object (not `.strict()`) — extra fields will not throw, but only the listed keys are persisted by the controller/service.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `name` | `string` | — |
| `aboutMe` | `string` | — |
| `revertStory` | `string` | — |
| `interests` | `string[]` | Array of strings |
| `profileImage` | `string` | Set by `fileHandler` after upload — usually omitted in the form-data text fields |
| `location.country` | `string` | — |
| `location.city` | `string` | — |
| `location.latitude` | `number` | Bounds: `-90 <= lat <= 90`. Out-of-range -> `400 Validation Error`. |
| `location.longitude` | `number` | Bounds: `-180 <= lng <= 180`. Out-of-range -> `400 Validation Error`. |

Schema violations -> `400 Bad Request` from `validateRequest` with the Zod error details.

**Immutable through this endpoint**: `email`, `role`, `status`, `dateOfBirth`, `tokenVersion`, `password`, `verificationImage`, `verificationVideo`. The Zod schema does not list these fields; any value sent for them is silently ignored.

- To change the **password**, see [auth/09-change-password.md](../auth/09-change-password.md).
- To change the **email**, use the 2-step flow at [07-email-change-request.md](./07-email-change-request.md) -> [08-email-change-confirm.md](./08-email-change-confirm.md).
- `dateOfBirth` is not user-editable through any documented endpoint.

### 2.5 File Handling
File upload is processed by `fileHandler` **before** validation, so the resulting `profileImage` URL is appended into `req.body` for the validator.

- **Field name**: `profileImage`
- **Max count**: 1 file
- **Subfolder**: `users/profiles`
- **Default size cap**: 10 MB (the global `fileHandler` default; not overridden on this route).
- **Default total file cap**: 10 files (only one is accepted here, but the global is shared).
- **Allowed MIME types** (image group): `image/jpeg`, `image/png`, `image/jpg`, `image/webp`.
- **Image processing**: resized to 800px width, PNGs compressed (level 8, palette), JPEG/WebP at quality 80.
- **Multer error mapping** (all -> `400 Bad Request`):
    - `LIMIT_FILE_SIZE` -> `"File too large for field 'profileImage'. Max 10 MB."`
    - `LIMIT_UNEXPECTED_FILE` -> `"Unexpected file field 'X'."`
    - `LIMIT_FILE_COUNT` -> `"Too many files uploaded. Max total files: 10."`
    - Wrong MIME -> `"Invalid file type 'X'. Allowed for images: [list]"` or `"Unsupported file type 'X'"`.

### 2.6 Side Effects & Atomicity
- **Old file unlink**: if a new `profileImage` is supplied, the previous file path stored on the user is removed via [unlinkFile](../../../src/shared/unlinkFile.ts) **before** the DB write. Async fire-and-forget; failures are logged and retried up to 3× internally, then queued for the daily [OrphanFileCleaner](../../../src/shared/orphanFileCleaner.ts) (03:30 UTC). External URLs and the system default `/default-avatar.svg` are skipped.
- **DB write**: `User.findOneAndUpdate({ _id: id }, payload, { new: true })`. Returns the updated Mongoose document (not lean).
- **No transaction is used** — the unlink + update sequence is not atomic. If the DB write fails after the unlink fires, the old file may still be deleted; the orphan cron handles the inverse case (DB succeeds, unlink fails) automatically.
- **`location` is replaced wholesale, not merged.** `findOneAndUpdate` defaults to a top-level `$set`, so sending `{ "location": { "country": "X" } }` removes any previously-stored `city` and `coordinates`. Clients must include every sub-field they want to retain.
- **Concurrent updates**: the endpoint is **last-write-wins**. Two simultaneous `PATCH /users/me` requests with different `profileImage` files race: request A unlinks the old image and writes its new path; request B's `unlinkFile` may then delete A's freshly-written file, leaving B's path stored alongside a now-deleted file on disk. Mobile clients should serialize profile updates client-side (queue, don't fire two updates in parallel). There is no optimistic-lock token (`If-Match` / `ETag`) on this endpoint today.

---

## 3. Request Body (Multipart Form-Data)

| Key | Value Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `text` | No | The user's full legal name. | `John Updated` |
| `aboutMe` | `text` | No | A short biography or intro about the user. | `New bio` |
| `revertStory` | `text` | No | The user's personal story of converting to Islam. | `My story...` |
| `revertDate` | `text` | No | The date the user converted to Islam in Full ISO 8601 format. | `2024-05-11T00:00:00.000Z` |
| `interests` | `array` | No | Array of strings representing user interests. | `["Quran", "Cooking"]` |
| `profileImage` | `file` | No | Profile photo upload (multipart). | — |
| `location[country]` | `text` | No | Country name. | `USA` |
| `location[city]` | `text` | No | City name. | `New York` |
| `location[latitude]` | `text` | No | Latitude coordinate. | `40.7128` |
| `location[longitude]` | `text` | No | Longitude coordinate. | `-74.0060` |

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](file:///src/app/modules/user/user.route.ts) — `router.patch('/me', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](file:///src/app/modules/user/user.controller.ts) — `updateProfile`
- **Service**: [src/app/modules/user/user.service.ts](file:///src/app/modules/user/user.service.ts) — `updateProfileToDB`
- **Validation**: [src/app/modules/user/user.validation.ts](file:///src/app/modules/user/user.validation.ts) — `UserValidation.updateUserZodSchema`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `fileHandler([profileImage])` -> `validateRequest(updateUserZodSchema)` -> `UserController.updateProfile`.

### Service business logic (`updateProfileToDB`)
1. Resolve `id` from the JWT payload.
2. `User.isExistUserById(id)` -> if falsy, throw `ApiError(400, "User doesn't exist!")`.
3. If `payload.profileImage` is truthy, call `unlinkFile(isExistUser.profileImage)` to remove the previous file from disk.
4. `User.findOneAndUpdate({ _id: id }, payload, { new: true })`.
5. Return the updated document.

---

## 5. Security
- **No per-route rate limit** is wired in code for this endpoint.
- **Token-version invalidation** applies (see §2.1) — bumping `User.tokenVersion` invalidates all currently-issued JWTs.
- **MIME validation** is enforced by `fileHandler` against file headers, not just extensions.
- **Path sanitization**: filenames are sanitized before disk write to prevent directory traversal.

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile updated successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "John Updated",
    "aboutMe": "Short bio",
    "revertStory": "My story...",
    "interests": ["Quran", "Arabic"],
    "country": "USA",
    "city": "New York",
    "latitude": 40.7128,
    "longitude": -74.006,
    "updatedAt": "2026-05-09T13:00:00.000Z"
  }
}
```

### Error: User doesn't exist (400)
*Service-level check when the JWT's user id is not found in DB.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "User doesn't exist!"
}
```

### Error: Validation failed (400)
*Returned by `validateRequest` for any Zod schema violation.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "body.location.latitude", "message": "Required" }
  ]
}
```

### Error: File too large (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "File too large for field 'profileImage'. Max 10 MB."
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
*JWT `tokenVersion` no longer matches DB.*
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

---

## 7. Related Flows

- **Read current profile (before/after update)** -> [03-get-own-profile.md](./03-get-own-profile.md).
- **Change password (not handled here)** -> [auth/09-change-password.md](../auth/09-change-password.md).
- **Change email (not handled here — 2-step OTP flow)** -> [07-email-change-request.md](./07-email-change-request.md) -> [08-email-change-confirm.md](./08-email-change-confirm.md).
- **Forgot password** -> [auth/03-forgot-password.md](../auth/03-forgot-password.md).
- **Token expired during a long upload** -> [auth/05-refresh-token.md](../auth/05-refresh-token.md).
