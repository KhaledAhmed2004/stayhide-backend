# 02. Recent Activities

```http
GET /admin/recent-activities
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Returns the 10 most recent user registrations for the admin dashboard activity feed.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Authorization
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only `SUPER_ADMIN` can access this feed.

### 2.2 Activity Logic
- Fetches users sorted by `createdAt` in descending order.
- Limited to the top 10 most recent entries.
- Excludes soft-deleted users.

---

## 3. Implementation
- **Route**: [src/app/modules/admin/admin.route.ts](../../../src/app/modules/admin/admin.route.ts)
- **Controller**: [src/app/modules/admin/admin.controller.ts](../../../src/app/modules/admin/admin.controller.ts) — `getRecentActivities`
- **Service**: [src/app/modules/admin/admin.service.ts](../../../src/app/modules/admin/admin.service.ts) — `getRecentActivities`

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Recent activities fetched successfully",
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d0e",
      "type": "REGISTRATION",
      "title": "Jane Doe registered as a SISTER",
      "status": "ACTIVE",
      "timestamp": "2026-05-13T15:23:22.693Z",
      "image": "/uploads/users/profiles/jane.png"
    }
  ]
}
```
