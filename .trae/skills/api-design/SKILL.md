---
name: "api-design"
description: "Standards for REST API design, building, and auditing in Express/TS. Invoke when designing routes, scaffolding modules, auditing API code, or handling REST scenarios like auth/validation/errors."
---

# API Design Skill

## Reference Map — load only what you need

| Task | Load |
|---|---|
| Build new endpoint / scaffold module | `references/build.md` |
| Audit existing code | `references/audit.md` |
| REST principles, naming, versioning, headers | `references/rest-principles.md` |
| Security — helmet, CORS, rate limiting, JWT | `references/security.md` |
| Response shapes, errors, status codes | `references/contracts.md` |
| Pagination, filtering, sorting, search | `references/query.md` |
| File uploads (images, documents) | `references/uploads.md` |
| Logging, error infrastructure, testing | `references/infra.md` |
| Real-time — WebSocket, SSE vs polling | `references/realtime.md` |

Load multiple files when a task spans concerns (e.g. building a file-upload endpoint → `build.md` + `uploads.md`).

---

## Project Stack

| Concern | Tool / Convention |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Validation | Zod → `[feature].validation.ts` |
| Auth middleware | `auth(USER_ROLES.X)` |
| Async wrapper | `catchAsync` — `src/shared/catchAsync.ts` |
| Response | `sendResponse()` — `src/shared/sendResponse.ts` |
| Errors | `ApiError` — `src/errors/ApiError.ts` |
| Pagination | `QueryBuilder` — always for list endpoints |
| Status codes | `http-status-codes` → `StatusCodes.OK` etc. |
| Logger | `pino` — `src/shared/logger.ts` |
| Tests | Jest + Supertest |

---

## Canonical Patterns (always apply)

### Route
```typescript
// Always name path params after the resource (`:featureId`), never bare `:id`.
router.post('/', auth(USER_ROLES.ADMIN), validateRequest(FeatureValidation.createSchema), FeatureController.create);
router.get('/', auth(USER_ROLES.ADMIN), validateRequest(FeatureValidation.querySchema), FeatureController.getAll);
router.get('/:featureId', auth(USER_ROLES.ADMIN), FeatureController.getById);
router.patch('/:featureId', auth(USER_ROLES.ADMIN), validateRequest(FeatureValidation.updateSchema), FeatureController.update);
router.delete('/:featureId', auth(USER_ROLES.ADMIN), FeatureController.remove);
```

### Controller
```typescript
const create = catchAsync(async (req: Request, res: Response) => {
  const result = await FeatureService.create(req.body);
  res.set('Location', `/api/v1/features/${result._id}`);
  sendResponse(res, { success: true, statusCode: StatusCodes.CREATED, message: 'Feature created successfully', data: result });
});

const getAll = catchAsync(async (req: Request, res: Response) => {
  const result = await FeatureService.getAll(req.query);
  sendResponse(res, { success: true, statusCode: StatusCodes.OK, message: 'Features retrieved successfully', pagination: result.pagination, data: result.data });
});
```

### Error throws
```typescript
throw new ApiError(StatusCodes.NOT_FOUND, 'Feature not found');
throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission');
throw new ApiError(StatusCodes.CONFLICT, 'Feature already exists');
```

---

## HTTP Method → Status Code Matrix

| Method | Scenario | Code |
|--------|----------|------|
| GET list | success | 200 |
| GET single | success / not found | 200 / 404 |
| POST create | created | 201 |
| POST action | success (login, cancel…) | 200 |
| PATCH | updated | 200 |
| DELETE (soft) | deleted | 200 |
| Any | validation fail | 400 |
| Any | unauthenticated | 401 |
| Any | forbidden (RBAC / ownership) | 403 |
| Any | duplicate / state conflict | 409 |
| Any | rate limited | 429 |
| Any | server error | 500 |

---

## URL Naming (Quick Rules)

- Plural nouns, kebab-case: `/api/v1/turf-bookings`
- Sub-resources for ownership: `/api/v1/clubs/:clubId/members`
- **Path params must be meaningful** — `:userId`, `:clubId`, `:bookingId`. **Never bare `:id`.**
- Verbs only for state transitions: `/api/v1/bookings/:bookingId/cancel`
- **State change = field update on the resource**, not a separate route. Don't make `/block` + `/unblock` pairs — use `PATCH /:resourceId` with the field in the body.
- Never: ~~`/getUsers`~~ ~~`/userProfile`~~ ~~`/deleteClub`~~ ~~`/users/:id`~~
- Always versioned: `/api/v1/...`

---

## Token Efficiency Rules

- Load only the reference file(s) relevant to the task.
- Audits: group violations by severity — never reprint unchanged code.
- Builds: output all files in one response. No TODOs, no `// ...` gaps.
- If the user asks about one layer only, generate only that layer.
- Don't repeat the `sendResponse` type signature inline — it lives in `contracts.md`.
