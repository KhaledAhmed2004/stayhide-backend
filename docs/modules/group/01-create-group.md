# 01. Create Group

```http
POST /groups
Content-Type: application/json
Auth: Admin
```

> Admins can create new user groups with gender restrictions and categories.

## Request Body

```json
{
  "name": "Quran Study Circle",
  "description": "A group for brothers to study Quran",
  "userType": "BROTHER",
  "category": "Quran Studies",
  "coverImage": "https://storage.com/group-cover.jpg"
}
```

## Request Body Details

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Name of the group |
| `description` | `string` | Detailed description |
| `userType` | `string` | `BROTHER` or `SISTER` |
| `category` | `string` | Category name (e.g., Quran Studies) |
| `coverImage` | `string` | (Optional) URL for the group cover image |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `createGroup`
- **Service**: `group.service.ts` — `createGroupIntoDB`

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Group created successfully",
  "data": {
    "id": "60d5ecb86372ad46101f1929",
    "name": "Quran Study Circle",
    "description": "A group for brothers to study Quran",
    "userType": "BROTHER",
    "category": "Quran Studies",
    "memberCount": 0,
    "createdAt": "2026-05-09T10:00:00.000Z"
  }
}
```
