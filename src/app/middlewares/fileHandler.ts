import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../errors/ApiError';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import cloudinary from 'cloudinary';


// ===============================
// Types
// ===============================
type IFolderName = 'images' | 'media' | 'documents';

interface ProcessedFiles {
  [key: string]: string | string[] | undefined;
}

interface FileHandlerOptions {
  storageMode?: 'local' | 'memory';
  cloudProvider?: 's3' | 'cloudinary';
  maxFileSizeMB?: number;
  baseUrl?: string;
  maxFilesTotal?: number;
  enforceAllowedFields?: string[];
  perFieldMaxCount?: Record<string, number>;
  perFieldSubfolder?: Record<string, string>;
}

interface CloudProvider {
  upload: (
    buffer: Buffer,
    fileName: string,
    folder: string,
    mimeType: string
  ) => Promise<string>;
  delete: (fileUrl: string) => Promise<void>;
}

// ===============================
// Configuration
// ===============================
const allowedTypes: Record<IFolderName, string[]> = {
  images: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  media: ['video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav'],
  documents: ['application/pdf'],
};

// ===============================
// Cloud Providers (Strategy)
// ===============================
const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3Provider: CloudProvider = {
  upload: async (buffer, fileName, folder, mimeType) => {
    const key = `${folder}/${fileName}`;
    const bucket = process.env.AWS_S3_BUCKET!;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ACL: 'public-read',
        ContentType: mimeType,
      })
    );
    const region = process.env.AWS_REGION!;
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  },
  delete: async fileUrl => {
    const bucketName = process.env.AWS_S3_BUCKET!;
    let key = '';
    try {
      const url = new URL(fileUrl);
      const pathname = url.pathname.replace(/^\/+/, '');
      key = pathname.startsWith(`${bucketName}/`)
        ? pathname.slice(bucketName.length + 1)
        : pathname;
    } catch {
      key = fileUrl.replace(/^https?:\/\/[^/]+\//, '');
      if (key.startsWith(`${bucketName}/`)) {
        key = key.slice(bucketName.length + 1);
      }
    }
    await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
  },
};

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const CloudinaryProvider: CloudProvider = {
  upload: async (buffer, fileName, folder, _mimeType) => {
    const result: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        { folder, resource_type: 'auto', public_id: fileName.split('.')[0] },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      uploadStream.end(buffer);
    });
    return result.secure_url;
  },
  delete: async fileUrl => {
    let segments: string[] = [];
    try {
      const url = new URL(fileUrl);
      segments = url.pathname.split('/').filter(Boolean);
    } catch {
      segments = fileUrl.split('/').filter(Boolean);
    }
    const uploadIdx = segments.indexOf('upload');
    const afterUpload = uploadIdx >= 0 ? segments.slice(uploadIdx + 1) : segments;
    const filtered = afterUpload.filter(s => !/^v\d+$/i.test(s));
    const filenameWithExt = filtered[filtered.length - 1] || '';
    const publicIdFolder = filtered.slice(0, -1).join('/');
    const public_id = filenameWithExt.replace(/\.[^/.]+$/, '');
    const fullPublicId = publicIdFolder ? `${publicIdFolder}/${public_id}` : public_id;
    await cloudinary.v2.uploader.destroy(fullPublicId, { resource_type: 'auto' });
  },
};

const CLOUD_PROVIDERS: Record<'s3' | 'cloudinary', CloudProvider> = {
  s3: S3Provider,
  cloudinary: CloudinaryProvider,
};

