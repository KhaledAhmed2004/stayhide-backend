# 09. Personal Data Export (GDPR)

```http
POST /users/me/data-export
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN, BROTHER, SISTER, JUMMAH)
```

> Returns a single JSON envelope containing every piece of data the system stores **about** the requesting user. Satisfies GDPR Article 15 (right of access). Synchronous — the entire payload is in the HTTP response. Mobile-store policies (Apple §5.1.1(v), Google Play account-deletion policy) require this surface to exist for accounts in EU jurisdictions.
>
> The response includes data from 6 collections: User profile, Notifications, Subscription history (current + audit events), and Group activity (memberships, posts, likes, comments), plus Ask-Imam questions. Sensitive credentials are stripped — see §2.5.

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
| `PENDING` | Allowed (the auth layer does not block `PENDING`). |
| `SUSPENDED` | `403 Forbidden` (`"message": "Account is suspended. Please contact support."`). |
| `REJECTED` | `403 Forbidden` (`"message": "Account verification was rejected. Please re-submit your documents."`). |
| `INACTIVE` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `DELETED` | `403 Forbidden` (`"message": "Account is no longer active"`). |
| `RESTRICTED` | `403 Forbidden` (`"message": "Account is no longer active"`). |

> A soft-deleted user cannot reach this endpoint with their old token (auth middleware blocks). To export data on the way out, call this endpoint **before** [06-delete-account.md](./06-delete-account.md).

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN`, `BROTHER`, `SISTER`, `JUMMAH`.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation
- **No request body.** No Zod schema is attached.

### 2.5 Included vs Excluded Fields
The User profile section is loaded with `.select('-password -authentication -emailChange -tokenVersion -deletedAt').lean()`.

**Excluded everywhere** (never returned, even to the data owner):
- `password` (bcrypt hash)
- `authentication` subdoc (password-reset OTP state)
- `emailChange` subdoc (in-flight email-change OTP)
- `tokenVersion` (JWT rotation counter)
- `deletedAt` (internal)
- Raw `deviceTokens[].token` values (FCM/APNs credentials — exposing these would let a third party impersonate the user's device on the push service)

**Included on `deviceTokens`** (metadata only):
- `platform`, `appVersion`, `lastSeenAt`
- `tokenPrefix` (last 6 chars of the raw token, safe for display)

**Stripped from `deviceTokens`**:
- Raw `token` (legacy rows only; new rows don't store it)
- `tokenHash` (HMAC, would let someone with this export + the JWT secret verify ownership of a leaked raw token)

### 2.6 Sources Aggregated
| Section | Collection | Filter | Notes |
| :--- | :--- | :--- | :--- |
| `profile` | `User` (single doc) | `_id = me` | All non-excluded fields. |
| `notifications` | `Notification` | `userId = me` | Full history; not paginated. |
| `groupActivity.memberships` | `GroupMember` | `userId = me` | — |
| `groupActivity.posts` | `GroupPost` | `userId = me` | — |
| `groupActivity.likes` | `PostLike` | `userId = me` | — |
| `groupActivity.comments` | `PostComment` | `userId = me` | — |
| `askImamQuestions` | `AskImam` | `userId = me` | — |
| `subscriptions.current` | `Subscription` | `userId = me` | Includes purchase history. |
| `subscriptions.events` | `SubscriptionEvent` | `userId = me` | IAP webhook audit trail; retained even after account deletion. |

Reads are parallelized (`Promise.all`) for response-time predictability.

### 2.7 Schema Versioning
The response includes `schemaVersion: 1`. Future shape changes (additional collections, field renames) will increment this. Clients building local archive features should branch on this number.

---

## 3. Request Body
None. Empty body or `{}`.

---

## 4. Implementation
- **Route**: [src/app/modules/user/user.route.ts](../../../src/app/modules/user/user.route.ts) — `router.post('/me/data-export', ...)`
- **Controller**: [src/app/modules/user/user.controller.ts](../../../src/app/modules/user/user.controller.ts) — `exportMyData`
- **Service**: [src/app/modules/user/user.service.ts](../../../src/app/modules/user/user.service.ts) — `exportMyDataFromDB`

**Middleware order**: `auth(SUPER_ADMIN, BROTHER, SISTER, JUMMAH)` -> `UserController.exportMyData`. No `fileHandler`, no `validateRequest`, no `rateLimitMiddleware`.

### Service flow (`exportMyDataFromDB`)
1. Lazy-load cascade collection modules (Notification, GroupMember/Post/Like/Comment, AskImam, Subscription, SubscriptionEvent).
2. Load profile with `.select('-password -authentication -emailChange -tokenVersion -deletedAt').lean()`. Missing -> `404 "User doesn't exist!"`.
3. Sanitize `deviceTokens` — keep only `platform`, `appVersion`, `lastSeenAt`. Strip raw `token`.
4. Parallel `find({ userId })` against the 8 cascade collections.
5. Return envelope: `{ exportedAt, schemaVersion: 1, profile, notifications, groupActivity, askImamQuestions, subscriptions }`.

---

## 5. Security
- **No per-route rate limit** is wired today. Recommended hardening: 1 export per user per 24h (this endpoint reads from many collections and is the most expensive in the user module).
- **Token-version invalidation** applies (see §2.1).
- **Sensitive fields stripped** (see §2.5) — the export is what GDPR requires, not a server dump.
- **Synchronous response with hard size guard**: the service measures the serialized payload and refuses with `413 Payload Too Large` if it exceeds **5 MB**. This protects mobile clients from oversized responses and gives the user a clear message ("contact support — an async variant is planned") instead of a generic 5xx / timeout. For the rare user who hits the cap, contact support is the bridge until the async-email-link variant ships.
- **No password / OTP / credential** in any response.
- **Idempotency**: supports the `Idempotency-Key` header (`routeName: 'data-export'`). A retried call with the same key returns the cached payload without re-running the 8-collection aggregation. See [system-concepts.md — Idempotency](../../system-concepts.md#idempotency).

---

## 6. Responses

### Success (200)
*Shape illustrated with a small sample. Arrays may be empty for new accounts.*
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Personal data export generated.",
  "data": {
    "exportedAt": "2026-05-10T18:36:49.649Z",
    "schemaVersion": 1,
    "profile": {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "SISTER",
      "dateOfBirth": "1995-05-15T00:00:00.000Z",
      "profileImage": "uploads/users/profiles/pic.jpg",
      "deviceTokens": [
        { "platform": "ios", "appVersion": "1.4.0", "lastSeenAt": "2026-05-09T22:11:00.000Z" }
      ],
      "status": "ACTIVE",
      "isVerified": true,
      "isOnboardingCompleted": true,
      "createdAt": "2026-05-09T10:00:00.000Z",
      "updatedAt": "2026-05-10T12:00:00.000Z"
    },
    "notifications": [
      {
        "_id": "...",
        "title": "Welcome",
        "body": "Thanks for signing up!",
        "type": "system",
        "read": true,
        "createdAt": "2026-05-09T10:01:00.000Z"
      }
    ],
    "groupActivity": {
      "memberships": [],
      "posts": [],
      "likes": [],
      "comments": []
    },
    "askImamQuestions": [],
    "subscriptions": {
      "current": [
        {
          "_id": "...",
          "plan": "Premium",
          "platform": "apple",
          "status": "active",
          "expiresAt": "2026-08-09T10:00:00.000Z"
        }
      ],
      "events": [
        { "_id": "...", "type": "INITIAL_BUY", "createdAt": "2026-04-10T10:00:00.000Z" }
      ]
    }
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
*Service-level race condition (user purged between auth lookup and service lookup).*
```json
{
  "success": false,
  "statusCode": 404,
  "message": "User doesn't exist!"
}
```

### Error: Export too large (413)
*Serialized payload exceeded 5 MB. Rare — only fires for power users with heavy group activity. Contact support to receive an offline copy until the async-email-link variant ships.*
```json
{
  "success": false,
  "statusCode": 413,
  "message": "Export payload exceeds the synchronous size limit (6.8 MB > 5 MB). An async email-link variant is planned; until then, contact support to receive a copy of your data."
}
```

---

## 7. Related Flows

- **Account deletion (export your data first, then delete)** -> [06-delete-account.md](./06-delete-account.md).
- **Read profile (subset of this export)** -> [03-get-own-profile.md](./03-get-own-profile.md).
- **Refresh access token if it expired mid-export-flow** -> [auth/05-refresh-token.md](../auth/05-refresh-token.md).
