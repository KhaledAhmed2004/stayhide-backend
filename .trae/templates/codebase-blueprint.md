# Codebase Blueprint — Copy-Paste Ready Patterns

> This file eliminates the need for Explore agents. Contains actual code templates from this codebase.
> **IMPORTANT**: When creating a new module, follow these patterns exactly. Do NOT explore the codebase — use this file.

---

## Module Structure

```
src/app/modules/[feature]/
├── [feature].interface.ts      # Types, enums, model type
├── [feature].model.ts          # Mongoose schema + statics
├── [feature].controller.ts     # Thin handlers (catchAsync + sendResponse)
├── [feature].service.ts        # Fat business logic (ApiError for errors)
├── [feature].route.ts          # Express routes (auth → fileHandler → validateRequest → Controller)
└── [feature].validation.ts     # Zod schemas (z.object({ body: z.object({...}) }))
```

**Flow**: Route → `validateRequest(ZodSchema)` → Controller (`catchAsync`) → Service → Model → `sendResponse()`

---

## 1. Interface Template (`[feature].interface.ts`)

```typescript
import { Model, Types } from 'mongoose';

// Enums
export enum FEATURE_STATUS {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// Embedded sub-doc type (no _id)
export type ISubDoc = {
  url: string;
  name?: string;
  size?: number;
};

// Main type
export type IFeature = {
  title: string;
  status: FEATURE_STATUS;
  userId: Types.ObjectId;         // ref -> User
  items: ISubDoc[];               // embedded array
  createdAt?: Date;
  updatedAt?: Date;
};

// Model type with statics
export type FeatureModel = {
  isExistById(id: string): Promise<IFeature | null>;
} & Model<IFeature>;
```

---

## 2. Model Template (`[feature].model.ts`)

```typescript
import { model, Schema } from 'mongoose';
import { IFeature, FeatureModel, FEATURE_STATUS } from './feature.interface';

// Embedded sub-schema (no _id)
const SubDocSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String },
    size: { type: Number },
  },
  { _id: false }
);

// Main schema
const featureSchema = new Schema<IFeature, FeatureModel>(
  {
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(FEATURE_STATUS),
      default: FEATURE_STATUS.ACTIVE,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: { type: [SubDocSchema], default: [] },
  },
  { timestamps: true }
);

// Indexes
featureSchema.index({ userId: 1 });
featureSchema.index({ status: 1 });

// Statics
featureSchema.statics.isExistById = async function (id: string) {
  return await this.findById(id);
};

export const Feature = model<IFeature, FeatureModel>('Feature', featureSchema);
```

### Schema Field Patterns

```typescript
// Required string with trim
name: { type: String, required: true, trim: true }

// Enum with default
status: { type: String, enum: Object.values(MY_ENUM), default: MY_ENUM.DRAFT }

// ObjectId reference
userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }

// Array of ObjectId refs
participants: [{ type: Schema.Types.ObjectId, ref: 'User' }]

// Array of strings
tags: { type: [String], default: [] }

// Hidden field (not returned by default)
password: { type: String, select: false }

// Embedded object (no sub-schema needed)
authentication: {
  type: {
    isResetPassword: { type: Boolean, default: false },
    oneTimeCode: { type: Number, default: null },
    expireAt: { type: Date, default: null },
  },
  select: false,
}

// Mixed type (flexible)
metadata: { type: Schema.Types.Mixed, default: {} }
```

### Pre-save Hook Pattern

```typescript
schema.pre('save', async function (next) {
  // Your logic here
  next();
});
```

---

## 3. Controller Template (`[feature].controller.ts`)

```typescript
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { FeatureService } from './feature.service';

// CREATE
const create = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const result = await FeatureService.create({ ...req.body, userId });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Created successfully',
    data: result,
  });
});

// GET ALL (with pagination)
const getAll = catchAsync(async (req: Request, res: Response) => {
  const result = await FeatureService.getAll(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Retrieved successfully',
    pagination: result.pagination,
    data: result.data,
  });
});

// GET BY ID
const getById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await FeatureService.getById(id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Retrieved successfully',
    data: result,
  });
});

// UPDATE
const update = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.user as JwtPayload).id;
  const result = await FeatureService.update(id, userId, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Updated successfully',
    data: result,
  });
});

// DELETE
const remove = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.user as JwtPayload).id;
  await FeatureService.remove(id, userId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Deleted successfully',
  });
});

export const FeatureController = { create, getAll, getById, update, remove };
```

