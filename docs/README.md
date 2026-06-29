# UX Flow with API Responses

Screen-by-screen API flow — **Student App** ebong **Admin Dashboard** dutor jonno documentation. 
Each screen e APIs called, method/URL, auth requirement, ebong expected response shape ache.

> Base URL: `{{baseUrl}}` (Already includes `/api/v1`, e.g., `http://localhost:5000/api/v1`)
> **[🗺️ User Journey & UX Flow Overview](./user-journey.md)** — Complete cross-screen user journeys with ASCII flow diagrams.
> **[API Inventory & Implementation Tracker](./api-inventory.md)** — All APIs at a glance.
> **[Database Design & Relationships](./database-design.md)** — Entity map ebong schema structure.

---

## How this folder is organized

This folder has three layers, each with a single responsibility:

| Folder / file | Purpose | Read this when… |
|---|---|---|
| [`standards/`](./standards/) | **Global Standards** — API response envelopes, error handling, naming conventions. | Ensuring consistency across new modules. |
| [`architecture/`](./architecture/) | **Architecture & CI/CD** — Deployment guides, GitHub Actions, and refactor logs. | Deploying to VPS/AWS or understanding system history. |
| [`app-screens/`](./app-screens/), [`dashboard-screens/`](./dashboard-screens/) | **UX flow only** — user journeys, screen behaviour, edge cases. | Building or designing a screen. |
| [`modules/`](./modules/) | **Canonical API specs** — request/response shapes, business logic, implementation pointers. | Implementing or consuming an endpoint. |
| [`api-inventory.md`](./api-inventory.md) | **Tracker view** — every endpoint with wiring status (which screen, implementation done). | Auditing coverage or finding orphaned endpoints. |

**Source of truth rule**: contract changes go in `modules/` or `standards/` only. Journey changes go in `app-screens/` or `dashboard-screens/` only. Cross-link between layers via anchors so navigation stays one click.

---

## Standard Response Envelope

Shob API unified format follow kore (`sendResponse()` use kore). **[Full Standard Details Details](./standards/api-response-standard.md)**.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human readable message",
  "meta": { "limit": 10, "nextCursor": "...", "hasNext": true },
  "data": { ... }
}
```

`meta` is flat (no nesting). `data` er shape endpoint bhede alada.

---

## Part 1: App APIs (Student-Facing)

| # | Screen | Description |
|---|--------|-------------|
| 1 | [Auth](./app-screens/01-auth.md) | Register, login, OTP verify, password reset, refresh token, social login |
| 2 | [Home](./app-screens/02-home.md) | Stats, prayer times, community feed, quick navigation |
| 3 | [Namaz/Prayer Time](./modules/prayer-time/README.md) | Prayer times calculation based on location/timezone |
| 4 | [Community Discovery](./modules/user/README.md) | Discover brothers/sisters, view public profiles |
| 5 | [Connections & Chat](./modules/connection/README.md) | Connect with others, real-time messaging, chat history |
| 6 | [Dua & Learning](./modules/dua/README.md) | Islamic knowledge, duas, and learning content |
| 7 | [Mosque & Khutbah](./modules/mosque/README.md) | Nearby mosques and recorded khutbahs |
| 8 | [Profile](./app-screens/07-profile.md) | User data, edit profile, subscription (IAP), legal pages, logout |
| 9 | [Notifications](./app-screens/08-notifications.md) | Notification list, mark read, delete |
| 10 | [Support](./modules/support-ticket/README.md) | Help desk and support tickets |

---

## Part 2: Dashboard APIs (Admin-Facing)

| # | Screen | Description |
|---|--------|-------------|
| 1 | [Auth](./dashboard-screens/01-auth.md) | Admin login, token management, forget password flow |
| 2 | [Overview](./dashboard-screens/02-overview.md) | Dashboard stats, counts, recent activity |
| 3 | [User Management](./dashboard-screens/03-user-management.md) | Brother / Sister management — search, filter, verification, blocking |
| 4 | [Islamic Content](./modules/learning-content/README.md) | Dua, Khutbah, and Learning content moderation |
| 5 | [Legal Management](./dashboard-screens/05-legal-management.md) | Legal pages CMS (Terms, Privacy) |
| 6 | [Support Tickets](./modules/support-ticket/README.md) | Help desk management for user queries |
