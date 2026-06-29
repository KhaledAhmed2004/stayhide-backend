# 10. Leave Group

```http
POST /groups/:groupId/leave
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Removes the authenticated user from the specified group and decrements the group's member count.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group to leave |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `leaveGroup`
- **Service**: `group.service.ts` — `leaveGroupInDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Left group successfully",
  "data": {
    "groupId": "65f...",
    "userId": "65e...",
    "role": "member"
  }
}
```

### Scenario: Not a Member (400)

```json
{
  "success": false,
  "statusCode": 400,
  "message": "You are not a member of this group"
}
```
