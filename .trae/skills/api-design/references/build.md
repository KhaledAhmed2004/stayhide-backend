# Build Guide — New Endpoints

Read this when scaffolding a new feature module from scratch. The goal is to produce all files in one pass — production-ready, no placeholders.

---

## Pre-Build Checklist

Confirm these before writing code. If the user hasn't specified, infer sensible defaults and state your assumptions clearly.

1. **Resource name** — noun, plural (`turfs`, `bookings`, `clubs`, `tournaments`)
2. **Ownership** — is it a sub-resource? (`/clubs/:clubId/members`)
3. **Methods needed** — GET list / GET single / POST / PATCH / DELETE?
4. **Auth** — which roles per method? (`ADMIN`, `USER`, public)
5. **Request shape** — body fields, types, constraints?
6. **Business rules** — uniqueness? ownership checks? status transitions?
7. **Soft delete or hard delete?** — default to soft delete (see pattern below)

---

## File Generation Order

Always generate in this order — each file builds on the previous:

1. `[feature].interface.ts` — TypeScript types (the single source of truth for shapes)
2. `[feature].model.ts` — Mongoose schema + model
3. `[feature].validation.ts` — Zod request schemas
4. `[feature].service.ts` — business logic
5. `[feature].controller.ts` — HTTP layer
6. `[feature].routes.ts` — wires it all together

Register in `src/routes/index.ts` after generating all files.

---

## Full Scaffold Templates

Replace `[Feature]` / `[feature]` / `[features]` throughout.

### 1. `[feature].interface.ts`

This file is the contract. Everything else (model, service, controller) imports from here — never define raw types inline elsewhere.

```typescript
import { Document, Model, Types } from 'mongoose';

// Core domain fields
export type T[Feature] = {
  name: string;
  sport: 'football' | 'cricket' | 'basketball' | 'other';
  status: 'active' | 'inactive';
  createdBy: Types.ObjectId;
  // add domain-specific fields
  isDeleted: boolean;
  deletedAt?: Date;
};

// Mongoose document type
export type T[Feature]Document = T[Feature] & Document;

// Mongoose model type
export type T[Feature]Model = Model<T[Feature]Document>;

// Payload types for service layer
export type T[Feature]Create = Omit<T[Feature], 'isDeleted' | 'deletedAt' | 'status'>;
export type T[Feature]Update = Partial<Omit<T[Feature], 'isDeleted' | 'deletedAt' | 'createdBy'>>;
```

---

### 2. `[feature].model.ts`

The model mirrors the interface exactly. Indexes here directly impact query performance — always add indexes for fields used in filters, sorts, and searches.

```typescript
import { Schema, model } from 'mongoose';
import { T[Feature]Document, T[Feature]Model } from './[feature].interface';

const [feature]Schema = new Schema<T[Feature]Document>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    sport: { type: String, enum: ['football', 'cricket', 'basketball', 'other'], required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Soft delete fields — always include
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;         // remove internal Mongoose version key
        delete ret.isDeleted;   // never expose soft-delete internals to clients
        delete ret.deletedAt;
        return ret;
      },
    },
  },
);

// Indexes — add for every field used in filter(), sort(), or search()
[feature]Schema.index({ sport: 1 });
[feature]Schema.index({ status: 1, createdAt: -1 });
[feature]Schema.index({ createdBy: 1, isDeleted: 1 });
[feature]Schema.index({ name: 'text' }); // enables searchTerm full-text search
// Unique constraint example (if needed):
// [feature]Schema.index({ name: 1 }, { unique: true });

// Always filter out soft-deleted docs in default queries
[feature]Schema.pre(/^find/, function (next) {
  (this as any).where({ isDeleted: false });
  next();
});

export const [Feature] = model<T[Feature]Document, T[Feature]Model>('[Feature]', [feature]Schema);
```

---

### 3. `[feature].validation.ts`

Zod schemas define exactly what the API accepts. Being strict about input here (`.strict()` on bodies) means unrecognised fields are rejected before they ever reach the service — preventing mass-assignment vulnerabilities and making bugs easier to catch.

```typescript
import { z } from 'zod';

const createSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: 'Name is required' })
        .min(1, 'Name cannot be empty')
        .max(100, 'Name cannot exceed 100 characters')
        .trim()
        .describe('Display name of the resource'),
      sport: z.enum(['football', 'cricket', 'basketball', 'other'], {
        required_error: 'Sport type is required',
        invalid_type_error: 'Sport must be one of: football, cricket, basketball, other',
      }),
      // add domain-specific fields
    })
    .strict(), // rejects any extra fields — prevents mass-assignment
});

const updateSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(100).trim().optional(),
      sport: z.enum(['football', 'cricket', 'basketball', 'other']).optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

const querySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    searchTerm: z.string().optional(),
    sport: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

export const [Feature]Validation = {
  createSchema,
  updateSchema,
  querySchema,
  idParamSchema,
};
```

