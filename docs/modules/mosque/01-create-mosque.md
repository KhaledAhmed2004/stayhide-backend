# 01. Create Mosque

```http
POST /mosques
Content-Type: multipart/form-data
Auth: Admin
```

> Adds a new mosque to the database with location, prayer times, and an optional image.

## Request Body (Form Data)

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `mosqueName` | `string` | Name of the mosque | `Baitul Mukarram` |
| `address` | `string` | Full address | `Topkhana Road, Dhaka` |
| `area` | `string` | Area/Neighborhood | `Motijheel` |
| `phoneNumber` | `string` | Contact number | `+880123456789` |
| `website` | `string` | (Optional) Valid URL | `https://baitulmukarram.org` |
| `description` | `string` | (Optional) Mosque description | `The National Mosque of Bangladesh` |
| `location` | `object` | GeoJSON Point | `{"type": "Point", "coordinates": [90.4125, 23.7298]}` |
| `prayerTimes` | `object` | 5 daily prayer times (HH:MM) | `{"fajr": "04:30", "dhuhr": "12:15", "asr": "16:45", "maghrib": "18:30", "isha": "20:00", "jummah": "13:30"}` |
| `image` | `file` | Mosque image (max 1) | `mosque.jpg` |

## Implementation

- **Route**: [mosque.route.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.route.ts)
- **Controller**: [mosque.controller.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.controller.ts) — `createMosque`
- **Service**: [mosque.service.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.service.ts) — `createMosqueIntoDB`

### Business Logic
1. **File Upload**: `fileHandler` processes the `image` file and updates `req.body.image` with the URL.
2. **Data Validation**: Validates text fields and objects using Zod schema.
3. **Database Insertion**: Saves the mosque record with GeoJSON location and prayer times.

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Mosque created successfully.",
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
    "createdAt": "2026-05-09T10:00:00.000Z",
    "updatedAt": "2026-05-09T10:00:00.000Z"
  }
}
```

### Scenario: Validation Error (400)

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    {
      "path": "mosqueName",
      "message": "Mosque name is required"
    }
  ]
}
```
