# 12. Delete Group

```http
DELETE /groups/:groupId
Auth: Bearer {{accessToken}} (ADMIN, SUPER_ADMIN)
```

> Deletes a group and all associated members, posts, likes, and comments. Also cleans up attached files.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group to delete |

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Group deleted successfully"
}
```
