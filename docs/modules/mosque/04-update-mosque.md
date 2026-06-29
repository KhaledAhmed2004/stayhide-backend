# 04. Update Mosque

```http
PATCH /mosques/:mosqueId
Content-Type: multipart/form-data
Auth: Admin
```

> Updates specific fields of an existing mosque entry. Supports partial updates and optional image replacement.

## Path Parameters

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `mosqueId` | `string` | Unique identifier of the mosque | `60d5ecb86372ad46101f1929` |

## Request Body (Form Data)

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `mosqueName` | `string` | (Optional) Updated name | `Baitul Mukarram New` |
| `address` | `string` | (Optional) Updated address | `Street 123, Dhaka` |
| `area` | `string` | (Optional) Updated area | `Gulshan` |
| `phoneNumber` | `string` | (Optional) Updated phone | `+880987654321` |
| `website` | `string` | (Optional) Updated website | `https://new-website.org` |
| `description` | `string` | (Optional) Updated description | `Revised description.` |
| `location` | `object` | (Optional) Updated GeoJSON Point | `{"type": "Point", "coordinates": [90.4125, 23.7298]}` |
| `prayerTimes` | `object` | (Optional) Updated prayer times | `{"fajr": "04:45", "dhuhr": "12:30"}` |
| `image` | `file` | (Optional) New mosque image | `new-mosque.jpg` |

## Implementation

- **Route**: [mosque.route.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.route.ts)
- **Controller**: [mosque.controller.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.controller.ts) — `updateMosque`
- **Service**: [mosque.service.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/mosque/mosque.service.ts) — `updateMosqueIntoDB`

### Business Logic
1. **Find Existing**: Checks if the mosque exists before applying updates.
2. **File Replacement**: If a new `image` is provided, the `fileHandler` uploads it and the URL is updated.
3. **Partial Update**: Merges the provided fields with the existing database record.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mosque updated successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "mosqueName": "Baitul Mukarram New",
    "prayerTimes": {
      "fajr": "04:45",
      "dhuhr": "12:30",
      "asr": "16:45",
      "maghrib": "18:30",
      "isha": "20:00"
    }
  }
}
```
