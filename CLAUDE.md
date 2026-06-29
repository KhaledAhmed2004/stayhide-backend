# CLAUDE.md — Master AI Hub

> Single source of truth for all AI tools (Claude Code, Trae, Antigravity, Cursor).

**Tech Stack**: TypeScript + Express + MongoDB/Mongoose + Socket.IO + Stripe + OpenTelemetry

**Resources** (on-demand, read when needed):
- Templates: `.trae/templates/codebase-blueprint.md`
- Skills: `.trae/skills/[name]/SKILL.md`
- Workflows: `.trae/workflows/`

---

## AI Instructions

1. Follow coding rules below. Always.
2. Use Skills when request matches the Skill Routing table.
3. Follow Workflows for multi-step tasks (read `.trae/workflows/`).
4. Plan before acting (3+ steps).
5. Verify work — build passing, tests run, endpoint tested.
6. **Documentation Integrity**: ONLY document endpoints that actually exist in the codebase. Never add "missing" or "future" APIs to files like `api-inventory.md`.

---

## Development Commands

```bash
npm run dev              # Start dev server
npm run build           # Compile TypeScript
npm run lint:fix        # Auto-fix linting
npm run prettier:fix    # Auto-format
npm test                # Vitest watch mode
npm run test:run        # Run tests once
```

---

## CRITICAL: Import Order (MANDATORY)

Import order in `src/app.ts` and `src/server.ts` — violation causes runtime errors:

1. `mongooseMetrics` — Before any Mongoose models compile
2. `autoLabelBootstrap` — Before routes/controllers load
3. `opentelemetry` — Instrumentation
4. `patchBcrypt`, `patchJWT`, `patchStripe` — Third-party patches
5. **LAST**: `routes` — They import controllers which need auto-labeling

---

## Architecture Rules

Every feature: `src/app/modules/[feature]/` with `interface.ts`, `model.ts`, `controller.ts`, `service.ts`, `route.ts`, `validation.ts`. See `codebase-blueprint.md` for templates.

**Flow**: Route -> `validateRequest(Zod)` -> Controller (`catchAsync`) -> Service (`ApiError`) -> Model -> `sendResponse()`

- **Controllers**: Thin — HTTP only, no business logic
- **Services**: Fat — all logic, DB interaction, throw `ApiError(StatusCode, msg)`
- **QueryBuilder** (`app/builder/QueryBuilder.ts`): `.search()`, `.filter()`, `.sort()`, `.paginate()`, `.fields()`
- **AggregationBuilder** (`app/builder/AggregationBuilder.ts`): `.match()`, `.lookup()`, `.unwind()`, `.group()`
- **File Upload**: `fileHandler(['field'])` or `fileHandler({ maxFileSizeMB, maxFilesTotal, ... })`
- **Observability**: Auto-labeling on `*Controller`/`*Service` classes, `getRequestContext()`, Mongoose metrics
- **Env vars**: via `config/index.ts`, NOT `process.env`

---

## Clean Code Rules

- Meaningful names (`userSubscription` not `sub`), booleans: `isActive`, `hasPermission`
- `camelCase` vars/functions, `PascalCase` classes/interfaces
- Files: `[feature].route.ts` (singular). Paths: plural kebab-case (`/api/v1/users`)
- Functions < 30 lines, `async/await` only, object destructuring
- **No Magic Strings**: NEVER use magic strings (e.g. 'PENDING'). ALWAYS create a `[feature].constants.ts` file.
- Zod in `[feature].validation.ts`, `.lean()` for read-only queries, index search/filter fields

---

## Route Design Rules

**Middleware order**: `rateLimit` -> `auth` -> `fileHandler` -> `validateRequest` -> `Controller`

**Declaration order** (CRITICAL — Express matches in order):
1. Fixed paths first (`/webhook`, `/stats`, `/my-items`)
2. Param paths after (`/:resourceId`, `/:resourceId/modules`)

**Path params**: Always meaningful — `:userId`, `:cardId`, `:bookingId`. **Never bare `:id`** (ambiguous, collides in nested routes).

**Methods**: GET=read, POST=create/action, PATCH=update/toggle, DELETE=remove. Prefer `PATCH /:resourceId` with field in body for state changes (e.g. block via `{ status: "RESTRICTED" }`) — avoid mirrored verb routes like `/block` + `/unblock`.

**Postman**: `public/postman-collection.json` — update on EVERY route change, use `{{baseUrl}}`/`{{accessToken}}`

---

## Workflow Rules

- Simplicity first, root cause fixes, plan before acting, verify with tests
- Docs: Bangla for architecture rationale, English for technical references

---

## Skill Routing

When request matches, invoke the skill FIRST:

| Request Type | Skill |
|---|---|
| Product ideas, brainstorming | `gstack-office-hours` |
| Plan review, strategy | `gstack-ceo-review` |
| Code review, security check | `gstack-review` |
| Bugs, testing, edge cases | `gstack-qa` / `superpowers-tdd` |
| Research, comparing libraries | `gstack-browse` |
| Feature specs, requirements | `gsd-spec` |
| Context rot, progress check | `gsd-state` |
| Complex bug, root cause | `superpowers-debugging` |
| UX Flow docs, API specs | `ux-flow-api-docs` |
| API design, schema audit | `api-design` / `nosql-database-design` |
