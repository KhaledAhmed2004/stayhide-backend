# 02. List Groups

```http
GET /groups?page=1&limit=10&searchTerm=Quran
Content-Type: application/json
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Fetches a paginated list of groups. Results are automatically filtered based on the logged-in user's role.

## Business Logic
- **`BROTHER`**: Can only see groups with `userType: BROTHER`.
- **`SISTER`**: Can only see groups with `userType: SISTER`.
- **`SUPER_ADMIN`**: Can see **ALL** groups across both user types.
- **`isMember`**: Each group in the response includes a computed `isMember: boolean` field — `true` if the requesting user has already joined the group, `false` otherwise. This is determined in a single batch query (not per-item) for performance. The frontend should use this to display "Join" or "Joined / Leave" buttons without needing additional requests.

## Query Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 10) |
| `searchTerm`| `string` | Search by group name or category |
| `userType` | `string` | **Admin only:** Filter by `BROTHER` or `SISTER` |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `getAllGroups`
- **Service**: `group.service.ts` — `getAllGroupsFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Groups fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1929",
      "name": "Quran Study Circle",
      "description": "A group for brothers to study Quran",
      "category": "Quran Studies",
      "memberCount": 25,
      "userType": "BROTHER",
      "isMember": false
    }
  ]
}
```
