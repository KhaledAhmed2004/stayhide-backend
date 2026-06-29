# 03. Pending Email Stats

```http
GET /admin/pending-emails/stats
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Aggregate counts of `PendingEmail` rows grouped by `status` and by `kind × status`. Intended as the data source for ops dashboards — "how many emails are currently retrying?", "how many DLQ'd in the last 24h?". SUPER_ADMIN only.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication Rules
Standard `auth` middleware. The 9 JWT-failure cases all map to `401`. See [auth/06-logout.md §2.1](../auth/06-logout.md) for the message table.

### 2.2 Account Status Rules
Same as the rest of the admin surface. Non-active statuses are blocked by the middleware.

### 2.3 Role-Based Access
- **Allowed roles**: `SUPER_ADMIN` only.
- **Other roles** -> `403 Forbidden` (`"message": "You don't have permission to access this API"`).

### 2.4 Input Validation
No query params, no body, no path params. No Zod schema attached.

### 2.5 Service Behavior
Runs two aggregations:
1. `$group` by `status` → flat `byStatus` map: `{ PENDING: N, PROCESSING: N, SENT: N, DEAD: N }`.
2. `$group` by `{ kind, status }` → nested `byKind` map: `{ <kind>: { <status>: N } }`.

Empty statuses are not emitted as zero — clients should treat missing keys as zero.

Each call hits the collection with two aggregation pipelines. For large `SENT` row counts (millions), this can be slow — recommend front-end caching for any dashboard polling more often than every 30 seconds.

---

## 3. Implementation
- **Route**: [src/app/modules/pending-email/pending-email.route.ts](../../../src/app/modules/pending-email/pending-email.route.ts) — `router.get('/stats', ...)`
- **Controller**: [src/app/modules/pending-email/pending-email.controller.ts](../../../src/app/modules/pending-email/pending-email.controller.ts) — `getPendingEmailStats`
- **Service**: [src/app/modules/pending-email/pending-email.service.ts](../../../src/app/modules/pending-email/pending-email.service.ts) — `getPendingEmailStatsFromDB`

**Middleware order**: `auth(SUPER_ADMIN)` -> `PendingEmailController.getPendingEmailStats`. No `validateRequest`, no rate limit.

The route declaration `/stats` is intentionally placed BEFORE `/:pendingEmailId/...` in [pending-email.route.ts](../../../src/app/modules/pending-email/pending-email.route.ts) so Express matches it as a fixed path, not as a `pendingEmailId` value (per the CLAUDE.md route-declaration-order rule).

---

## 4. Security
- **SUPER_ADMIN only**.
- **No `Cache-Control` is set** — let the dashboard layer decide caching policy.
- **Response contains no PII** — just counts. Safe to log / forward to monitoring without redaction.

---

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pending email stats retrieved",
  "data": {
    "byStatus": {
      "PENDING": 4,
      "PROCESSING": 0,
      "SENT": 12483,
      "DEAD": 7
    },
    "byKind": {
      "registration_otp": {
        "SENT": 8120,
        "DEAD": 2
      },
      "forgot_password_otp": {
        "PENDING": 2,
        "SENT": 3201,
        "DEAD": 4
      },
      "email_change_otp": {
        "SENT": 412
      },
      "email_change_notification": {
        "SENT": 411,
        "DEAD": 1
      },
      "account_rejected_reverify": {
        "PENDING": 2,
        "SENT": 339
      }
    }
  }
}
```

> Empty `kind` buckets (`account_rejected_reverify: {}`) mean zero rows for any status; clients should treat missing inner keys as zero rather than throwing.

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

---

## 6. Related Flows

- **Drill into a status** -> [01-list-pending-emails.md](./01-list-pending-emails.md) with `?status=<x>` / `?kind=<y>`.
- **Recover DEAD rows** -> [02-requeue-pending-email.md](./02-requeue-pending-email.md).
- **Queue policy** -> [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue).