// ===============================
// Helpers
// ===============================
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Human-readable size (e.g., 50.86 KB)
const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(2)} ${sizes[i]}`;
};

const parseJsonData = (body: any) => {
  let result = { ...body };

  // 1. Handle legacy "data" field wrapping
  if (result.data && typeof result.data === 'string') {
    try {
      const parsed = JSON.parse(result.data);
      result = { ...result, ...parsed };
      delete result.data;
    } catch {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid JSON in "data" field');
    }
  }

  // 2. Handle flattened fields that might be JSON strings (objects or arrays)
  for (const key in result) {
    if (typeof result[key] === 'string') {
      const value = result[key].trim();
      if (
        (value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))
      ) {
        try {
          result[key] = JSON.parse(value);
        } catch (e) {
          // If parsing fails, it's just a regular string, so we keep it as is
        }
      }
    }
  }

  return result;
};

const getFolderByMime = (mime: string): IFolderName => {
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'media';
  if (mime === 'application/pdf') return 'documents';
  throw new ApiError(StatusCodes.BAD_REQUEST, `Unsupported file type '${mime}'`);
};

const createStorage = (mode: 'local' | 'memory') => {
  if (mode === 'memory') return multer.memoryStorage();
  const baseUploadDir = path.join(process.cwd(), 'uploads');
  ensureDir(baseUploadDir);
  ensureDir(path.join(baseUploadDir, 'images'));
  ensureDir(path.join(baseUploadDir, 'media'));
  ensureDir(path.join(baseUploadDir, 'documents'));
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const canonicalFolder = getFolderByMime(file.mimetype);

      // Check if there's a custom subfolder for this field
      const options = (req as any)._fileHandlerOptions as FileHandlerOptions;
      const customSub = options?.perFieldSubfolder?.[file.fieldname];

      const folderPath = customSub
        ? path.join(baseUploadDir, customSub)
        : path.join(baseUploadDir, canonicalFolder);

      ensureDir(folderPath);
      cb(null, folderPath);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  });
};

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  let folder: IFolderName;
  try {
    folder = getFolderByMime(file.mimetype);
  } catch (e) {
    const msg = (e as Error).message || 'Unsupported file type';
    return cb(new ApiError(StatusCodes.BAD_REQUEST, msg));
  }
  if (!allowedTypes[folder]?.includes(file.mimetype)) {
    return cb(
      new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid file type '${file.mimetype}'. Allowed for ${folder}: ${allowedTypes[folder]?.join(', ') || 'none'
        }`
      )
    );
  }
  cb(null, true);
};

const optimizeFile = async (
  file: Express.Multer.File,
  storageMode: 'local' | 'memory'
): Promise<Buffer | undefined> => {
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  let buffer = storageMode === 'memory' ? file.buffer : undefined;

  if (isImage) {
    let sharpInstance;
    if (storageMode === 'local') {
      // Read file into buffer first to avoid locking issues on Windows when writing back to same path
      const inputBuffer = await fs.promises.readFile(file.path);
      sharpInstance = sharp(inputBuffer).resize(800);
    } else {
      sharpInstance = sharp(buffer!).resize(800);
    }

    if (file.mimetype === 'image/png')
      sharpInstance = sharpInstance.png({ compressionLevel: 8, palette: true });
    else if (file.mimetype === 'image/webp')
      sharpInstance = sharpInstance.webp({ quality: 80 });
    else sharpInstance = sharpInstance.jpeg({ quality: 80 });

    if (storageMode === 'memory') {
      buffer = await sharpInstance.toBuffer();
    } else {
      await sharpInstance.toFile(file.path);
    }
  }

  if (isVideo && storageMode === 'memory') {
    return buffer!;
  }

  return buffer;
};

