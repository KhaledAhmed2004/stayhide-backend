# Admin Module APIs

> **Section**: Backend API specifications for the admin module (analytics & dashboard).
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Auth**: All endpoints require `Bearer {{accessToken}}` with `SUPER_ADMIN` role
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - Dashboard Overview Screen — Growth metrics + Recent activity feed

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation | Used By |
|---|---|---|---|---|---|
| 01 | GET | `/admin/growth-metrics` | SUPER_ADMIN | [01-growth-metrics.md](./01-growth-metrics.md) | Dashboard Overview Screen — summary stats (users, active users, verified users) with month-over-month change |
| 02 | GET | `/admin/recent-activities` | SUPER_ADMIN | [02-recent-activities.md](./02-recent-activities.md) | Dashboard Overview Screen — Recent activity feed (latest 10 registrations) |

---

## API Status

| # | Endpoint | Method | Auth | Status | Notes |
|---|---|:---:|:---:|:---:|---|
| 01 | `/admin/growth-metrics` | GET | SUPER_ADMIN | ✅ Done | Summary stats — `changePct` always positive magnitude, use `direction` for sign |
| 02 | `/admin/recent-activities` | GET | SUPER_ADMIN | ✅ Done | Recent activity feed — returns 10 latest user registrations |
