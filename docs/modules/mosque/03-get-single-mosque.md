# 03. Get Single Mosque

```http
GET /mosques/:mosqueId
Content-Type: application/json
Auth: None
```

> Retrieves full details of a specific mosque by its ID.

## Path Parameters

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `mosqueId` | `string` | Unique identifier of the mosque | `60d5ecb86372ad46101f1929` |

## Implementation

- **Route**: [mosque.route.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.route.ts)
- **Controller**: [mosque.controller.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.controller.ts) — `getSingleMosque`
- **Service**: [mosque.service.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.service.ts) — `getSingleMosqueFromDB`

### Business Logic
1. **Find by ID**: Searches the database for the mosque record matching the provided ID.
2. **Data Flattening**: The `location` GeoJSON is flattened into `latitude`, `longitude`, and a generated `mapLink` for easier frontend integration.
3. **Error Handling**: Throws `404 Not Found` if the mosque does not exist.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosque details fetched successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "mosqueName": "Baitul Mukarram",
    "address": "Topkhana Road, Dhaka",
    "area": "Motijheel",
    "phoneNumber": "+880123456789",
    "website": "https://baitulmukarram.org",
    "description": "The National Mosque of Bangladesh",
    "image": "https://example.com/mosque-image.jpg",
    "location": {
      "type": "Point",
      "coordinates": [90.4125, 23.7298]
    },
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
    "mapLink": "https://www.google.com/maps/search/?api=1&query=23.7298,90.4125"
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
