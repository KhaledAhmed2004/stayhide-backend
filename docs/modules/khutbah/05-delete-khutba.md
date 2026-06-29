# 05. Delete Khutba

```http
DELETE /khutba/:khutbaId
Content-Type: application/json
Auth: Admin
```

> Permanently deletes a Khutba and its associated files.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `khutbaId` | `string` | Unique ID of the Khutba to delete |

## Implementation

- **Route**: [khutba.route.ts](file:///src/app/modules/khutba/khutba.route.ts)
- **Controller**: [khutba.controller.ts](file:///src/app/modules/khutba/khutba.controller.ts) — `deleteKhutba`
- **Service**: [khutba.service.ts](file:///src/app/modules/khutba/khutba.service.ts) — `deleteKhutbaFromDB`

### Business Logic
1. **Find Existing**: Retrieves the Khutba to get file URLs before deletion.
2. **File Deletion**: Removes associated audio and thumbnail files from cloud storage.
3. **Database Removal**: Deletes the Khutba record from the database.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Khutba deleted successfully.",
  "data": null
}
```


### Scenario: Not Found (404)

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Khutba not found"
}
```
