# API Response Standard

> Every endpoint in this codebase uses `sendResponse()` from `src/shared/sendResponse.ts`.
> This document is the single source of truth for the response envelope and `meta` convention.

---

## Envelope

Every response has this shape:

```json
{
  "success":    true,
  "statusCode": 200,
  "message":    "Human-readable description of what happened",
  "meta":       { },
  "data":       { }
}
```

| Field        | Type      | Required | Description |
|--------------|-----------|----------|-------------|
| `success`    | boolean   | ✅       | `true` for 2xx, `false` for errors |
| `statusCode` | number    | ✅       | Mirrors the HTTP status code |
| `message`    | string    | ✅       | Human-readable. Used by UI toasts and logs |
| `meta`       | object    | optional | Pagination, counts, and domain metadata |
| `data`       | any       | optional | The actual payload. `null` for mutations with no return value |

---

## `meta` Convention

All fields in `meta` are **flat** — no nested sub-objects.

```json
// ✅ correct
"meta": { "limit": 10, "nextCursor": "abc==", "hasNext": true, "unreadCount": 3 }

// ❌ wrong — never nest a pagination sub-object
"meta": { "pagination": { "limit": 10, "nextCursor": "abc==" }, "unreadCount": 3 }
```

---

### 1. Cursor Pagination

Used for **real-time feeds** where new items arrive between page loads.
Modules: notifications, user profiles, connections, connection requests.

```json
"meta": {
  "limit":       10,
  "nextCursor":  "NmEwZTI0MDQ4MjQ5OTE4YTg0YTI4MTAz",
  "hasNext":     true
}
```

When there are no more pages: `"nextCursor": null, "hasNext": false`.

**Client usage:**
```
First page : GET /api/v1/resource
Next page  : GET /api/v1/resource?nextCursor=NmEwZTI0...
Stop when  : meta.hasNext === false
```

**Domain counts** (e.g. `unreadCount`) may be added alongside cursor fields:
```json
"meta": { "limit": 10, "nextCursor": null, "hasNext": false, "unreadCount": 1 }
```

---

### 2. Offset Pagination

Used for **stable admin lists** where total counts are meaningful and drift is not a concern.
Modules: support tickets, broadcast history, admin user list.

```json
"meta": {
  "page":       1,
  "limit":      10,
  "total":      47,
  "totalPages": 5,
  "hasNext":    true,
  "hasPrev":    false
}
```

---

### 3. Domain-Only Meta

Used when there is no pagination but response-level metadata is needed.
Modules: metrics, analytics, growth stats.

```json
"meta": {
  "comparisonPeriod": "month"
}
```

---

## Error Envelope

Errors follow the same outer shape. `data` is `null`.

```json
{
  "success":    false,
  "statusCode": 404,
  "message":    "User not found",
  "data":       null
}
```

Validation errors include a `errorMessages` array:

```json
{
  "success":       false,
  "statusCode":    400,
  "message":       "Validation failed",
  "errorMessages": [
    { "path": "email", "message": "Email is required" }
  ],
  "data":          null
}
```

---

## Real Examples

### Cursor paginated list

```json
{
  "success":    true,
  "statusCode": 200,
  "message":    "Notifications retrieved successfully",
  "meta": {
    "limit":       10,
    "nextCursor":  null,
    "hasNext":     false,
    "unreadCount": 3
  },
  "data": [ ... ]
}
```

### Offset paginated list

```json
{
  "success":    true,
  "statusCode": 200,
  "message":    "Tickets fetched successfully",
  "meta": {
    "page":       1,
    "limit":      10,
    "total":      23,
    "totalPages": 3,
    "hasNext":    true,
    "hasPrev":    false
  },
  "data": [ ... ]
}
```

### Single resource

```json
{
  "success":    true,
  "statusCode": 200,
  "message":    "User profile fetched successfully",
  "data": { "id": "...", "name": "Khaled Ahmed", ... }
}
```

### Mutation with no return value

```json
{
  "success":    true,
  "statusCode": 200,
  "message":    "Notification marked as read successfully",
  "data":       null
}
```

---

## Rules

1. **Always use `sendResponse()`** — never call `res.json()` directly in a controller
2. **Never nest inside `meta`** — all meta fields are flat
3. **`message` is always present** — even on mutations
4. **Choose the right pagination type** — cursor for feeds, offset for admin lists
5. **Domain counts go in `meta`** alongside pagination fields, not in `data`
