# Mosque Management Module APIs

> **Section**: Backend API specifications for the Mosque Management module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Mosque listing page — Search, filter, and view prayer times
> - Admin Dashboard - Mosque Management — Create, update, and delete mosques

---

## Database Design

### Mosque Model (`mosques`)
Stores details and prayer times for mosques.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `mosqueName` | String | ✅ | Name of the mosque |
| `address` | String | ✅ | Full address of the mosque |
| `area` | String | ✅ | Area or neighborhood |
| `phoneNumber` | String | ✅ | Contact number |
| `website` | String | ❌ | Official website (optional) |
| `description` | String | ❌ | Optional description |
| `image` | String | ❌ | URL for the mosque image |
| `location` | Object | ✅ | GeoJSON Point (coordinates: [lng, lat]) |
| `prayerTimes` | Object | ✅ | 5 daily prayer times (HH:MM) |

**Indexes**:
- `{ mosqueName: 'text', area: 'text', address: 'text', description: 'text' }` — Supports global search
- `{ area: 1 }` — Fast filtering by area
- `{ 'location.coordinates': '2dsphere' }` — Geospatial indexing for proximity search

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/mosques` | Admin | **Done**: Creates a new mosque entry with optional image upload. | [01-create-mosque.md](./01-create-mosque.md) |
| 02 | GET | `/mosques` | None | **Done**: Fetches paginated mosques with search/filter/proximity. | [02-get-all-mosques.md](./02-get-all-mosques.md) |
| 03 | GET | `/mosques/:mosqueId` | None | **Done**: Retrieves full details of a single mosque. | [03-get-single-mosque.md](./03-get-single-mosque.md) |
| 04 | PATCH | `/mosques/:mosqueId`| Admin | **Done**: Updates mosque details or replaces the image. | [04-update-mosque.md](./04-update-mosque.md) |
| 05 | DELETE | `/mosques/:mosqueId`| Admin | **Done**: Deletes a mosque entry and its image. | [05-delete-mosque.md](./05-delete-mosque.md) |
