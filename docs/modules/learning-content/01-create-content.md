# 01. Create Learning Content

```http
POST /learning-contents
Content-Type: multipart/form-data
Auth: SUPER_ADMIN
```

> Admin new learning content (video) create korar jonno ei endpoint use korbe.

## Request Body (multipart/form-data)

| Field | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `title` | `string` | ✅ | Video title | `Basic Fiqh` |
| `description` | `string` | ✅ | Video description | `Introduction to Islamic jurisprudence` |
| `category` | `string` | ✅ | Content category | `Fiqh` |
| `video` | `file` | ✅ | The video file (mp4, etc.) | — |
| `durationInSeconds` | `number` | ❌ | Video duration in seconds | `300` |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `createLearningContent`
- **Service**: `learning-content.service.ts` — `createLearningContentIntoDB`

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Learning content created successfully",
  "data": {
    "id": "60d5ecb86372ad46101f1930",
    "createdAt": "2026-05-12T10:00:00.000Z"
  }
}
```
