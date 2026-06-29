# 05. Delete Learning Content

```http
DELETE /learning-contents/:contentId
Auth: SUPER_ADMIN
```

> Admin content delete korar jonno use korbe. Automatic likes ebong comments o delete hoye jabe.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `contentId` | `string` | ID of the learning content |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `deleteLearningContent`
- **Service**: `learning-content.service.ts` — `deleteLearningContentFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Learning content deleted successfully"
}
```
