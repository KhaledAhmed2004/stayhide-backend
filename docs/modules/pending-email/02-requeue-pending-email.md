# 02. Requeue Dead Pending Email

```http
POST /admin/pending-emails/:pendingEmailId/requeue
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Operational recovery endpoint — flips a `DEAD` row back to `PENDING` so the worker tries again from scratch. Use after fixing the underlying SMTP failure (credential rotation, host change, DNS resolved). SUPER_ADMIN only.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication Rules
Standard `auth` middleware — 9 JWT-validation failure cases all map to `401`. See [auth/06-logout.md §2.1](../auth/06-logout.md) for the full message catalog.

### 2.2 Account Status Rules
Same as the rest of the admin surface. Non-active statuses (`SUSPENDED`, `REJECTED`, `INACTIVE`, `DELETED`, `RESTRICTED`) are blocked before the controller runs.

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN` only.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation (Zod — `requeuePendingEmailZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `params.pendingEmailId` | `string` | Yes | Must match `^[0-9a-fA-F]{24}$` (Mongo ObjectId). Invalid format -> `400 "Invalid pending-email ID format"`. |

### 2.5 Service Behavior
1. Lookup row by `_id`.
2. Missing -> `404 "Pending email not found"`.
3. Status is not `DEAD` -> `400 "Only DEAD emails can be requeued (current: <STATUS>)"`. This message intentionally includes the current status so the operator immediately understands why the request was refused.
4. Reset the row:
    - `status: 'PENDING'`
    - `attempts: 0`
    - `nextAttemptAt: now`
    - `lastError: null`
    - `workerId: null`
    - `leaseExpiresAt: null`
5. The worker will pick it up within ~1 minute (next cron tick).

### 2.6 Side Effects
- The row's `attempts` counter restarts from 0, giving the caller a full per-kind `maxAttempts` retry budget again.
- Existing `messageId` / `sentAt` (both `null` on DEAD rows) are unchanged.
- No new email is sent inline by this endpoint — only the scheduler delivers.

---

## 3. Implementation
- **Route**: [src/app/modules/pending-email/pending-email.route.ts](../../../src/app/modules/pending-email/pending-email.route.ts) — `router.post('/:pendingEmailId/requeue', ...)`
- **Controller**: [src/app/modules/pending-email/pending-email.controller.ts](../../../src/app/modules/pending-email/pending-email.controller.ts) — `requeuePendingEmail`
- **Service**: [src/app/modules/pending-email/pending-email.service.ts](../../../src/app/modules/pending-email/pending-email.service.ts) — `requeuePendingEmailInDB`
- **Validation**: [src/app/modules/pending-email/pending-email.validation.ts](../../../src/app/modules/pending-email/pending-email.validation.ts) — `PendingEmailValidation.requeuePendingEmailZodSchema`

**Middleware order**: `auth(SUPER_ADMIN)` -> `validateRequest(requeuePendingEmailZodSchema)` -> `PendingEmailController.requeuePendingEmail`.

---

## 4. Security
- **SUPER_ADMIN only**.
- **No rate limit** — destructive in only a benign direction (a few wasted SMTP attempts). The worker's per-kind `maxAttempts` is the natural backstop.
- **Idempotent** — calling `requeue` twice on the same row is a no-op the second time (after the first call the row is `PENDING`, not `DEAD`, so the second call hits the `400` guard).

---

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pending email requeued",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "status": "PENDING"
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
    { "path": "params.pendingEmailId", "message": "Invalid pending-email ID format" }
  ]
}
```

### Error: Wrong-status guard (400)
*Row exists but is not `DEAD`. Status name is included in the message so the operator knows where it is in the lifecycle.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Only DEAD emails can be requeued (current: PENDING)"
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

### Error: Forbidden role (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to access this API"
}
```

### Error: Not Found (404)
*No row matches the supplied `pendingEmailId`.*
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Pending email not found"
}
```

---

## 6. Related Flows

- **Find the DEAD row first** -> [01-list-pending-emails.md](./01-list-pending-emails.md) with `?status=DEAD`.
- **Verify it was retried** -> list again ~1 min later; expect either `SENT` or back to `PENDING/PROCESSING` with `attempts > 0`.
- **Queue lifecycle reference** -> [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue).
