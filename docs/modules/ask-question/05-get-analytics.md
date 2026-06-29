# 05. Get Question Metrics (Admin)

```http
GET /ask-question/metrics
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Allows the `SUPER_ADMIN` to retrieve module-wide metrics for the "Ask Question" system, including growth percentages compared to the previous month.

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Account Status
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only the `SUPER_ADMIN` can access metrics.

### 2.2 Data Calculation Logic
- **`totalQuestions`**: Total count and growth of all questions.
- **`answeredQuestions`**: Count and growth of questions with `answered` status.
- **`pendingQuestions`**: Count and growth of questions with `pending` status.
- **Comparison**: Calculations are based on the current month vs. the previous month.

---

## 3. Implementation
- **Route**: [src/app/modules/ask-question/ask-question.route.ts](../../../src/app/modules/ask-question/ask-question.route.ts) — `router.get('/metrics', ...)`
- **Controller**: [src/app/modules/ask-question/ask-question.controller.ts](../../../src/app/modules/ask-question/ask-question.controller.ts) — `getQuestionMetrics`
- **Service**: [src/app/modules/ask-question/ask-question.service.ts](../../../src/app/modules/ask-question/ask-question.service.ts) — `getQuestionMetricsFromDB`

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Question metrics retrieved",
  "data": {
    "meta": {
      "comparisonPeriod": "month"
    },
    "totalQuestions": {
      "value": 50,
      "changePct": 10,
      "direction": "up"
    },
    "answeredQuestions": {
      "value": 40,
      "changePct": 15,
      "direction": "up"
    },
    "pendingQuestions": {
      "value": 10,
      "changePct": 5,
      "direction": "down"
    }
  }
}
```
