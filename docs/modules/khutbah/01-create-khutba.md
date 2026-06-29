# 01. Create Khutba

```http
POST /khutba
Content-Type: multipart/form-data
Auth: Admin
```

> Uploads a new Jummah Khutba with audio and thumbnail.

## Request Body (Form Data)

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Title of the Khutba | `The Importance of Charity` |
| `mosqueName` | `string` | Name of the mosque | `Central Mosque` |
| `imam` | `string` | Name of the Imam | `Sheikh Khalid` |
| `date` | `string` | Date of the Khutba (ISO 8601) | `2026-05-08T00:00:00.000Z` |
| `description` | `string` | (Optional) Brief description | `A deep dive into Sadaqah.` |
| `audio` | `file` | Audio file (MP3/WAV, max 50MB) | `khutba.mp3` |
| `thumbnail` | `file` | Thumbnail image (JPG/PNG/WebP, max 5MB) | `thumbnail.jpg` |
| `duration` | `string` | (Optional) Duration of the audio | `45:00` |

## Implementation

- **Route**: [khutba.route.ts](file:///src/app/modules/khutba/khutba.route.ts)
- **Controller**: [khutba.controller.ts](file:///src/app/modules/khutba/khutba.controller.ts) — `createKhutba`
- **Service**: [khutba.service.ts](file:///src/app/modules/khutba/khutba.service.ts) — `createKhutbaIntoDB`

### Business Logic
1. **File Upload**: `fileHandler` processes `audio` and `thumbnail` files, uploading them to cloud storage (Cloudinary/S3).
2. **Data Validation**: Validates text fields using Zod schema.
3. **Database Insertion**: Saves the Khutba record with file URLs and metadata.
4. **Notification**: (Optional) Triggers a notification to users about the new upload.

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Khutba created successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "title": "The Importance of Charity",
    "mosqueName": "Central Mosque",
    "imam": "Sheikh Khalid",
    "date": "2026-05-08T00:00:00.000Z",
    "description": "A deep dive into the benefits of Sadaqah.",
    "audioUrl": "https://storage.com/audio/charity.mp3",
    "thumbnailUrl": "https://storage.com/images/charity.jpg",
    "createdAt": "2026-05-08T10:00:00.000Z",
    "updatedAt": "2026-05-08T10:00:00.000Z"
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
      "path": "title",
      "message": "Title is required"
    }
  ]
}
```
