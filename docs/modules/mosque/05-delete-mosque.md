# 05. Delete Mosque

```http
DELETE /mosques/:mosqueId
Content-Type: application/json
Auth: Admin
```

> Permanently removes a mosque entry and its associated image from the database.

## Path Parameters

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `mosqueId` | `string` | Unique identifier of the mosque | `60d5ecb86372ad46101f1929` |

## Implementation

- **Route**: [mosque.route.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.route.ts)
- **Controller**: [mosque.controller.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.controller.ts) — `deleteMosque`
- **Service**: [mosque.service.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.service.ts) — `deleteMosqueFromDB`

### Business Logic
1. **Find Existing**: Retrieves the mosque record to identify any associated file URLs.
2. **File Deletion**: Removes the mosque image from cloud storage (if applicable).
3. **Database Removal**: Deletes the mosque record from the database.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosque deleted successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929"
  }
}
```

### Scenario: Not Found (404)

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Mosque not found"
}
```
