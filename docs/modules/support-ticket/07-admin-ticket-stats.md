# 07. Admin — Ticket Stats

```http
GET /support-tickets/admin/stats
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Aggregated counts for the admin dashboard. No filters yet — returns global counts by `status`, `priority`, and `category` plus the grand total. Cheap operation (three small `$group` aggregations + one `countDocuments`).

## 2. Implementation
- **Route**: `router.get('/admin/stats', ...)`
- **Controller**: `SupportTicketController.getTicketStats`
- **Service**: `SupportTicketService.getTicketStats` — runs the four queries in `Promise.all`.

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ticket stats fetched successfully",
  "data": {
    "total": 132,
    "byStatus": {
      "OPEN": 24,
      "IN_PROGRESS": 18,
      "RESOLVED": 60,
      "CLOSED": 28,
      "REOPENED": 2
    },
    "byPriority": {
      "LOW": 40,
      "MEDIUM": 75,
      "HIGH": 17
    },
    "byCategory": {
      "BILLING": 33,
      "ACCOUNT": 27,
      "BUG": 41,
      "FEATURE": 12,
      "OTHER": 19
    }
  }
}
```

Keys for any bucket with `0` documents are omitted (driven by `$group`, which never emits empty buckets). Front-end should default missing keys to `0`.

### Error: Forbidden role (403)
```json
{ "success": false, "statusCode": 403, "message": "You don't have permission to access this API" }
```
