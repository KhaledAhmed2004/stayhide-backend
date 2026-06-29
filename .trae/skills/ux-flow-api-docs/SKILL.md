---
name: "ux-flow-api-docs"
description: "Create or update screen-by-screen API documentation combining UX narrative with endpoint specs and response shapes. Invoke for UX flow doc, dashboard/app screen API doc, or response shapes."
---

# UX Flow API Docs Skill

Produces screen-by-screen API documentation: UX narrative + endpoint specs together, 
consistent Markdown format, token-efficiently. Every output is written in **Banglish** 
(Bengali sentences using English script — not Bengali Unicode characters).

---

## CRITICAL: Output Language Style

All generated documentation must be written in **Banglish** — this is non-negotiable.

**Banglish** means: Bengali language, romanized in English script. Technical terms, 
code references, HTTP methods, field names, and endpoint paths stay in English. 
Everything else (narrative, notes, context) is spoken Bengali written in Latin letters.

**Wrong (Bengali Unicode):**
```
১. Student "Create Account" এ tap করে
২. Success হলে → Home screen এ navigate করে
```

**Wrong (full English):**
```
1. Student taps "Create Account"
2. On success → navigates to Home screen
```

**Correct (Banglish):**
```
1. Student "Create Account" e tap kore
2. Submit → `POST /users` (→ 1.1)
3. Success → OTP verify screen e navigate kore + email check korte bole
4. Email na pele → "Resend" button → `POST /auth/resend-verify-email` (→ 1.3)
5. OTP input kore submit → `POST /auth/verify-email` (→ 1.2)
6. Auto-login hoy → tokens paye → Home screen e navigate
```

Apply this style everywhere: UX Flow steps, context notes (`>`), inline comments, 
section descriptions. Code blocks, JSON, and HTTP specs are always pure English.

## CRITICAL: Accuracy & Source of Truth

To prevent mismatches between documentation and implementation (e.g., OTP vs. Reset Link), you MUST follow these rules:

1.  **NO GUESSING**: Never guess message strings, status codes, or logic. If you don't have the file in context, use the `Read` tool to examine it.
2.  **EXACT MESSAGES**: Copy `message` strings exactly as they appear in the Controller. Wording must match the frontend expectations.
3.  **LOGIC VERIFICATION**: Check the Service layer to see if it sends an OTP, a link, or a token. The UX Flow narrative must reflect the actual backend logic.
4.  **ROUTING TRUTH**: Always check the Route file to verify `auth()` requirements and the middleware chain order.

Failure to verify against the source code will result in "Broken" or "Review" status in the API Status table.

---

## CRITICAL: Documentation Integrity (No "Imaginary" APIs)

You are strictly forbidden from adding "missing", "future", or "suggested" APIs to the `api-inventory.md` or any UX flow documentation unless those APIs are already implemented in the routes and controllers.

- **Source of Truth**: The code (Routes/Controllers) is the only source of truth for the documentation.
- **No Gaps**: Do not fill "gaps" in the documentation with endpoints that should exist but don't.
- **Suggest, Don't Doc**: If you identify a missing feature (like a broadcast API or device token endpoint), mention it to the user in the chat. Do NOT add it to the `api-inventory.md` with a ❌ Status.

---

## Output Folder Structure

```
ux-flow-with-api-responses/
├── README.md
├── api-inventory.md          ← Central tracker for all APIs & implementations
├── app-screens/
│   ├── 01-auth.md
│   ├── 02-welcome-onboarding.md
│   └── ...
└── dashboard-screens/
    ├── 01-auth.md
    ├── 02-overview.md
    └── ...
```

File naming: `NN-kebab-case.md` — always zero-padded (`01`, `02`, `10`, `14`). 
Apply this structure even when producing a single screen doc.

---

## README.md Template

```markdown
# UX Flow with API Responses

Screen-by-screen API flow — **Student App** ebong **Admin Dashboard** dutor jonno. 
Each screen e APIs called, method/URL, auth requirement, ebong expected response shape ache.

> Base URL: `{{baseUrl}}` = `http://localhost:5000/api/v1`

