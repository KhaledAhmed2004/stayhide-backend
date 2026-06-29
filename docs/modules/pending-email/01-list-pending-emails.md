# 01. List Pending Emails

```http
GET /admin/pending-emails
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Lists rows from the `PendingEmail` collection. Operational endpoint — SUPER_ADMIN only. Used to audit "did we try to email user X?", to triage SMTP outages, and to find DEAD rows that need [requeueing](./02-requeue-pending-email.md).

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication Rules
Enforced by the `auth` middleware. Standard 9-case JWT validation (missing / malformed / expired / signature / not-yet-valid / payload-shape / user-gone / token-version mismatch). Each maps to a `401`. See [auth/06-logout.md §2.1](../auth/06-logout.md) for the full message table — identical here.

### 2.2 Account Status Rules
Same as every other admin route: `ACTIVE` and `PENDING` allowed; `SUSPENDED` / `REJECTED` / `INACTIVE` / `DELETED` / `RESTRICTED` blocked by the middleware with the per-status 403 messages from [system-concepts.md](../../system-concepts.md).

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN` only.
- **Any other role** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Query Validation (Zod — `listPendingEmailsZodSchema`)
Standard QueryBuilder param shape. All optional.

| Field | Type | Constraint |
| :--- | :--- | :--- |
| `status` | `enum` | `PENDING` \| `PROCESSING` \| `SENT` \| `DEAD` |
| `kind` | `enum` | One of the 5 email kinds: `registration_otp`, `forgot_password_otp`, `email_change_otp`, `email_change_notification`, `account_rejected_reverify` |
| `page` | `string` | digit-only |
| `limit` | `string` | digit-only |
| `sort` | `string` | e.g. `-createdAt`, `nextAttemptAt` |
| `searchTerm` | `string` | substring match against `to`, `subject`, `lastError` |
| `fields` | `string` | projection — comma-separated |

### 2.5 Service Behavior
- Runs a `QueryBuilder` pipeline (`.search(['to','subject','lastError']).filter().sort().paginate().fields()`) on `PendingEmail.find()`.
- Returns paginated data + meta (`page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`).
- Read-only — no DB mutation.

---

## 3. Implementation
- **Route**: [src/app/modules/pending-email/pending-email.route.ts](../../../src/app/modules/pending-email/pending-email.route.ts) — `router.get('/', ...)`
- **Controller**: [src/app/modules/pending-email/pending-email.controller.ts](../../../src/app/modules/pending-email/pending-email.controller.ts) — `listPendingEmails`
- **Service**: [src/app/modules/pending-email/pending-email.service.ts](../../../src/app/modules/pending-email/pending-email.service.ts) — `listPendingEmailsFromDB`
- **Validation**: [src/app/modules/pending-email/pending-email.validation.ts](../../../src/app/modules/pending-email/pending-email.validation.ts) — `PendingEmailValidation.listPendingEmailsZodSchema`

**Middleware order**: `auth(SUPER_ADMIN)` -> `validateRequest(listPendingEmailsZodSchema)` -> `PendingEmailController.listPendingEmails`.

---

## 4. Security
- **SUPER_ADMIN-only** access — `PendingEmail` rows contain rendered HTML email bodies which may include OTPs, reverify tokens, and recipient PII. Never exposed below SUPER_ADMIN.
- **No `Cache-Control` header is set** today; the response is intended to be ad-hoc audit / dashboard read. Add `no-store` if ever piped to a public dashboard.

---

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pending emails retrieved",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "kind": "forgot_password_otp",
      "to": "user@example.com",
      "subject": "Reset your password",
      "status": "DEAD",
      "attempts": 4,
      "maxAttempts": 4,
      "nextAttemptAt": null,
      "lastError": "Error: Invalid login: 535 5.7.8 Username and Password not accepted",
      "workerId": null,
      "leaseExpiresAt": null,
      "messageId": null,
      "sentAt": null,
      "createdAt": "2026-05-11T08:11:23.000Z",
      "updatedAt": "2026-05-11T08:18:11.000Z"
    }
  ]
}
```

### Error: Validation failed (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "query.status", "message": "Invalid enum value." }
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

### Error: Forbidden role (403)
*Caller is not `SUPER_ADMIN`.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You don't have permission to access this API"
}
```

---

## 6. Related Flows

- **Recover a DEAD row** -> [02-requeue-pending-email.md](./02-requeue-pending-email.md).
- **Dashboard counts** -> [03-pending-email-stats.md](./03-pending-email-stats.md).
- **Queue semantics & lifecycle** -> [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue).
