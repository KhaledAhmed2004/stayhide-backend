## Mosque Management Module (Updated System Design)

---

## 1. Data Model (Backend Structure)

Each mosque entry is stored as follows:

```json
{
  "id": "string",
  "mosqueName": "string",
  "address": "string",
  "area": "string",
  "phoneNumber": "string",
  "website": "string (optional)",
  "location": {
    "latitude": "number",
    "longitude": "number"
  },
  "prayerTimes": {
    "fajr": "HH:MM",
    "dhuhr": "HH:MM",
    "asr": "HH:MM",
    "maghrib": "HH:MM",
    "isha": "HH:MM",
    "jummah": "HH:MM (optional)"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 2. Backend Features

### CRUD Operations

* Create mosque
* Update mosque
* Delete mosque
* Get all mosques (with pagination)
* Get single mosque by ID

### Validation Rules

* Mosque name (required)
* Address (required)
* Area (required)
* Phone number (required)
* Location (latitude & longitude required)
* Prayer times (all 5 prayers required)

### Optional Rules

* Website must be valid URL if provided
* Phone number format validation

---

## 3. API Endpoints Design

### Mosque Routes

* `POST /mosques` → Create mosque
* `GET /mosques` → Get all mosques (pagination + filters)
* `GET /mosques/:mosqueId` → Get single mosque
* `PATCH  /mosques/:mosqueId` → Update mosque
* `DELETE /mosques/:mosqueId` → Delete mosque

---

## 4. Search & Filter System

### Search Fields

* Mosque name
* Area
* Address

### Filters

* Area-based filtering
* Near location (optional future feature using lat/lng distance)
* Alphabetical sorting (A–Z)

### Pagination

* page
* limit
* total count response

---

## 5. Location & Map System

### Location Features

* Store latitude and longitude
* Enable "nearby mosque" search (future enhancement)
* Optional map integration (Google Maps / OpenStreetMap)

### Advanced Option

* Distance-based sorting (nearest mosques first)

---

## 6. Prayer Time System

### Structure

* Fixed 5 daily prayers
* Optional Jummah time for Friday

### Features

* Manual entry by admin
* Optional auto calculation (future enhancement)
* Display next upcoming prayer (frontend logic)

---

## 7. Storage & Performance

### Storage Strategy

* Only structured data stored in database
* No media files required for base module

### Performance Enhancements

* Indexing on:

  * mosqueName
  * area
* Geo-indexing (future upgrade for location queries)
* Pagination for scalability

---

## 8. Security & Access Control

* Admin-only access for create/update/delete
* Public read access for mosque listing
* Optional JWT authentication for admin routes
* Input validation to prevent invalid prayer times or coordinates

---

## 9. Admin Features (Dashboard)

* Add new mosque
* Edit mosque details
* Delete mosque
* Manage prayer times
* View all mosques in table format
* Search and filter mosques
* Update location via map picker (optional)

---

## 10. User Interface Features

* Mosque listing page
* Search by mosque / area
* Filter by area
* Mosque details page
* Prayer time display card
* Map view (optional)
* Responsive mobile-friendly UI

---

## 11. Optional Advanced Features

* Nearby mosques based on GPS
* Bookmark favorite mosques
---