---

### 4. `[feature].service.ts`

All business logic lives here. Services are framework-agnostic — no `req`/`res` references, no Express imports. This makes them unit-testable in isolation and reusable across REST, WebSocket, or background jobs.

```typescript
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import logger from '../../shared/logger';
import { [Feature] } from './[feature].model';
import { T[Feature]Create, T[Feature]Update } from './[feature].interface';

const getAll = async (query: Record<string, unknown>) => {
  const result = new QueryBuilder([Feature].find(), query)
    .search(['name'])        // fields that respond to ?searchTerm=
    .filter()                // exact-match filters from remaining query params
    .sort()
    .paginate()
    .fields();

  const [data, pagination] = await Promise.all([
    result.modelQuery.lean(), // .lean() returns plain JS objects (~30% faster for reads)
    result.countTotal(),
  ]);

  return { data, pagination };
};

const getById = async (id: string) => {
  const result = await [Feature].findById(id).lean();
  if (!result) throw new ApiError(StatusCodes.NOT_FOUND, '[Feature] not found');
  return result;
};

const create = async (payload: T[Feature]Create, createdBy: string) => {
  // Uniqueness check (include if name must be unique)
  const existing = await [Feature].findOne({ name: payload.name });
  if (existing) throw new ApiError(StatusCodes.CONFLICT, `A [feature] named "${payload.name}" already exists`);

  const result = await [Feature].create({ ...payload, createdBy });
  logger.info({ id: result._id, action: '[feature].create' }, '[Feature] created');
  return result;
};

const update = async (id: string, payload: T[Feature]Update, requesterId: string) => {
  const existing = await [Feature].findById(id);
  if (!existing) throw new ApiError(StatusCodes.NOT_FOUND, '[Feature] not found');

  // Object-level ownership check (remove if ADMIN can update anything)
  if (existing.createdBy.toString() !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to update this [feature]');
  }

  const result = await [Feature].findByIdAndUpdate(id, payload, {
    new: true,           // return the updated document
    runValidators: true, // run Mongoose schema validators on update
  });

  return result;
};

// Soft delete — marks as deleted without removing from DB, preserving audit history
const remove = async (id: string, requesterId: string) => {
  const existing = await [Feature].findById(id);
  if (!existing) throw new ApiError(StatusCodes.NOT_FOUND, '[Feature] not found');

  if (existing.createdBy.toString() !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to delete this [feature]');
  }

  await [Feature].findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() });
  logger.info({ id, action: '[feature].softDelete' }, '[Feature] soft-deleted');
  return { id };
};

export const [Feature]Service = { getAll, getById, create, update, remove };
```

---

### 5. `[feature].controller.ts`

Controllers are thin — their only job is to translate between HTTP (req/res) and the service layer. No business logic here, ever.

```typescript
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { [Feature]Service } from './[feature].service';

const getAll = catchAsync(async (req: Request, res: Response) => {
  const result = await [Feature]Service.getAll(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: '[Features] retrieved successfully',
    pagination: result.pagination,
    data: result.data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const result = await [Feature]Service.getById(req.params.id);
  sendResponse(res, { success: true, statusCode: StatusCodes.OK, message: '[Feature] retrieved successfully', data: result });
});

const create = catchAsync(async (req: Request, res: Response) => {
  const result = await [Feature]Service.create(req.body, req.user!.userId);
  res.set('Location', `/api/v1/[features]/${result._id}`);
  sendResponse(res, { success: true, statusCode: StatusCodes.CREATED, message: '[Feature] created successfully', data: result });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const result = await [Feature]Service.update(req.params.id, req.body, req.user!.userId);
  sendResponse(res, { success: true, statusCode: StatusCodes.OK, message: '[Feature] updated successfully', data: result });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const result = await [Feature]Service.remove(req.params.id, req.user!.userId);
  sendResponse(res, { success: true, statusCode: StatusCodes.OK, message: '[Feature] deleted successfully', data: result });
});

export const [Feature]Controller = { getAll, getById, create, update, remove };
```

---

### 6. `[feature].routes.ts`

```typescript
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../enums/user';
import { [Feature]Validation } from './[feature].validation';
import { [Feature]Controller } from './[feature].controller';

const router = express.Router();

router
  .route('/')
  .get(auth(USER_ROLES.ADMIN, USER_ROLES.USER), validateRequest([Feature]Validation.querySchema), [Feature]Controller.getAll)
  .post(auth(USER_ROLES.ADMIN, USER_ROLES.USER), validateRequest([Feature]Validation.createSchema), [Feature]Controller.create);

// Path param must be meaningful — `:[feature]Id`, never bare `:id`
router
  .route('/:[feature]Id')
  .get(auth(USER_ROLES.ADMIN, USER_ROLES.USER), validateRequest([Feature]Validation.idParamSchema), [Feature]Controller.getById)
  .patch(auth(USER_ROLES.ADMIN, USER_ROLES.USER), validateRequest([Feature]Validation.updateSchema), [Feature]Controller.update)
  .delete(auth(USER_ROLES.ADMIN, USER_ROLES.USER), validateRequest([Feature]Validation.idParamSchema), [Feature]Controller.remove);

export const [Feature]Routes = router;
```

