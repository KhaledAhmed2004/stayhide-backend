# Dua Module APIs

> **Section**: Backend API specifications for the Dua module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Dua listing page — View duas based on prayer times (waqt).
> - Admin Dashboard - Dua Management — Add, update, and manage duas.

---

## Database Design

### Dua Model (`duas`)
Stores prayer-time specific duas with audio attachments.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | String | ✅ | Dua title |
| `waqt` | String | ✅ | Enum: `Fajr`, `Zuhr`, `Asr`, `Maghrib`, `Isha` |
| `details` | String | ✅ | Dua details/content |
| `audioUrl` | String | ✅ | URL to audio file |
| `isDeleted` | Boolean | ❌ | Soft delete flag (default: `false`) |

**Indexes**:
- `{ waqt: 1 }` — Filter by prayer time
- `{ title: "text", details: "text" }` — Full-text search support
- `{ createdAt: -1 }` — Latest duas first

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/duas` | `ADMIN`, `SUPER_ADMIN` | ✅ Done: Creates a new dua with audio. | [01-create-dua.md](./01-create-dua.md) |
| 02 | GET | `/duas` | `None` | ✅ Done: Fetches all duas (supports filtering and search). | [02-get-all-duas.md](./02-get-all-duas.md) |
| 03 | GET | `/duas/:duaId` | `None` | ✅ Done: Fetches details of a single dua. | [03-get-single-dua.md](./03-get-single-dua.md) |
| 04 | PATCH | `/duas/:duaId` | `ADMIN`, `SUPER_ADMIN` | ✅ Done: Updates an existing dua. | [04-update-dua.md](./04-update-dua.md) |
| 05 | DELETE | `/duas/:duaId` | `ADMIN`, `SUPER_ADMIN` | ✅ Done: Soft deletes a dua. | [05-delete-dua.md](./05-delete-dua.md) |