---

## 4. Service Template (`[feature].service.ts`)

```typescript
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IFeature } from './feature.interface';
import { Feature } from './feature.model';

// CREATE
const create = async (payload: Partial<IFeature>): Promise<IFeature> => {
  const result = await Feature.create(payload);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create');
  }
  return result;
};

// GET ALL (with QueryBuilder)
const getAll = async (query: Record<string, unknown>) => {
  const featureQuery = new QueryBuilder(Feature.find(), query)
    .search(['title'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await featureQuery.modelQuery;
  const pagination = await featureQuery.getPaginationInfo();
  return { pagination, data };
};

// GET BY ID
const getById = async (id: string): Promise<IFeature> => {
  const result = await Feature.findById(id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Not found');
  }
  return result;
};

// UPDATE
const update = async (
  id: string,
  userId: string,
  payload: Partial<IFeature>
): Promise<IFeature | null> => {
  const existing = await Feature.findById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Not found');
  }

  const result = await Feature.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

// DELETE
const remove = async (id: string, userId: string): Promise<void> => {
  const existing = await Feature.findById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Not found');
  }
  await Feature.findByIdAndDelete(id);
};

export const FeatureService = { create, getAll, getById, update, remove };
```

---

## 5. Route Template (`[feature].route.ts`)

```typescript
import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { fileHandler } from '../../middlewares/fileHandler';
import { FeatureController } from './feature.controller';
import { FeatureValidation } from './feature.validation';

const router = express.Router();

// Create (auth + file upload + validation)
router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  fileHandler(['thumbnail']),                                    // simple: array of field names
  validateRequest(FeatureValidation.createZodSchema),
  FeatureController.create
);

// Get all (public, no auth)
router.get('/', FeatureController.getAll);

// Get by ID — path param must be meaningful (`:featureId`, never bare `:id`)
router.get('/:featureId', FeatureController.getById);

// Update
router.patch(
  '/:featureId',
  auth(USER_ROLES.SUPER_ADMIN),
  fileHandler(['thumbnail']),
  validateRequest(FeatureValidation.updateZodSchema),
  FeatureController.update
);

// Delete
router.delete('/:featureId', auth(USER_ROLES.SUPER_ADMIN), FeatureController.remove);

export const FeatureRoutes = router;
```

### Route Registration (`src/routes/index.ts`)

```typescript
import { FeatureRoutes } from '../app/modules/feature/feature.route';

// Add to apiRoutes array:
{ path: '/features', route: FeatureRoutes }
```

---

## 6. Validation Template (`[feature].validation.ts`)

```typescript
import { z } from 'zod';

const createZodSchema = z.object({
  body: z.object({
    title: z.string({ required_error: 'Title is required' }).min(1).max(200),
    description: z.string().max(5000).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    items: z.array(z.string()).optional(),
  }),
});

const updateZodSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
  params: z.object({
    id: z.string({ required_error: 'ID is required' }),
  }),
});

export const FeatureValidation = { createZodSchema, updateZodSchema };
```

### Zod Patterns

```typescript
// Required field
title: z.string({ required_error: 'Title is required' }).min(1)

// Optional
description: z.string().optional()

// Enum
status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])

// Array
tags: z.array(z.string().max(50)).max(10).optional()

// Nullable (set null to remove)
prerequisite: z.string().nullable().optional()

// Date validation (future only)
scheduledAt: z.string().datetime().refine(
  val => new Date(val) > new Date(),
  { message: 'Must be in the future' }
).optional()

// Conditional validation (superRefine)
.superRefine((data, ctx) => {
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be after start date' });
  }
})

// Regex
phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone')

// Strict mode (reject unknown fields)
body: z.object({ ... }).strict()
```

---

## 7. Core Utilities

### sendResponse (`src/shared/sendResponse.ts`)

```typescript
sendResponse(res, {
  success: true,
  statusCode: StatusCodes.OK,       // from 'http-status-codes'
  message: 'Success message',
  pagination: result.pagination,     // optional: { page, limit, totalPage, total }
  data: result,                      // optional
});
```

### catchAsync (`src/shared/catchAsync.ts`)

```typescript
// Wraps async handlers — catches errors and passes to globalErrorHandler
const handler = catchAsync(async (req: Request, res: Response) => {
  // your logic — any thrown error auto-handled
});
```

### ApiError (`src/errors/ApiError.ts`)

