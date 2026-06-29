# Response Contracts & Error Formats

Exact shapes for all API responses. Reference for status codes, messages, and error formats.

---

## `sendResponse()` Type

```typescript
type TResponse<T> = {
  success: boolean;
  statusCode: number;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPage: number;
    total: number;
  };
  data?: T;
};
```

---

## Success Response Examples

### Single resource (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Club retrieved successfully",
  "data": { "_id": "abc123", "name": "Dhaka FC", "sport": "football" }
}
```

### Collection (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Clubs retrieved successfully",
  "pagination": { "page": 1, "limit": 10, "totalPage": 5, "total": 47 },
  "data": [ ... ]
}
```

### Created (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Club created successfully",
  "data": { "_id": "abc123", ... }
}
```
Headers: `Location: /api/v1/clubs/abc123`

### Delete / Action (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Club deleted successfully",
  "data": { "id": "abc123" }
}
```

---

## Error Response Shape

All errors go through `globalErrorHandler`. Shape:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Club not found",
  "errorMessages": [{ "path": "", "message": "Club not found" }],
  "stack": "..."   // development only — never in production
}
```

### Zod validation error (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorMessages": [
    { "path": "body.name", "message": "Name is required" },
    { "path": "body.sport", "message": "Invalid enum value. Expected 'football' | 'cricket'" }
  ]
}
```

---

## `ApiError` — Common Throws

```typescript
throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid input');           // 400
throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required'); // 401
throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission'); // 403
throw new ApiError(StatusCodes.NOT_FOUND, 'Club not found');             // 404
throw new ApiError(StatusCodes.CONFLICT, 'Club name already taken');     // 409
throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Invalid state');  // 422
throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Rate limit exceeded');// 429
```

---

## Complete Status Code Reference

| Code | Name | When to use |
|------|------|-------------|
| 200 | OK | Success with data |
| 201 | Created | POST created a new resource |
| 400 | Bad Request | Validation failure, malformed input |
| 401 | Unauthorized | Missing/invalid/expired token |
| 403 | Forbidden | Authenticated but lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate, version conflict, state conflict |
| 415 | Unsupported Media Type | Content-Type is not application/json |
| 422 | Unprocessable Entity | Semantically invalid (business rule violation) |
| 429 | Too Many Requests | Rate limit hit — include `Retry-After` header |
| 500 | Internal Server Error | Unexpected failure |
| 503 | Service Unavailable | DB down, maintenance — include `Retry-After` |

---

## Message Convention

| Action | Pattern |
|--------|---------|
| GET list | `"[Resources] retrieved successfully"` |
| GET single | `"[Resource] retrieved successfully"` |
| POST create | `"[Resource] created successfully"` |
| PATCH update | `"[Resource] updated successfully"` |
| DELETE | `"[Resource] deleted successfully"` |
| Action | `"[Resource] [past-tense verb] successfully"` |

Rules:
- Sentence-case (capitalize first word only)
- No trailing period
- Past tense for mutations
- "retrieved" not "fetched"; "deleted" not "removed"

---

## Field Naming Conventions

- **camelCase** for all JSON fields: `createdAt`, `userId`, `sportType`
- **Never mix** camelCase and snake_case in the same API
- **`_id`** for MongoDB document IDs (project convention)
- **Timestamps**: always return `createdAt` and `updatedAt` (ISO 8601 format)
- **Enums**: lowercase strings preferred: `"active"` not `"ACTIVE"`
- **Booleans**: prefix with `is`/`has`/`can`: `isActive`, `hasMembers`, `canBook`
