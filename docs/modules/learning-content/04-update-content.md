# 04. Update Learning Content

```http
PATCH /learning-contents/:contentId
Content-Type: multipart/form-data
Auth: SUPER_ADMIN
```

> Admin existing content update korar jonno use korbe.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `contentId` | `string` | ID of the learning content |

## Request Body (multipart/form-data)

| Field | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `title` | `string` | ❌ | Updated title | `Advanced Fiqh` |
| `description` | `string` | ❌ | Updated description | `Deeper dive into Islamic jurisprudence` |
| `category` | `string` | ❌ | Updated category | `Fiqh` |
| `video` | `file` | ❌ | Updated video file (mp4, etc.) | — |
| `durationInSeconds` | `number` | ❌ | Updated duration of the video in seconds | `390` |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `updateLearningContent`
- **Service**: `learning-content.service.ts` — `updateLearningContentInDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Learning content updated successfully",
  "data": {
    "id": "60d5ecb86372ad46101f1930",
    "updatedAt": "2026-05-12T11:00:00.000Z"
  }
}
```
