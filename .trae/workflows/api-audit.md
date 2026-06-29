---
description: Full REST API audit and Postman collection sync
---

# API Audit Workflow

Use this when the user asks to audit endpoints or sync the Postman collection.

## Steps

1. **Read CLAUDE.md** — Load route design rules before auditing.

2. **Invoke `api-design` skill** for the API design persona.

3. **Enumerate All Routes**
   - List all routes registered in `src/routes/index.ts`
   - For each module, open the `[feature].route.ts` file

4. **Audit Each Route**
   - Correct HTTP method?
   - Correct resource name (plural, kebab-case)?
   - Fixed paths declared before param paths?
   - Correct middleware chain? (`auth` → `fileHandler` → `validateRequest` → `Controller`)
   - All protected routes have `auth()` middleware?

5. **Audit Validation Schemas**
   - Every `POST`/`PATCH` route has a Zod validation schema?
   - Schema wrapped in `z.object({ body: z.object({...}) })`?

6. **Audit Postman Collection** (`public/postman-collection.json`)
   - Every route has a corresponding Postman request?
   - Request uses `{{baseUrl}}`, `{{accessToken}}` variables?
   - Organized by screens (not backend modules)?

7. **Report Issues**
   - List missing routes, missing validations, missing Postman requests
   - List routes with incorrect middleware order or naming violations

8. **Fix Issues**
   - Apply fixes following CLAUDE.md route design standards
   - Update `public/postman-collection.json` to reflect all changes