const generateFileUrl = async (
  file: Express.Multer.File,
  storageMode: 'local' | 'memory',
  provider: CloudProvider,
  baseUrl: string,
  folder: string
) => {
  // 1. Optimize/Process file (resize images, etc.)
  const buffer = await optimizeFile(file, storageMode);

  if (storageMode === 'local') {
    // 2. Generate relative URL path safely
    const normalizedPath = file.path.replace(/\\/g, '/');
    const parts = normalizedPath.split('/uploads/');
    const relativePart = parts[parts.length - 1];

    // Ensure baseUrl doesn't have trailing slash and relativePart doesn't have leading slash
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}/uploads/${relativePart}`;
  }

  // 3. Cloud Storage path
  const ext = file.mimetype.split('/')[1];
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  return provider.upload(buffer!, fileName, folder, file.mimetype);
};

const groupFilesByField = (
  files: Express.Multer.File[] | Record<string, Express.Multer.File[]>
): Record<string, Express.Multer.File[]> => {
  const byField: Record<string, Express.Multer.File[]> = {};
  if (Array.isArray(files)) {
    for (const f of files) {
      byField[f.fieldname] = byField[f.fieldname] || [];
      byField[f.fieldname].push(f);
    }
  } else {
    Object.assign(byField, files);
  }
  return byField;
};

// Simplify files for logging, keyed by field name
const buildFilesLogSummary = (filesByField: Record<string, Express.Multer.File[]>) => {
  const out: Record<string, any> = {};
  for (const [field, arr] of Object.entries(filesByField)) {
    const simplify = (f: Express.Multer.File) => ({
      originalname: f.originalname,
      filename: (f as any).filename || (f.path ? path.basename(f.path) : undefined),
      mimetype: f.mimetype,
      size: formatBytes((f as any).size as number),
    });
    out[field] = arr.length === 1 ? simplify(arr[0]) : arr.map(simplify);
  }
  return out;
};

const enforceFieldPolicy = (
  filesByField: Record<string, Express.Multer.File[]>,
  opts: FileHandlerOptions
) => {
  if (!opts.enforceAllowedFields || opts.enforceAllowedFields.length === 0) return;
  const allowed = new Set(opts.enforceAllowedFields);
  for (const fieldName of Object.keys(filesByField)) {
    if (!allowed.has(fieldName)) {
      const expected =
        opts.enforceAllowedFields.length === 1
          ? `'${opts.enforceAllowedFields[0]}'`
          : `'${opts.enforceAllowedFields.join("', '")}'`;
      throw new ApiError(StatusCodes.BAD_REQUEST, `Expected field name ${expected} but got '${fieldName}'`);
    }
    const maxCount = opts.perFieldMaxCount?.[fieldName];
    if (maxCount && filesByField[fieldName].length > maxCount) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Too many files for field '${fieldName}'. Max ${maxCount}.`);
    }
  }
};

const processFilesToUrls = async (
  filesByField: Record<string, Express.Multer.File[]>,
  storageMode: 'local' | 'memory',
  provider: CloudProvider,
  baseUrl: string,
  opts: FileHandlerOptions
): Promise<ProcessedFiles> => {
  const processed: ProcessedFiles = {};
  for (const [fieldName, fileArray] of Object.entries(filesByField)) {
    const folder = opts.perFieldSubfolder?.[fieldName] || getFolderByMime(fileArray[0].mimetype);
    const urls = await Promise.all(
      fileArray.map(file => generateFileUrl(file, storageMode, provider, baseUrl, folder))
    );
    processed[fieldName] = fileArray.length > 1 ? urls : urls[0];
  }
  return processed;
};

const normalizeOptions = (
  fields?: FileHandlerOptions | string[] | Array<string | { name: string; maxCount?: number; subfolder?: string }>,
  options?: FileHandlerOptions
): FileHandlerOptions => {
  const arrayToOptions = (
    arr: Array<string | { name: string; maxCount?: number; subfolder?: string }>
  ): FileHandlerOptions => {
    const enforceAllowedFields: string[] = [];
    const perFieldMaxCount: Record<string, number> = {};
    const perFieldSubfolder: Record<string, string> = {};
    for (const entry of arr) {
      if (typeof entry === 'string') {
        enforceAllowedFields.push(entry);
        perFieldMaxCount[entry] = perFieldMaxCount[entry] ?? 1;
      } else if (entry && typeof entry.name === 'string') {
        enforceAllowedFields.push(entry.name);
        perFieldMaxCount[entry.name] = entry.maxCount ?? 1;
        if ((entry as any).subfolder) {
          perFieldSubfolder[entry.name] = (entry as any).subfolder;
        }
      }
    }
    return { enforceAllowedFields, perFieldMaxCount, perFieldSubfolder };
  };

  const baseFields = Array.isArray(fields) ? arrayToOptions(fields as any) : fields || {};
  const merged = { ...baseFields, ...options };

  const storageMode = merged.storageMode || (process.env.UPLOAD_MODE === 'memory' ? 'memory' : 'local');
  const cloudProvider = merged.cloudProvider || (process.env.CLOUD_PROVIDER as 's3' | 'cloudinary') || 's3';
  const maxFileSizeMB = merged.maxFileSizeMB || 10;
  const maxFilesTotal = merged.maxFilesTotal ?? 10;
  return { ...merged, storageMode, cloudProvider, maxFileSizeMB, maxFilesTotal };
};

