# Pending-Email Module APIs

> **Section**: Admin-only endpoints for inspecting and recovering the durable email queue (`PendingEmail` collection).
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../system-concepts.md#standard-response-envelope)
> **Cross-cutting policy**: [system-concepts.md — Email Delivery & Retry Queue](../../system-concepts.md#email-delivery--retry-queue) is the source of truth for queue semantics, lease, backoff, TTL, and at-least-once delivery.

The pending-email module is **operational only** — there are no public-facing endpoints. End users never hit these routes; they exist so SUPER_ADMIN operators can:
- Audit what mail the system tried to send to whom and when (`GET /admin/pending-emails`).
- Recover from temporary SMTP outages by requeueing dead rows after the underlying issue is fixed (`POST /admin/pending-emails/:pendingEmailId/requeue`).
- Watch queue depth / DLQ depth for ops dashboards (`GET /admin/pending-emails/stats`).

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation |
|---|---|---|---|---|
| 01 | GET | `/admin/pending-emails` | SUPER_ADMIN | [01-list-pending-emails.md](./01-list-pending-emails.md) |
| 02 | POST | `/admin/pending-emails/:pendingEmailId/requeue` | SUPER_ADMIN | [02-requeue-pending-email.md](./02-requeue-pending-email.md) |
| 03 | GET | `/admin/pending-emails/stats` | SUPER_ADMIN | [03-pending-email-stats.md](./03-pending-email-stats.md) |

---

## Related Modules

- **[../auth/](../auth/)** — every credential / OTP flow that emits mail (`/auth/forgot-password`, `/auth/verify-otp` via `sendVerificationOTP`, `/auth/reset-password` indirectly, `/auth/resend-otp`) enqueues through this module.
- **[../user/](../user/)** — email-change (request + notification), account-rejected reverify-token email all flow here.
- **[../admin/](../admin/)** — the user-status flip in `PATCH /admin/users/:userId` and `PATCH /admin/users/:userId/status` enqueues the `account_rejected_reverify` email.
- **`AccountPurgeScheduler`** — on permanent user purge, cascades `PendingEmail.deleteMany({ to: <user.email> })` so retained mail history is also wiped (GDPR).

---

## How the Queue Behaves (Quick Reference)

| State | Meaning | What the scheduler does |
|---|---|---|
| `PENDING` | Waiting for next attempt | If `nextAttemptAt <= now`, claim atomically (flip to `PROCESSING` with `workerId` + 180s lease) and call `sendNow`. |
| `PROCESSING` | A worker holds the lease | Hands off. If `leaseExpiresAt < now` (crashed worker), reclaim to `PENDING`. |
| `SENT` | Successfully delivered | TTL-purges 14 days after `sentAt`. |
| `DEAD` | Max attempts exhausted | Sits until ops requeues via [02-requeue-pending-email.md](./02-requeue-pending-email.md) or the owning user is purged. |

**Backoff**: base 60s, multiplier 2, ±20% jitter, capped at 1h. **Per-kind max attempts** vary — see [system-concepts.md](../../system-concepts.md#email-delivery--retry-queue) for the matrix.

---

## Known Limitations

1. **Two parallel `forgot-password` requests for the same user create two `PendingEmail` rows** with two different OTPs. The user-doc only keeps the most recent OTP (last write wins); both rows still produce emails. The user receives two emails — only the most recent OTP is valid. Not a regression vs the pre-queue behavior; just more visible.
2. **At-least-once delivery**: if SMTP accepts a message and the worker process crashes before writing `SENT`, the next sweep reclaims the row and resends. Recipient gets a duplicate. Acceptable for OTPs (single-use) and notifications.
3. **No Redis** — the queue is Mongo-backed and process-local for worker claims. Two workers (blue-green deploy overlap) share the work safely via atomic `findOneAndUpdate`, but throughput is bounded by Mongo not a dedicated message broker.
4. **No proactive alerting** — the worker logs `PendingEmail.DEAD` to `errorLogger` on every DLQ event. Wiring those logs into a real alerting pipeline (PagerDuty, Slack, etc.) is operational and out of module scope.

---

## API Status

| # | Endpoint | Status | Roles | Notes |
|---|---|:---:|:---:|---|
| 01 | `GET /admin/pending-emails` | Done | SUPER_ADMIN | QueryBuilder-driven filter / sort / paginate |
| 02 | `POST /admin/pending-emails/:pendingEmailId/requeue` | Done | SUPER_ADMIN | DEAD-only; precise 400 if called on non-DEAD |
| 03 | `GET /admin/pending-emails/stats` | Done | SUPER_ADMIN | Aggregate counts by status + by kind/status |
