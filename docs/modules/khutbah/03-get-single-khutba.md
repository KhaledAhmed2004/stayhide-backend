# 03. Get Single Khutba

```http
GET /khutba/:khutbaId
Content-Type: application/json
Auth: None
```

> Retrieves detailed information about a specific Khutba by its ID.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `khutbaId` | `string` | Unique ID of the Khutba |

## Implementation

- **Route**: [khutba.route.ts](file:///src/app/modules/khutba/khutba.route.ts)
- **Controller**: [khutba.controller.ts](file:///src/app/modules/khutba/khutba.controller.ts) — `getSingleKhutba`
- **Service**: [khutba.service.ts](file:///src/app/modules/khutba/khutba.service.ts) — `getSingleKhutbaFromDB`

### Business Logic
1. **Find by ID**: Searches the database for the Khutba record matching the provided ID.
2. **Error Handling**: Throws `404 Not Found` if the record does not exist.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Khutba retrieved successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "title": "The Importance of Charity",
    "mosqueName": "Central Mosque",
    "imam": "Sheikh Khalid",
    "date": "2026-05-08",
    "description": "A deep dive into the benefits of Sadaqah.",
    "audioUrl": "https://storage.com/audio/charity.mp3",
    "thumbnailUrl": "https://storage.com/images/charity.jpg",
    "createdAt": "2026-05-08T10:00:00.000Z",
    "updatedAt": "2026-05-08T10:00:00.000Z"
  }
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