### Register in `src/routes/index.ts`

```typescript
import { [Feature]Routes } from '../modules/[feature]/[feature].routes';
{ path: '/[features]', route: [Feature]Routes },
```

---

## Non-CRUD State Transition Pattern (cancel / approve / publish)

Use this for actions that transition a resource's status — they need their own business rule guards.

```typescript
// validation
const cancelSchema = z.object({
  body: z.object({ reason: z.string().max(500).optional() }).strict(),
  params: z.object({ [feature]Id: z.string().min(1) }),
});

// route
router.post('/:[feature]Id/cancel', auth(USER_ROLES.USER), validateRequest([Feature]Validation.cancelSchema), [Feature]Controller.cancel);

// controller
const cancel = catchAsync(async (req: Request, res: Response) => {
  const result = await [Feature]Service.cancel(req.params.[feature]Id, req.user!.userId, req.body);
  sendResponse(res, { success: true, statusCode: StatusCodes.OK, message: '[Feature] cancelled successfully', data: result });
});

// service — all guards live here, not in the controller
const cancel = async ([feature]Id: string, requesterId: string, payload: { reason?: string }) => {
  const item = await [Feature].findById([feature]Id);
  if (!item)                                          throw new ApiError(StatusCodes.NOT_FOUND,    '[Feature] not found');
  if (item.createdBy.toString() !== requesterId)      throw new ApiError(StatusCodes.FORBIDDEN,    'You cannot cancel this [feature]');
  if (item.status === 'cancelled')                    throw new ApiError(StatusCodes.CONFLICT,     '[Feature] is already cancelled');
  if (item.status === 'completed')                    throw new ApiError(StatusCodes.BAD_REQUEST,  'Completed [features] cannot be cancelled');

  return [Feature].findByIdAndUpdate(
    [feature]Id,
    { status: 'cancelled', cancelReason: payload.reason, cancelledAt: new Date() },
    { new: true },
  );
};
```

---

## Soft Delete vs Hard Delete

Always prefer soft delete. Here's why: hard delete makes it impossible to recover data after accidents, breaks audit trails, orphans related records, and makes "who deleted what and when" untrackable. Soft delete (`isDeleted: true` + `deletedAt`) solves all of this at near-zero cost.

```typescript
// The schema pre-hook (in model.ts) automatically filters deleted docs:
[feature]Schema.pre(/^find/, function (next) {
  (this as any).where({ isDeleted: false });
  next();
});

// ADMIN restore endpoint (useful for accidental deletes):
router.post('/:[feature]Id/restore', auth(USER_ROLES.ADMIN), [Feature]Controller.restore);

const restore = catchAsync(async (req: Request, res: Response) => {
  const result = await [Feature]Service.restore(req.params.[feature]Id);
  sendResponse(res, { success: true, statusCode: StatusCodes.OK, message: '[Feature] restored successfully', data: result });
});

const restore = async (id: string) => {
  // Must bypass the isDeleted pre-hook to find the deleted doc
  const item = await [Feature].findOne({ _id: id, isDeleted: true });
  if (!item) throw new ApiError(StatusCodes.NOT_FOUND, '[Feature] not found or not deleted');
  return [Feature].findByIdAndUpdate(id, { isDeleted: false, deletedAt: null }, { new: true });
};
```

---

## Build Quality Gates

Before calling a build done, verify every point:

- [ ] All 6 files generated: interface, model, validation, service, controller, routes
- [ ] Interface exports `T[Feature]`, `T[Feature]Document`, `T[Feature]Create`, `T[Feature]Update`
- [ ] Model has `toJSON` transform that strips `__v`, `isDeleted`, `deletedAt`
- [ ] Model has pre-hook filtering `isDeleted: false`
- [ ] Model has indexes on filtered/sorted fields
- [ ] Validation uses `.strict()` on all body schemas
- [ ] Validation has `.refine()` on updateSchema (at least one field required)
- [ ] `sendResponse()` only — no bare `res.json()`
- [ ] `ApiError` only — no bare `throw new Error()`
- [ ] Every controller method wrapped in `catchAsync`
- [ ] Auth middleware on every route
- [ ] `Location` header set on 201 responses
- [ ] Service uses `logger.info` for important mutations
- [ ] Service uses `.lean()` on read-only queries
- [ ] `Promise.all` for parallel DB queries
- [ ] Route registered in `src/routes/index.ts`
- [ ] No TODOs, no `// ...`, no `// add fields here` comments in output
