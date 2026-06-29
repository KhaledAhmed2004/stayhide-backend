# 02. Get All Mosques

```http
GET /mosques
Content-Type: application/json
Auth: None
```

> Fetches a paginated list of mosques with optional search and filtering.

## Query Parameters

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `page` | `number` | Page number (default: 1) | `1` |
| `limit` | `number` | Items per page (default: 10) | `10` |
| `searchTerm`| `string` | Search by name, area, address, or description | `Baitul` |
| `area` | `string` | Filter by specific area | `Motijheel` |
| `latitude` | `number` | User's latitude for distance calculation | `23.7298` |
| `longitude` | `number` | User's longitude for distance calculation | `90.4125` |
| `filter` | `string` | Use `nearby-me` to sort by distance | `nearby-me` |

## Implementation

- **Route**: [mosque.route.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.route.ts)
- **Controller**: [mosque.controller.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.controller.ts) — `getAllMosques`
- **Service**: [mosque.service.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.service.ts) — `getAllMosquesFromDB`

### Business Logic
1. **Always-On Distance**: If `latitude` and `longitude` are provided, the system **always** calculates `distanceInKm` regardless of the filter.
2. **Nearby Me Filter**: If `filter=nearby-me` is used with coordinates, the list is sorted by proximity (closest first).
3. **Default Sorting**: If no filter is provided, the list defaults to sorting by `updatedAt` (newest first).
4. **Data Flattening**: The `location` GeoJSON is flattened into `latitude`, `longitude`, and a generated `mapLink` for easier frontend integration (e.g., Google Maps links).

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosques fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPage": 5
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1929",
      "mosqueName": "Baitul Mukarram",
      "address": "Topkhana Road, Dhaka",
      "area": "Motijheel",
      "phoneNumber": "+880123456789",
      "website": "https://baitulmukarram.org",
      "description": "The National Mosque of Bangladesh",
      "image": "https://example.com/mosque-image.jpg",
      "prayerTimes": {
        "fajr": "04:30",
        "dhuhr": "12:15",
        "asr": "16:45",
        "maghrib": "18:30",
        "isha": "20:00",
        "jummah": "13:30"
      },
      "latitude": 23.7298,
      "longitude": 90.4125,
      "mapLink": "https://www.google.com/maps/search/?api=1&query=23.7298,90.4125",
      "distanceInKm": 0.5,
      "updatedAt": "2026-05-09T10:00:00.000Z"
    }
  ]
}
```
