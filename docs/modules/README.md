# Modules — Backend API Specs (consolidated)

> This folder consolidates **API endpoint specifications** by backend module — extracted from the UX-flow screen docs in `app-screens/` and `dashboard-screens/`.
>
> **Why this folder exists**: Screen docs intermix UX flows with API contracts. When a backend developer needs to look up a specific endpoint (e.g., `POST /preference-cards`), they shouldn't have to scan through three different screen docs to find it. Module files give a single per-domain reference.
>
> **Where UX flows live**: Untouched in [`../app-screens/`](../app-screens/) and [`../dashboard-screens/`](../dashboard-screens/). Each endpoint here links back to the screens that consume it ("Used By").
>
> **Source of truth**: When a screen flow changes, update the screen doc. When a contract changes, update both the screen doc and the relevant module file here. Cross-references in each endpoint should make this easy.

---

## Standard Response Envelope

All API responses follow a single unified envelope. See [`../README.md`](../README.md#standard-response-envelope) for full details.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable description",
  "data": { /* endpoint-specific */ }
}
```

**Error envelope** (same shape for 400, 401, 403, 404, 409, 410, 429, 500):
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Access denied. SUPER_ADMIN role required.",
  "data": null
}
```

**Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`

---

## Common Error Scenarios

These cross-cutting error responses can occur on **any** authenticated endpoint. Module-specific endpoint docs only list module-specific errors and link here for the common ones.

#### Scenario: Unauthorized (401)
Returned when the access token is missing, invalid, or expired.
```json
{
  "type": "https://api.tbsosick.com/problems/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has expired. Please log in again to continue.",
  "code": "UNAUTHORIZED",
  "request_id": "req-xyz789"
}
```
**Client behaviour**: auto-retry the original request via `POST /auth/refresh-token` (see [auth/05-refresh-token.md](./auth/05-refresh-token.md)). If refresh fails, force logout.

#### Scenario: Forbidden — Plan Required (402 / 403)
Returned when the user's subscription plan doesn't grant access to the resource (e.g., Free user hits Library or Calendar). See [overview.md §9 Subscription Plans](../overview.md#9-subscription-plans-iap).
```json
{
  "success": false,
  "statusCode": 403,
  "message": "This feature requires a Premium plan.",
  "code": "PLAN_REQUIRED"
}
```

#### Scenario: Rate Limit (429)
Returned when the per-route rate limit is exceeded (e.g., public search: 60 req/min; download: 20 req/min).
```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

#### Scenario: Validation Error (400)
Returned by Zod when request body / query / params fail schema validation. Includes the failing field path.
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation error",
  "errors": [
    { "path": "body.email", "message": "Invalid email format" }
  ]
}
```

---

## Modules

| # | Module | Summary | File |
|---|---|---|---|
| 1 | **Auth** | Login, OTP verification, forgot/reset password, refresh token, logout, social login (Google/Apple), change password. | [auth/README.md](./auth/README.md) |
| 2 | **User** | Registration, admin user CRUD, stats, profile read/update, favorite list. | [user/README.md](./user/README.md) |
| 3 | **Preference Card** | Card list/search, stats, specialties, CRUD, favorites, downloads, admin verification (Approve/Reject). | [preference-card/README.md](./preference-card/README.md) |
| 4 | **Event** | Calendar event list (date range), CRUD with auto-reminders. | [event/README.md](./event/README.md) |
| 5 | **Notification** | List, mark-read (single & bulk), delete. Multi-channel: Push/Socket/DB. | [notification/README.md](./notification/README.md) |
| 6 | **Legal** | Public list/get of legal pages by slug; admin CMS create/update/delete. | [legal/README.md](./legal/README.md) |
| 7 | **Supply** | Master catalog list, single create, bulk create (with duplicate skip), update, delete. | [supply/README.md](./supply/README.md) |
| 8 | **Suture** | Master catalog list, single create, bulk create (with duplicate skip), update, delete. | [suture/README.md](./suture/README.md) |
| 9 | **Subscription** | Get current user's subscription (free users get `plan: "FREE"`, never 404). IAP receipt verification. | [subscription/README.md](./subscription/README.md) |
| 10 | **Admin** | Dashboard analytics: growth metrics, monthly preference-card trend, monthly active-subscriptions trend (with YoY). | [admin/README.md](./admin/README.md) |
| 11 | **Pending Email** | Admin-only ops endpoints for the durable email retry queue (list / requeue / stats). Backs every transactional email — see [system-concepts.md — Email Delivery & Retry Queue](../system-concepts.md#email-delivery--retry-queue). | [pending-email/README.md](./pending-email/README.md) |
| 12 | **Prayer Time** | Dynamic calculation of daily Salat times and Friday Jummah timings based on location and timezone completely offline. | [prayer-time/README.md](./prayer-time/README.md) |

---

## Cross-cutting References

- **Architectural overview & decisions log** (D1-D13): [`../overview.md`](../overview.md)
- **Database design**: [`../database-design.md`](../database-design.md)
- **API inventory** (cross-checked): [`../api-inventory.md`](../api-inventory.md)
- **Product logic**: [`../product-logic.md`](../product-logic.md)
- **User journey**: [`../user-journey.md`](../user-journey.md)

---

## Conventions used in module files

- **Endpoint numbering**: Each module uses a single numeric prefix (auth → 1.x, user → 2.x, preference-card → 3.x, event → 4.x, notification → 5.x, legal → 6.x, supply → 7.x, suture → 8.x, subscription → 9.x, admin → 10.x). Numbers do **not** correspond to screen-doc section numbers — those stay in the screen docs.
- **Used By**: Every endpoint lists the screen docs that reference it, with relative links back to `../app-screens/` and `../dashboard-screens/`.
- **Implementation pointers**: Each endpoint cites the route, controller, and service file (`src/app/modules/[feature]/...`) — read those for the source of truth.
- **Business Logic**: Where the screen-doc included a logic breakdown, it has been preserved verbatim.
- **API Status table**: Every module file ends with a status table summarizing the endpoints.