// ===============================
// Middleware
// ===============================
export const fileHandler = (
  fields?: FileHandlerOptions | string[] | Array<string | { name: string; maxCount?: number; subfolder?: string }>,
  options?: FileHandlerOptions
) => {
  const resolved = normalizeOptions(fields, options);
  const provider = CLOUD_PROVIDERS[resolved.cloudProvider!];

  const upload = multer({
    storage: createStorage(resolved.storageMode!),
    fileFilter,
    limits: { fileSize: resolved.maxFileSizeMB! * 1024 * 1024, files: resolved.maxFilesTotal! },
  }).any();

  return async (req: Request, res: Response, next: NextFunction) => {
    // Attach options to request so destination() can access them
    (req as any)._fileHandlerOptions = resolved;

    upload(req, res, async (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          const msg = mapMulterError(err, {
            maxFileSizeMB: resolved.maxFileSizeMB,
            maxFilesTotal: resolved.maxFilesTotal,
          });
          return next(new ApiError(StatusCodes.BAD_REQUEST, msg));
        }
        return next(err);
      }
      try {
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
        const host = req.get('host');
        const effectiveBaseUrl = resolved.baseUrl || process.env.BASE_URL || `${proto}://${host}`;

        req.body = parseJsonData(req.body);

        let filesByField: Record<string, Express.Multer.File[]> = {};
        if (req.files) {
          filesByField = groupFilesByField(req.files as any);
          enforceFieldPolicy(filesByField, resolved);
          const processedFiles = await processFilesToUrls(
            filesByField,
            resolved.storageMode!,
            provider,
            effectiveBaseUrl,
            resolved
          );
          req.body = { ...req.body, ...processedFiles };
        }



        next();
      } catch (error) {
        next(error);
      }
    });
  };
};

// ===============================
// File Deletion
// ===============================
export const deleteFile = async (
  fileUrl: string,
  storageMode?: 'local' | 'memory',
  cloudProviderKey?: 's3' | 'cloudinary'
) => {
  const mode = storageMode || (process.env.UPLOAD_MODE === 'memory' ? 'memory' : 'local');
  const cloud = cloudProviderKey || (process.env.CLOUD_PROVIDER as 's3' | 'cloudinary') || 's3';
  const provider = CLOUD_PROVIDERS[cloud];

  if (mode === 'local') {
    let pathname = '';
    try {
      pathname = new URL(fileUrl).pathname;
    } catch {
      pathname = fileUrl;
    }
    const relative = pathname.split('/uploads/')[1];
    if (relative) {
      const localPath = path.join(process.cwd(), 'uploads', relative);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  } else {
    await provider.delete(fileUrl);
  }
};

// ===============================
// Error Mapper
// ===============================
const mapMulterError = (
  err: multer.MulterError,
  opts?: { maxFileSizeMB?: number; maxFilesTotal?: number }
): string => {
  const field = (err as any).field as string | undefined;
  switch (err.code) {
    case 'LIMIT_FILE_SIZE': {
      const sizeText = opts?.maxFileSizeMB ? `Max ${opts.maxFileSizeMB} MB` : 'File size limit exceeded';
      return `File too large${field ? ` for field '${field}'` : ''}. ${sizeText}.`;
    }
    case 'LIMIT_FILE_COUNT': {
      return `Too many files uploaded. Max total files: ${opts?.maxFilesTotal ?? 'limit'}.`;
    }
    case 'LIMIT_UNEXPECTED_FILE': {
      return `Unexpected file field${field ? ` '${field}'` : ''}.`;
    }
    case 'LIMIT_PART_COUNT': {
      return 'Too many parts in form-data. Reduce number of files or fields.';
    }
    case 'LIMIT_FIELD_KEY': {
      return 'Field name too long.';
    }
    case 'LIMIT_FIELD_VALUE': {
      return 'Field value too long.';
    }
    case 'LIMIT_FIELD_COUNT': {
      return 'Too many non-file fields.';
    }
    default:
      return `${err.message || 'Upload error'}${err.code ? ` (${err.code})` : ''}`;
  }
};
