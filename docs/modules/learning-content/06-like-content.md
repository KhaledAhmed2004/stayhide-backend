# 06. Like Content

```http
POST /learning-contents/:contentId/like
Auth: BROTHER, SISTER
```

> Toggles a like on learning content. Jodi age theke like thake, tobe unlike hoye jabe.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `contentId` | `string` | ID of the learning content |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `toggleLike`
- **Service**: `learning-content.service.ts` — `toggleLikeInDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Content liked",
  "data": {
    "liked": true
  }
}
```
