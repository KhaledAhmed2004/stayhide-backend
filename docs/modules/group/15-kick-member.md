# 15. Kick Member

```http
DELETE /groups/:groupId/members/:userId
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Removes a member from a group. Only accessible by Super Admins.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group |
| `userId` | `string` | ID of the user to kick |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `kickMember`
- **Service**: `group.service.ts` — `kickMemberFromDB`

### Business Logic
1. **Permission Check**: Only `SUPER_ADMIN` can perform this action.
2. **Count Update**: The `memberCount` of the group is automatically decremented.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Member kicked successfully"
}
```
