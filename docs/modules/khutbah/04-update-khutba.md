# 04. Update Khutba

```http
PATCH /khutba/:khutbaId
Content-Type: multipart/form-data
Auth: Admin
```

> Updates an existing Khutba. Supports partial updates and optional file replacements.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `khutbaId` | `string` | Unique ID of the Khutba to update |

## Request Body (Form Data)

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `title` | `string` | (Optional) Updated title | `New Khutba Title` |
| `mosqueName` | `string` | (Optional) Updated mosque name | `Grand Mosque` |
| `imam` | `string` | (Optional) Updated Imam name | `Sheikh Ahmad` |
| `date` | `string` | (Optional) Updated date (ISO 8601) | `2026-05-10T00:00:00.000Z` |
| `description` | `string` | (Optional) Updated description | `Revised description text.` |
| `audio` | `file` | (Optional) New audio file | `updated_audio.mp3` |
| `thumbnail` | `file` | (Optional) New thumbnail image | `new_thumb.jpg` |
| `duration` | `string` | (Optional) Updated duration | `50:00` |

## Implementation

- **Route**: [khutba.route.ts](file:///src/app/modules/khutba/khutba.route.ts)
- **Controller**: [khutba.controller.ts](file:///src/app/modules/khutba/khutba.controller.ts) — `updateKhutba`
- **Service**: [khutba.service.ts](file:///src/app/modules/khutba/khutba.service.ts) — `updateKhutbaIntoDB`

### Business Logic
1. **Find Existing**: Checks if the Khutba exists before updating.
2. **File Handling**: If new files are uploaded, the `fileHandler` processes them. Old files may be deleted from cloud storage if replaced.
3. **Partial Update**: Updates only the fields provided in the request body.
4. **Database Update**: Persists changes to the database.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Khutba updated successfully.",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "title": "Updated Title",
    "mosqueName": "Central Mosque",
    "imam": "Sheikh Khalid",
    "date": "2026-05-08T00:00:00.000Z",
    "description": "Updated description.",
    "audioUrl": "https://storage.com/audio/new-audio.mp3",
    "thumbnailUrl": "https://storage.com/images/new-image.jpg",
    "createdAt": "2026-05-08T10:00:00.000Z",
    "updatedAt": "2026-05-08T11:00:00.000Z"
  }
}
```
