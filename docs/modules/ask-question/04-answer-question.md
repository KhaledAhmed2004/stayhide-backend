# 04. Answer Question (Admin)

```http
PATCH /ask-question/:questionId/answer
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Allows the `SUPER_ADMIN` to provide a formal answer to a specific user question. This action updates the question's state and records the timestamp of the response.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only the `SUPER_ADMIN` can provide answers.

### 2.2 Input Validation (Zod — `answerQuestionZodSchema`)
| Field | Type | Required | Description | Constraint |
| :--- | :--- | :--- | :--- | :--- |
| `answer` | `string` | Yes | The formal answer text | Minimum 1 character after trimming. |

### 2.3 Database State Transitions
- **`status`**: Forced to `answered`.
- **`answer`**: Updated with the provided text.
- **`answeredAt`**: Automatically set to the current `Date`.

---

## 3. Request Body

```json
{
  "answer": "This is the formal answer to the question."
}
```

---

## 4. Implementation
- **Route**: [src/app/modules/ask-question/ask-question.route.ts](../../../src/app/modules/ask-question/ask-question.route.ts) — `router.patch('/:questionId/answer', ...)`
- **Controller**: [src/app/modules/ask-question/ask-question.controller.ts](../../../src/app/modules/ask-question/ask-question.controller.ts) — `answerQuestion`
- **Service**: [src/app/modules/ask-question/ask-question.service.ts](../../../src/app/modules/ask-question/ask-question.service.ts) — `answerQuestionInDB`
- **Validation**: [src/app/modules/ask-question/ask-question.validation.ts](../../../src/app/modules/ask-question/ask-question.validation.ts) — `AskQuestionValidation.answerQuestionZodSchema`

---

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Question answered successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "userId": "664a1b2c3d4e5f6a7b8c9d0f",
    "userRole": "BROTHER",
    "question": "How to perform Wudu correctly?",
    "imageUrl": "http://localhost:5000/uploads/images/1715421000-abc123.jpg",
    "status": "answered",
    "answer": "Wudu is performed by washing...",
    "answeredAt": "2026-05-11T12:00:00.000Z",
    "createdAt": "2026-05-11T10:30:00.000Z",
    "updatedAt": "2026-05-11T12:00:00.000Z"
  }
}
```
