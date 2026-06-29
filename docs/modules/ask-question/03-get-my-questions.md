# 03. Get My Questions

```http
GET /ask-question/my-questions
Auth: Bearer {{accessToken}} (BROTHER, SISTER, JUMMAH)
```

## 1. Overview
Allows a registered user (`BROTHER`, `SISTER`, or `JUMMAH`) to retrieve a paginated list of questions they have submitted.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Identity Enforcement**: The `userId` is automatically extracted from the authenticated token.

### 2.2 Query Logic (QueryBuilder)
- **Filtering**: Uses `.filter()` to handle optional filters (e.g., `status`).
- **Sorting**: Defaults to `-createdAt`.
- **Pagination**: Uses `.paginate()`.

---

## 3. Query Parameters

| Parameter | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `status` | `string` | Filter by status (`pending`, `answered`) | `answered` |
| `page` | `number` | Page number | `1` |
| `limit` | `number` | Items per page | `10` |

---

## 4. Implementation
- **Route**: [src/app/modules/ask-question/ask-question.route.ts](../../../src/app/modules/ask-question/ask-question.route.ts) — `router.get('/my-questions', ...)`
- **Controller**: [src/app/modules/ask-question/ask-question.controller.ts](../../../src/app/modules/ask-question/ask-question.controller.ts) — `getMyQuestions`
- **Service**: [src/app/modules/ask-question/ask-question.service.ts](../../../src/app/modules/ask-question/ask-question.service.ts) — `getMyQuestionsFromDB`

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Your questions fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "userId": "664a1b2c3d4e5f6a7b8c9d0f",
      "userRole": "SISTER",
      "question": "How to perform Wudu correctly?",
      "imageUrl": "http://localhost:5000/uploads/images/1715421000-abc123.jpg",
      "status": "answered",
      "answer": "Wudu is performed by washing...",
      "answeredAt": "2026-05-11T12:00:00.000Z",
      "createdAt": "2026-05-11T10:30:00.000Z",
      "updatedAt": "2026-05-11T12:00:00.000Z"
    }
  ]
}
```
