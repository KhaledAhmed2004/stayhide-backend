---
description: Automated code quality review cycle
---

# Code Review Workflow

Use this when the user asks for a code review or "check my diff".

## Steps

1. **Read CLAUDE.md** — Load all architecture and clean code rules before reviewing.

2. **Invoke `gstack-review` skill** for the senior engineer review persona.

3. **Review Architecture Compliance**
   - Is the module structure correct? (interface → model → controller → service → route → validation)
   - Are controllers thin and services fat?
   - Is the import order in `app.ts`/`server.ts` correct?

4. **Review Clean Code**
   - Meaningful names? No abbreviations or single-letter variables?
   - Functions < 30 lines? Single responsibility?
   - `async/await` used throughout? No raw promises?

5. **Review Security**
   - Is `auth()` middleware applied to all protected routes?
   - Are all inputs validated with Zod before reaching the controller?
   - Are `ApiError` instances thrown with correct status codes?

6. **Review Route Design**
   - Fixed paths before param paths?
   - Middleware chain in correct order?
   - Postman collection updated?

7. **Review Database**
   - Are search/filter fields indexed?
   - Is `.lean()` used for read-only queries?
   - Are `ObjectId` references typed correctly?

8. **Provide Feedback**
   - Group findings by: Critical / Warning / Suggestion
   - Explain WHY each change is needed, referencing CLAUDE.md standards
   - Provide corrected code snippets for Critical issues
