# 02. Get All Khutbahs

```http
GET /khutba
Content-Type: application/json
Auth: None
```

> Retrieves a paginated list of all Khutbahs with search and filter options.

## Query Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `searchTerm` | `string` | Search by title, imam, or mosqueName |
| `page` | `number` | Page number for pagination (default: 1) |
| `limit` | `number` | Number of items per page (default: 10) |
| `sortBy` | `string` | Field to sort by (e.g., `date`, `createdAt`) |
| `sortOrder` | `string` | `asc` or `desc` (default: `desc`) |
| `startDate` | `string` | Filter by date range (YYYY-MM-DD) |
| `endDate` | `string` | Filter by date range (YYYY-MM-DD) |

## Implementation

- **Route**: [khutba.route.ts](file:///src/app/modules/khutba/khutba.route.ts)
- **Controller**: [khutba.controller.ts](file:///src/app/modules/khutba/khutba.controller.ts) — `getAllKhutbas`
- **Service**: [khutba.service.ts](file:///src/app/modules/khutba/khutba.service.ts) — `getAllKhutbasFromDB`

### Business Logic
1. **Query Construction**: Uses `QueryBuilder` to apply searching, filtering (by date range), sorting, and pagination.
2. **Search**: Matches `searchTerm` against `title`, `imam`, and `mosqueName`.
3. **Pagination**: Returns total pages and current page metadata along with the data.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Khutbahs retrieved successfully.",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPage": 3
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1929",
      "title": "The Importance of Charity",
      "mosqueName": "Central Mosque",
      "imam": "Sheikh Khalid",
      "date": "2026-05-08",
      "audioUrl": "https://storage.com/audio/charity.mp3",
      "thumbnailUrl": "https://storage.com/images/charity.jpg"
    }
  ]
}
```
