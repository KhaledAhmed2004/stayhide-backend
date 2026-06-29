# Ask Question Module APIs

> **Section**: Backend API specifications for the Ask Question module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Ask Question listing page — Submit questions, view answers
> - Admin Dashboard - Ask Question Management — Review and answer questions

---

## Database Design

### Ask Question Model (`ask-questions`)
Stores user questions and imam answers.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `userId` | ObjectId | ✅ | Reference to the user (ref `User`) |
| `userRole`| String | ✅ | The role of the user when asking (e.g., BROTHER, SISTER, JUMMAH) |
| `question` | String | ✅ | The question content (Max 2000 chars) |
| `imageUrl` | String | ❌ | Optional image attachment (URL) |
| `status` | String | ✅ | Enum: `pending`, `answered` (default: `pending`) |
| `answer` | String | ❌ | The answer provided by SUPER_ADMIN |
| `answeredAt`| Date | ❌ | Timestamp when the answer was provided |

**Indexes**:
- `{ userId: 1 }` — Fast lookup for user's own questions
- `{ userRole: 1 }` — Filtering by asker role
- `{ status: 1 }` — Filtering by pending/answered
- `{ createdAt: -1 }` — Latest questions first
- `{ question: "text" }` — Full-text search on question content

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/ask-question` | `BROTHER`, `SISTER`, `JUMMAH` | ✅ Done: Submits a new question. | [01-submit-question.md](./01-submit-question.md) |
| 02 | GET | `/ask-question` | `SUPER_ADMIN` | ✅ Done: Fetches all questions for admin. | [02-get-all-questions.md](./02-get-all-questions.md) |
| 03 | GET | `/ask-question/my-questions` | `BROTHER`, `SISTER`, `JUMMAH` | ✅ Done: Fetches logged-in user's questions. | [03-get-my-questions.md](./03-get-my-questions.md) |
| 04 | PATCH | `/ask-question/:questionId/answer` | `SUPER_ADMIN` | ✅ Done: Admin provides an answer. | [04-answer-question.md](./04-answer-question.md) |
| 05 | GET | `/ask-question/analytics` | `SUPER_ADMIN` | ✅ Done: Stats for pending/answered questions. | [05-get-analytics.md](./05-get-analytics.md) |
