# Jummah Khutba Module (Updated System Design)

## 1. Data Model (Backend Structure)

Each khutba entry is stored as follows:

```json
{
  "id": "string",
  "title": "string",
  "mosqueName": "string",
  "imam": "string",
  "date": "YYYY-MM-DD",
  "description": "string (optional)",
  "audioUrl": "string",
  "thumbnailUrl": "string",
  "duration": "number (optional, seconds)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 2. Backend Features

### CRUD Operations

* Create khutba
* Update khutba
* Delete khutba
* Get all khutba (paginated)
* Get single khutba by ID

### Media Handling

* Upload audio files (MP3, WAV)
* Upload thumbnail images (JPG, PNG, WebP)
* Save only URLs in database

### Validation Rules

* Title (required)
* Mosque name (required)
* Imam name (required)
* Date (required)
* Audio file (required)
* Thumbnail image (required)
* Description (optional)

### File Constraints

* Audio max size: configurable (e.g., 50MB)
* Image max size: configurable (e.g., 5MB)

---

## 3. API Endpoints Design

### Khutba Routes

* `POST /khutba` → Create khutba (admin-only)
* `GET /khutba` → Get all khutba (with pagination & filters) (public access)
* `GET /khutba/:khutbaId` → Get single khutba (public access)
* `PUT /khutba/:khutbaId` → Update khutba (admin-only)
* `DELETE /khutba/:khutbaId` → Delete khutba (admin-only)

---

## 4. Search & Filter System

### Search Fields

* Title
* Imam name
* Mosque name

### Filters

* Date range (from – to)
* Latest first
* Oldest first

---

## 6. Security & Access Control

* Admin-only access for create/update/delete
* Public read access for viewing khutba
* Optional JWT authentication for admin routes
* File upload validation to prevent malicious uploads

---

## 7. Admin Features (Dashboard)

* Add new khutba
* Edit khutba details
* Delete khutba permanently

--- 

## 8. User Interface Features

* Khutba listing page
* Search bar (title / imam / mosque)
* Filter by date
* Audio player with controls
* Thumbnail preview card
* Bookmark khutba
* Notification when new khutba is uploaded
---


