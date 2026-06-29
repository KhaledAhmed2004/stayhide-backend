# File Uploads

Read this when building endpoints that accept images, documents, or other file uploads.

---

## When to Use This Pattern

- Club logos, player profile pictures
- Turf / venue photos
- Tournament banners, documents
- Any route where `Content-Type: multipart/form-data` is expected

File upload routes are the exception to `requireJson` middleware — never apply that middleware to upload routes.

---

## 1. Install Dependencies

```bash
npm install multer @types/multer
npm install multer-storage-cloudinary cloudinary   # for cloud storage
# OR
npm install aws-sdk @aws-sdk/client-s3              # for S3
```

---

## 2. Upload Middleware Configuration

```typescript
// src/config/multer.ts
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import ApiError from '../errors/ApiError';
import { StatusCodes } from 'http-status-codes';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES   = ['application/pdf'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5MB
const MAX_DOC_SIZE   = 10 * 1024 * 1024; // 10MB

const fileFilter =
  (allowedTypes: string[]) =>
  (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
      ) as any);
    }
  };

// Memory storage — file is in req.file.buffer, never written to disk
// Use for files immediately passed to cloud storage
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: fileFilter(ALLOWED_IMAGE_TYPES),
});

export const multiImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 5 }, // max 5 images at once
  fileFilter: fileFilter(ALLOWED_IMAGE_TYPES),
});

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_SIZE, files: 1 },
  fileFilter: fileFilter([...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES]),
});
```

---

## 3. Cloud Storage Service (Cloudinary example)

```typescript
// src/config/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export default cloudinary;
```

```typescript
// src/shared/uploadToCloud.ts
import cloudinary from '../config/cloudinary';
import ApiError from '../errors/ApiError';
import { StatusCodes } from 'http-status-codes';

export type TUploadResult = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

// Upload a buffer directly — no temp file needed
export const uploadToCloud = (
  buffer: Buffer,
  folder: string,
  options: { width?: number; height?: number; crop?: string } = {},
): Promise<TUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,                             // e.g. 'cholokheli/clubs'
        resource_type: 'auto',
        transformation: [
          {
            width: options.width || 800,
            height: options.height || 800,
            crop: options.crop || 'limit',  // never upscale
            quality: 'auto',                // Cloudinary auto-optimises
            fetch_format: 'auto',           // serves WebP to browsers that support it
          },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'File upload failed'));
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        }
      },
    );
    uploadStream.end(buffer);
  });
};

export const deleteFromCloud = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId);
};
```

---

## 4. Full Upload Endpoint Example (club logo)

### Validation
```typescript
// No body schema for upload routes — the file is validated by multer's fileFilter.
// Validate any non-file fields with Zod as usual if present.
```

### Service
```typescript
// src/modules/clubs/clubs.service.ts
import { uploadToCloud, deleteFromCloud } from '../../shared/uploadToCloud';

const uploadLogo = async (clubId: string, fileBuffer: Buffer, requesterId: string) => {
  const club = await Club.findById(clubId);
  if (!club) throw new ApiError(StatusCodes.NOT_FOUND, 'Club not found');

  if (club.createdBy.toString() !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You cannot update this club');
  }

  // Delete old logo from cloud if one exists (avoid orphaned files)
  if (club.logoPublicId) {
    await deleteFromCloud(club.logoPublicId);
  }

  const uploaded = await uploadToCloud(fileBuffer, 'cholokheli/clubs', {
    width: 400,
    height: 400,
    crop: 'fill', // square crop for logos
  });

  return Club.findByIdAndUpdate(
    clubId,
    { logoUrl: uploaded.url, logoPublicId: uploaded.publicId },
    { new: true },
  );
};
```

### Controller
```typescript
const uploadLogo = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(StatusCodes.BAD_REQUEST, 'No file uploaded');

  const result = await ClubService.uploadLogo(
    req.params.id,
    req.file.buffer,
    req.user!.userId,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Club logo uploaded successfully',
    data: result,
  });
});
```

### Route
```typescript
// Upload routes use multer middleware instead of validateRequest
// Do NOT add requireJson middleware to upload routes
router.patch(
  '/:clubId/logo',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  imageUpload.single('logo'),   // 'logo' = the multipart field name
  ClubController.uploadLogo,
);
```

### Multiple files (e.g. venue photos)
```typescript
// Controller
const uploadPhotos = catchAsync(async (req: Request, res: Response) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No files uploaded');
  }

  const result = await TurfService.uploadPhotos(
    req.params.turfId,
    req.files.map((f) => f.buffer),
    req.user!.userId,
  );

  sendResponse(res, { success: true, statusCode: StatusCodes.OK, message: 'Photos uploaded successfully', data: result });
});

// Route
router.post(
  '/:turfId/photos',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  multiImageUpload.array('photos', 5), // 'photos' field, max 5 files
  TurfController.uploadPhotos,
);
```

---

## 5. Multer Error Handling

Multer throws its own error types when limits are exceeded. Add this handler to `globalErrorHandler.ts`:

```typescript
// In globalErrorHandler.ts, add before the final unknown-error block:
import multer from 'multer';

// Multer limit errors
if (err instanceof multer.MulterError) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
    message = 'File size exceeds the allowed limit';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
    message = 'Too many files uploaded';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = `Unexpected field: ${err.field}`;
  } else {
    statusCode = StatusCodes.BAD_REQUEST;
    message = `File upload error: ${err.message}`;
  }
  errorMessages = [{ path: '', message }];
}
```

---

## 6. Security Checklist for Upload Endpoints

- [ ] MIME type validated in `fileFilter` — never trust `file.originalname` extension alone
- [ ] File size limited in multer config (`limits.fileSize`)
- [ ] Max file count limited (`limits.files`)
- [ ] Old file deleted from cloud before replacing (prevents orphaned storage)
- [ ] `requireJson` middleware NOT applied to upload routes
- [ ] Files stored in cloud storage, never on the server filesystem (servers are ephemeral)
- [ ] `publicId` stored in DB alongside URL (needed for future deletion)
- [ ] Auth + ownership check before allowing upload
- [ ] Multer errors handled in `globalErrorHandler`
