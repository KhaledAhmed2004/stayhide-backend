# 02. Get All Questions (Admin)

```http
GET /ask-question
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Allows the `SUPER_ADMIN` to retrieve a paginated list of all questions submitted by users. This endpoint is designed for administrative oversight and answering questions. It supports deep searching, filtering, and sorting via `QueryBuilder`.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only the `SUPER_ADMIN` can access this endpoint.

### 2.2 Query Logic (QueryBuilder)
- **Text Search**: Uses `.textSearch(['question'])`.
- **Filtering**: Allows filtering by any schema field (e.g., `status=pending`, `userRole=SISTER`).
- **Sorting**: Defaults to `-createdAt`.
- **Pagination**: Standard pagination via `.paginate()`.

---

### 2.3 Data Population
- The `userId` field is automatically populated with the user's `name`, `email`, and `role` for administrative context.

---

## 3. Query Parameters

| Parameter | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `searchTerm` | `string` | Search within question text | `Wudu` |
| `status` | `string` | Filter by status (`pending`, `answered`) | `pending` |
| `userRole` | `string` | Filter by user role (`BROTHER`, `SISTER`, `JUMMAH`) | `SISTER` |
| `page` | `number` | Page number | `1` |
| `limit` | `number` | Items per page | `10` |

---

## 4. Implementation
- **Route**: [src/app/modules/ask-question/ask-question.route.ts](../../../src/app/modules/ask-question/ask-question.route.ts) — `router.get('/', ...)`
- **Controller**: [src/app/modules/ask-question/ask-question.controller.ts](../../../src/app/modules/ask-question/ask-question.controller.ts) — `getAllQuestions`
- **Service**: [src/app/modules/ask-question/ask-question.service.ts](../../../src/app/modules/ask-question/ask-question.service.ts) — `getAllQuestionsFromDB`

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Questions fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 125,
    "totalPage": 13
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "userId": {
        "_id": "664a1b2c3d4e5f6a7b8c9d0f",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "BROTHER"
      },
      "userRole": "BROTHER",
      "question": "How to perform Wudu correctly?",
      "imageUrl": "http://localhost:5000/uploads/images/1715421000-abc123.jpg",
      "status": "pending",
      "createdAt": "2026-05-11T10:30:00.000Z",
      "updatedAt": "2026-05-11T10:30:00.000Z"
    }
  ]
}
```
