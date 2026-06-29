---
description: End-to-end feature implementation workflow
---

# Feature Implementation Workflow

Use this when the user asks to build a new feature or module from scratch.

## Steps

1. **Read CLAUDE.md** — Load all architecture rules and module patterns before starting.

2. **Clarify Scope** — If the feature is unclear, invoke `gsd-spec` skill first to extract requirements.

3. **Plan the Module Structure**
   - Define the files: `interface.ts`, `model.ts`, `controller.ts`, `service.ts`, `route.ts`, `validation.ts`
   - Identify required DB fields, relations, and Zod validations

4. **Create the Interface** (`[feature].interface.ts`)
   - Use the template from `codebase-blueprint.md`
   - Define enums, sub-doc types, main type, and model type with statics

5. **Create the Model** (`[feature].model.ts`)
   - Use the template from `codebase-blueprint.md`
   - Add indexes for all search/filter fields

6. **Create Validation** (`[feature].validation.ts`)
   - Write Zod schemas for `create` and `update`
   - Wrap in `z.object({ body: z.object({...}) })`

7. **Create the Service** (`[feature].service.ts`)
   - Implement all CRUD operations using QueryBuilder for `getAll`
   - Throw `ApiError` for all error cases

8. **Create the Controller** (`[feature].controller.ts`)
   - Thin handlers — extract data, call service, call `sendResponse()`
   - Wrap all handlers in `catchAsync`

9. **Create the Route** (`[feature].route.ts`)
   - Follow declaration order: fixed paths before param paths
   - Middleware chain: `auth` → `fileHandler` → `validateRequest` → `Controller`

10. **Register the Route** (`src/routes/index.ts`)
    - Add `{ path: '/features', route: FeatureRoutes }` to `apiRoutes`

11. **Update Postman Collection**
    - Add all new endpoints to `public/postman-collection.json`

12. **Verify**
    - Run `npm run build` — must compile with zero errors
    - Test each endpoint manually or with tests
    - Run `npm run lint:fix` and `npm run prettier:fix`

13. **Document**
    - Update `CLAUDE.md` module status table if a significant new system was created