```typescript
// Throw in services for controlled errors
throw new ApiError(StatusCodes.NOT_FOUND, 'Resource not found');
throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid input');
throw new ApiError(StatusCodes.FORBIDDEN, 'Not authorized');
```

### QueryBuilder (`src/app/builder/QueryBuilder.ts`)

```typescript
const query = new QueryBuilder(Model.find(baseFilter), req.query)
  .search(['name', 'email'])   // fuzzy search on these fields
  .filter()                     // filter by query params
  .sort()                       // sort by ?sort=field,-field
  .paginate()                   // ?page=1&limit=10
  .fields();                    // ?fields=name,email

const data = await query.modelQuery;
const pagination = await query.getPaginationInfo();
```

---

## 8. File Upload (`src/app/middlewares/fileHandler.ts`)

### Simple Usage (array of field names)
```typescript
fileHandler(['profilePicture'])           // 1 file, default 10MB
fileHandler(['avatar', 'coverPhoto'])     // multiple fields, 1 each
```

### Advanced Usage (options object)
```typescript
fileHandler({
  maxFileSizeMB: 500,                     // override max file size
  maxFilesTotal: 6,                       // total files across all fields
  enforceAllowedFields: ['video', 'attachments'],
  perFieldMaxCount: { video: 1, attachments: 5 },
})
```

### With explicit max count per field
```typescript
fileHandler([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'gallery', maxCount: 5 },
])
```

### Allowed MIME types (auto-detected by file type)
- **images**: jpeg, png, jpg, webp
- **media**: mp4, webm, mpeg, ogg, wav
- **documents**: pdf

### File URL in req.body
After fileHandler runs, file URLs are injected into `req.body`:
```typescript
req.body.thumbnail   // string (single file)
req.body.gallery     // string[] (multiple files)
```

### Delete file
```typescript
import { deleteFile } from '../../middlewares/fileHandler';
await deleteFile(oldFileUrl);
```

---

## 9. Auth Middleware (`src/app/middlewares/auth.ts`)

```typescript
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';

// Admin only
auth(USER_ROLES.SUPER_ADMIN)

// Any authenticated user
auth(USER_ROLES.STUDENT, USER_ROLES.SUPER_ADMIN)

// Public (no auth middleware)
router.get('/', FeatureController.getAll);   // just don't use auth()
```

### User in request
```typescript
const userId = (req.user as JwtPayload).id;
const userRole = (req.user as JwtPayload).role;
```

---

## 10. User Roles (`src/enums/user.ts`)

```typescript
export enum USER_ROLES {
  SUPER_ADMIN = 'SUPER_ADMIN',
  STUDENT = 'STUDENT',
}

export enum USER_STATUS {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  RESTRICTED = 'RESTRICTED',
  DELETE = 'DELETE',
}
```

---

## 11. Common Imports Cheat Sheet

```typescript
// Controller imports
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';

// Service imports
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';

// Model imports
import { model, Schema } from 'mongoose';

// Route imports
import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { fileHandler } from '../../middlewares/fileHandler';

// Validation imports
import { z } from 'zod';
```

---

## 12. Mongoose Operations Cheat Sheet

```typescript
// Create
await Model.create(payload);

// Find
await Model.findById(id);
await Model.findOne({ email });
await Model.find({ status: 'ACTIVE' }).sort({ createdAt: -1 });

// Update
await Model.findByIdAndUpdate(id, payload, { new: true });
await Model.findOneAndUpdate(
  { _id: id, 'items.itemId': itemId },
  { $set: { 'items.$.title': 'new title' } },  // positional $ operator
  { new: true }
);

// Delete
await Model.findByIdAndDelete(id);
await Model.deleteMany({ parentId: id });       // cascade delete

// Array operations
{ $push: { items: newItem } }                    // add to array
{ $pull: { items: { itemId: id } } }             // remove from array
{ $addToSet: { tags: 'new-tag' } }               // add without duplicates
{ $inc: { totalCount: 1 } }                      // increment
{ $inc: { totalCount: -1 } }                     // decrement

// Populate
await Model.findById(id).populate('userId', 'name email profilePicture');
await Model.findById(id).populate({
  path: 'items',
  populate: { path: 'subItems', select: 'name' },  // nested populate
});

// Bulk write
await Model.bulkWrite([
  { updateOne: { filter: { _id: id1 }, update: { $set: { order: 0 } } } },
  { updateOne: { filter: { _id: id2 }, update: { $set: { order: 1 } } } },
]);

// Count
await Model.countDocuments({ status: 'ACTIVE' });
```