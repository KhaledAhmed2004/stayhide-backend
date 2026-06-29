# User Module APIs

> **Section**: Backend API specifications for the user module — endpoints under `/api/v1/users/*` plus the `POST /users/reverify` public endpoint. Admin-only user-management endpoints (list, stats, status updates, hard-delete) live under `/api/v1/admin/users/*` and are documented in [../admin/](../admin/).
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../system-concepts.md#standard-response-envelope)
> **Cross-cutting concepts**: [system-concepts.md](../../system-concepts.md) covers idempotency, password policy, device-token storage, sessions metadata, JWT key rotation, token-version invalidation, file storage & orphan cleanup.
> **UX Flows referencing this module**:
> - [App - Auth Screen] — Registration (`POST /users`)
> - [App - Profile Screen] — Profile read/update, account deletion, email change, sessions, GDPR export
> - [App - Re-verify Flow] — Public `POST /users/reverify` after admin rejection
> - [Dashboard - User Management Screen] — see [../admin/](../admin/) for the admin-side endpoints

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation |
|---|---|---|---|---|
| 01 | POST | `/users` | Public / SUPER_ADMIN | [01-create-user.md](./01-create-user.md) |
| 02 | GET | `/users/:userId/public` | Bearer | [02-get-user-details-public.md](./02-get-user-details-public.md) |
| 03 | GET | `/users/me` | Bearer | [03-get-own-profile.md](./03-get-own-profile.md) |
| 04 | PATCH | `/users/me` | Bearer | [04-update-own-profile.md](./04-update-own-profile.md) |
| 06 | DELETE | `/users/me` | Bearer | [06-delete-account.md](./06-delete-account.md) |
| 07 | POST | `/users/me/email-change/request` | Bearer | [07-email-change-request.md](./07-email-change-request.md) |
| 08 | POST | `/users/me/email-change/confirm` | Bearer | [08-email-change-confirm.md](./08-email-change-confirm.md) |
| 09 | POST | `/users/me/data-export` | Bearer | [09-data-export.md](./09-data-export.md) |
| 10 | GET | `/users/me/sessions` | Bearer | [10-list-sessions.md](./10-list-sessions.md) |
| 11 | DELETE | `/users/me/sessions/:tokenId` | Bearer | [11-revoke-session.md](./11-revoke-session.md) |
| 12 | POST | `/users/me/sessions/revoke-all` | Bearer | [12-revoke-all-sessions.md](./12-revoke-all-sessions.md) |
| 13 | POST | `/users/reverify` | Public (token) | [13-reverify-account.md](./13-reverify-account.md) |
| 14 | GET | `/users` | SUPER_ADMIN | [14-list-users-admin.md](./14-list-users-admin.md) |
| 15 | GET | `/users/metrics` | SUPER_ADMIN | [15-user-stats-admin.md](./15-user-stats-admin.md) |
| 16 | GET | `/users/:userId` | SUPER_ADMIN | [16-get-user.md](./16-get-user.md) |
| 17 | PATCH | `/users/:userId` | SUPER_ADMIN | [17-update-user-admin.md](./17-update-user-admin.md) |
| 18 | DELETE | `/users/:userId` | SUPER_ADMIN | [18-delete-user-admin.md](./18-delete-user-admin.md) |
| 19 | PATCH | `/users/:userId/review` | SUPER_ADMIN | [21-review-user-admin.md](./21-review-user-admin.md) |
| 22 | GET | `/users/profiles` | Bearer (BROTHER, SISTER, JUMMAH) | [22-list-user-profiles.md](./22-list-user-profiles.md) |

> Admin-side user-management endpoints (list, stats, update, delete, approve/reject) have been consolidated into this module under `/api/v1/users/*`.

---

## Related Modules

- [../auth/](../auth/) — login, OTP, password reset/change, refresh, restore-account (the `tokenVersion` consumers across this module's session-invalidation policy)
- [../admin/](../admin/) — admin-side user list, search, stats, update, hard delete; admin status-flip side effects (re-verify token + email + tokenVersion bump) interact with [06-delete-account.md](./06-delete-account.md) and [13-reverify-account.md](./13-reverify-account.md)
- [../notification/](../notification/) — push delivery target. Device tokens registered via login/restore are stored in this module's `User.deviceTokens[]`; notification module reads them. Storage rules: [system-concepts.md — Device-Token Storage](../../system-concepts.md#device-token-storage).
- [../connection/](../connection/) — the `GET /users/profiles` endpoint (doc `22`) enriches each profile with `connectionStatus` and `connectionId` via a server-side `$lookup` against the `connections` collection. The four possible values (`NONE`, `PENDING_SENT`, `PENDING_RECEIVED`, `CONNECTED`) mirror the states managed by the Connection module.

---

## API Status

| # | Endpoint | Status | Roles | Notes |
|---|---|:---:|:---:|---|
| 01 | `POST /users` | Done | Public / SUPER_ADMIN | Multipart + 100 MB cap; transactional create; CAPTCHA hook-point; idempotent |
| 02 | `GET /users/:userId/user` | Done | User / Admin | Rate-limited 60/min; same-role enforcement; `no-store` cache |
| 03 | `GET /users/me` | Done | User / Admin | Full self profile; `no-store` cache |
| 04 | `PATCH /users/me` | Done | User / Admin | Profile + avatar upload (10 MB); auto-unlink + orphan-cron safety net |
| 06 | `DELETE /users/me` | Done | User / Admin | Self soft-delete; 30-day recovery via auth/10-restore; idempotent |
| 07 | `POST /users/me/email-change/request` | Done | User / Admin | OTP to new + heads-up to old; idempotent |
| 08 | `POST /users/me/email-change/confirm` | Done | User / Admin | Commit + tokenVersion bump; race-safe via E11000 catch; idempotent |
| 09 | `POST /users/me/data-export` | Done | User / Admin | Sync JSON with 5 MB size guard; idempotent |
| 10 | `GET /users/me/sessions` | Done | User / Admin | Returns metadata only; `tokenPrefix` for display |
| 11 | `DELETE /users/me/sessions/:tokenId` | Done | User / Admin | Per-device revoke; no tokenVersion bump |
| 12 | `POST /users/me/sessions/revoke-all` | Done | User / Admin | Logout-all-devices (bumps tokenVersion); idempotent |
| 13 | `POST /users/reverify` | Done | Public (token) | Re-submit after admin rejection; 24h token; 5/hour rate limit; idempotent |
| 22 | `GET /users/profiles` | Done | BROTHER, SISTER, JUMMAH | Nearby/new-reverts community discovery; `$geoNear` proximity sort; `connectionStatus` + `connectionId` injected via single-pass `$lookup` |