---

## Standard Response Envelope

Shob API ei format follow kore:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "pagination": { "page": 1, "limit": 10, "total": 50, "totalPage": 5 },
  "data": "..."
}
```

`pagination` শুধু list endpoint e thake. `data` er shape endpoint bhede alada.

---

## Part 1: App APIs (Student-Facing)

| # | Screen | Description |
|---|--------|-------------|
| 1 | [Auth](./app-screens/01-auth.md) | Register, login, OTP verify, password reset, refresh token |
| 2 | [Welcome / Onboarding](./app-screens/02-welcome-onboarding.md) | Published courses list for onboarding flow |
...

---

## Part 2: Dashboard APIs (Admin-Facing)

| # | Screen | Description |
|---|--------|-------------|
| 1 | [Auth](./dashboard-screens/01-auth.md) | Admin login, token management |
| 2 | [Overview](./dashboard-screens/02-overview.md) | Dashboard stats, counts, recent activity |
...
```

---

## Screen Doc — Full Template

Every screen doc must follow this exact structure. No section may be omitted.

```markdown
# Screen N: {Screen Name}

> **Section**: App APIs (Student-Facing) OR Dashboard APIs (Admin-Facing)
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../README.md#standard-response-envelope)
> **Related screens**: [Screen Name](./NN-screen.md) (one-line reason in Banglish)

## UX Flow

### {Flow Name} (e.g. Registration Flow, Login Flow, Forgot Password Flow)
1. Banglish narrative step — ki hoy
2. Submit → `POST /endpoint` (→ N.X)
3. Success → kothai navigate kore, ki paye
4. Error hole → ki dekhay, kothai jay

### {Another Flow if needed}
1. ...

---

## Edge Cases (Kono special scenario ba security rules thakle)

- **Scenario Name**: Banglish description of behavior.
- **Enumeration Prevention**: Silent success jodi user na thake.
- **Security**: Token rotation ba session expiry rules.

---

<!-- ══════════════════════════════════════ -->
<!--         {FLOW GROUP NAME}              -->
<!-- ══════════════════════════════════════ -->

### N.1 {Endpoint Name}

```
METHOD /path
Content-Type: application/json
Auth: None
```

> Banglish context note — ei endpoint kokhon use hoy, kono special behavior thakle.

**Request Body:**
```json
{
  "field": "value"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

> Banglish note about cookie, token rotation, or side effects.

---

### N.2 {Next Endpoint}
...

---

## API Status

| # | Endpoint | Status | Notes |
|---|----------|:------:|-------|
| N.1 | `POST /path` | ✅ Done | one-line description |
| N.2 | `GET /path` | 🚧 Pending | ki baki |
```

---

## UX Flow Writing Rules

The UX Flow section narrates the user journey **from the user's perspective**, step by step. 
Write it like you are explaining to a developer what the frontend does and why each API is called.

**Step format rules:**
- Use standard numbers: `1.` `2.` `3.` (not Bengali numerals)
- API calls use `→` arrow with endpoint reference: `→ \`POST /endpoint\` (→ N.X)`
- Always show both success path AND failure/edge path
- Background flows (silent token refresh, auto-retry) go in a separate subsection
- Optional paths (e.g. "Skip" button) are their own subsection

**Banglish UX narrative examples:**
```
1. Student "Create Account" e tap kore
2. Name, email, password, gender, dateOfBirth input kore
3. Submit → `POST /users` (→ 1.1)
4. Success → OTP verify screen e navigate + email check korte bole
5. Email na pele → "Resend" button → `POST /auth/resend-verify-email` (→ 1.3)
6. OTP input kore submit → `POST /auth/verify-email` (→ 1.2)
7. Auto-login hoy → tokens paye → Home screen e navigate
```

```
1. Admin sidebar theke "User Management" e click kore
2. Page load e parallel API calls:
   - Stat cards → `GET /users/stats` (→ 3.1)
   - User table → `GET /users?page=1&limit=10` (→ 3.2)
3. Screen render hoy: stat cards → search bar → user table
```

---

## Endpoint Spec Rules

### Section Dividers
Use comment dividers whenever a new flow group starts:
```
<!-- ══════════════════════════════════════ -->
<!--         FORGOT PASSWORD FLOW           -->
<!-- ══════════════════════════════════════ -->
```

### Markdown Tables (MANDATORY for Postman Generator)
When creating tables for `Query Parameters`, `Path Parameters`, or `Request Body`, you **MUST** include an `Example` or `Default` column. The `generate-postman.ts` script explicitly looks for these columns to populate Postman.

```markdown
| Field | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `name` | `string` | ✅ | User's full name | `John Doe` |
```

### HTTP Spec Block
```
POST /auth/login
Content-Type: application/json
Auth: None
```
- Omit `Content-Type` for GET and DELETE (no body)
- Public endpoints: `Auth: None`
- Protected: `Auth: Bearer {{accessToken}} (SUPER_ADMIN)` or `(STUDENT)` etc.

### Request Body
- GET requests or no-body endpoints → **omit the Request Body section entirely**
- Optional fields: inline comment `"deviceToken": "fcm-token"  // optional`
- Accompany with Banglish note: `> deviceToken optional — push notification er jonno. Na thakle omit koro.`

### Response Status
- HTTP 200 → `**Response:**` (no status needed)
- Non-200 → `**Response (201):**` or `**Response (404):**` etc.
- Always show the full envelope: `success`, `message`, and `data`
- List endpoints must include `pagination` field

### Response Scenarios (MANDATORY for multiple outcomes)
If an endpoint has different success/error outcomes, group them under a `#### Responses` heading using the scenario format:

```markdown
#### Responses

- **Scenario: Success (200)**
  ```json
  { ... }
  ```
- **Scenario: Error Name (4XX)**
  ```json
  { ... }
  ```
```

### Data Formatting
```
Token:    "eyJhbGciOi..."                  ← always truncate
ObjectId: "664a1b2c3d4e5f6a7b8c9d0e"      ← realistic 24-char hex
Date:     "2026-03-15T10:30:00.000Z"       ← ISO 8601
URL:      " `https://cdn.example.com/file` "   ← realistic domain
Name:     "John Doe" / "Jane Smith"        ← real-looking dummy
```

### Context Notes (the `>` lines)
Write these in Banglish — they explain behavior that isn't obvious from the spec alone:
```
> Registration flow e use hoy. New user OTP verify korle auto-login hoy — tokens return kore.
> `refreshToken` also set as httpOnly cookie.
> `data` te reset token ashe — N.X Reset Password e ei token pathate hobe.
> Body optional jodi `refreshToken` cookie te already ache.
```

---

## Response Shape Reference

### Auth Tokens
```json
{
  "success": true,
  "message": "User logged in successfully.",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

### Paginated List
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "pagination": { "page": 1, "limit": 10, "total": 500, "totalPage": 50 },
  "data": [
    { "_id": "664a1b2c3d4e5f6a7b8c9d0e", "name": "John Doe", "email": "john@example.com" }
  ]
}
```

### Dashboard Growth Metric
```json
{
  "comparisonPeriod": "month",
  "totalStudents": { "value": 500, "growth": 12, "growthType": "increase" },
  "activeStudents": { "value": 280, "growth": 3, "growthType": "decrease" }
}
```
`growthType`: `"increase"` | `"decrease"` | `"no_change"`

### Message Only (no data field)
```json
{ "success": true, "message": "Password reset successfully." }
```

### Soft Delete
```json
{ "success": true, "message": "User deleted successfully" }
```

### Activity Feed Item
```json
{
  "_id": "664b1a2c3d4e5f6a7b8c9d0e",
  "type": "ENROLLMENT",
  "title": "John Doe enrolled in Introduction to Web Development",
  "timestamp": "2026-03-18T10:00:00Z"
}
```

### Bulk Operation
```json
{
  "success": true,
  "message": "Enrolled in 2 course(s) successfully",
  "data": { "enrolledCount": 2, "skippedCount": 0 }
}
```

---

## API Status Table

End every screen doc with this table. Use these status icons consistently:

| Icon | Meaning |
|------|---------|
| ✅ Done | Implemented + tested |
| 🚧 Pending | Not yet implemented |
| ⚠️ Review | Implemented but needs review |
| ❌ Broken | Known bug or regression |

---

## Module Structure Reference

Every endpoint spec should include the **Implementation** note referencing all three layers:

```markdown
> **Implementation:**
> - **Route**: `src/app/modules/{feature}/{feature}.route.ts`
> - **Controller**: `src/app/modules/{feature}/{feature}.controller.ts` — `methodName`
> - **Service**: `src/app/modules/{feature}/{feature}.service.ts` — `serviceMethodName`
```

The 6-file pattern every module follows:
```
src/app/modules/{feature}/
├── {feature}.interface.ts    ← TypeScript types, enums
├── {feature}.model.ts        ← Mongoose schema, indexes, pre/post hooks
├── {feature}.service.ts      ← Business logic — all DB calls (fat layer)
├── {feature}.controller.ts   ← HTTP handlers — req/res only (thin layer)
├── {feature}.validation.ts   ← Zod schemas
└── {feature}.route.ts        ← Routes + middleware: auth → validate → controller
```

Middleware chain order: `auth() → validateRequest() → fileHandler() → rateLimit() → Controller`

---

## Token-Efficient Workflow

### Creating a new screen doc
1. Collect from user: screen name, section (app/dashboard), endpoint list, code files (optional)
2. Write **UX Flow first** — narrative before specs
3. Write **Edge Cases** — document security rules, enumeration prevention, and error handling behaviors.
4. Group endpoints by flow, in flow order (e.g. Registration → Login → Forgot → Background)
5. Write endpoint specs with section dividers between groups
6. **Update Postman Collection**: Update or add the corresponding requests in `public/tbsosick.postman_collection.json`. Ensure names, methods, URLs, headers, and body shapes match the documentation exactly.
7. **Update API Inventory**: Add the new endpoints to `ux-flow-with-api-responses/api-inventory.md`. Include roles/access (e.g., Public, SUPER_ADMIN, Reset Token) and links to the "Implementation" section line ranges in the newly created markdown file (e.g., `[NN-name.md:L100-104](./path/to/NN-name.md#L100-104)`).
8. Add API Status table at the end
9. Self-check: numbering consistent? Full envelope everywhere? Banglish throughout? Postman updated? Inventory updated with Roles?

### Updating an existing doc
1. Only touch changed sections. Leave everything else as-is.
2. Update the API Status table row for any changed endpoint.
3. **Sync Postman**: Immediately reflect the changes in `public/tbsosick.postman_collection.json`.
4. **Sync API Inventory**: If implementation details or endpoint paths changed, update the corresponding row in `ux-flow-with-api-responses/api-inventory.md`. Ensure the line range links are still accurate.
5. **Sync Database Design**: If a schema change or relationship update was part of the task, update `ux-flow-with-api-responses/database-design.md` following the Banglish documentation style.

---

## Postman Collection Sync Rules

- **Single Source of Truth**: The Postman collection must match the screen docs 1:1.
- **Variables**: Use `{{BASE_URL}}` for the base prefix `/api/v1`.
- **Auth**: Use Bearer token or appropriate auth type. Store tokens in collection variables if possible (e.g., `AdminAccessToken`).
- **Descriptions**: Copy the Banglish context notes into the Postman request description.
- **Naming**: Request names in Postman should match the "Endpoint Name" in the doc (e.g., "1.1 Login").

---

