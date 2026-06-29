# Jummah Khutba Module APIs

> **Section**: Backend API specifications for the Jummah Khutba module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Khutba listing page — Search, filter, and audio playback
> - Admin Dashboard - Khutba Management — Create, update, and delete Khutbahs

---

## Database Design

### Khutba Model (`khutbas`)
Stores metadata and file URLs for recorded Khutbahs.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | String | ✅ | Title of the Khutba |
| `mosqueName` | String | ✅ | Name of the mosque where it was delivered |
| `imam` | String | ✅ | Name of the Imam |
| `date` | Date | ✅ | Date of the Khutba delivery (stored as Date object) |
| `description` | String | ❌ | Optional detailed summary |
| `audioUrl` | String | ✅ | Cloud storage URL for the MP3/WAV file |
| `thumbnailUrl`| String | ✅ | Cloud storage URL for the thumbnail image |
| `duration` | Number | ❌ | Length of audio in seconds |

**Indexes**:
- `{ title: 'text', imam: 'text', mosqueName: 'text' }` — Supports global search
- `{ date: -1 }` — Fast sorting for "Latest First"

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/khutba` | Admin | **Done**: Creates a new Khutba with audio and thumbnail upload. | [01-create-khutba.md](./01-create-khutba.md) |
| 02 | GET | `/khutba` | None | **Done**: Fetches paginated Khutbahs with search/filter. | [02-get-all-khutbahs.md](./02-get-all-khutbahs.md) |
| 03 | GET | `/khutba/:khutbaId` | None | **Done**: Retrieves full details of a single Khutba. | [03-get-single-khutba.md](./03-get-single-khutba.md) |
| 04 | PATCH | `/khutba/:khutbaId`| Admin | **Done**: Updates Khutba details or replaces media files. | [04-update-khutba.md](./04-update-khutba.md) |
| 05 | DELETE | `/khutba/:khutbaId`| Admin | **Done**: Deletes a Khutba and its associated files. | [05-delete-khutba.md](./05-delete-khutba.md) |
