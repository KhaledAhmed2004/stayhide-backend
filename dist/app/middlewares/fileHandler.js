"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.fileHandler = void 0;
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const client_s3_1 = require("@aws-sdk/client-s3");
const cloudinary_1 = __importDefault(require("cloudinary"));
// ===============================
// Configuration
// ===============================
const allowedTypes = {
    images: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    media: ['video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav'],
    documents: ['application/pdf'],
};
// ===============================
// Cloud Providers (Strategy)
// ===============================
const s3 = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const S3Provider = {
    upload: (buffer, fileName, folder, mimeType) => __awaiter(void 0, void 0, void 0, function* () {
        const key = `${folder}/${fileName}`;
        const bucket = process.env.AWS_S3_BUCKET;
        yield s3.send(new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ACL: 'public-read',
            ContentType: mimeType,
        }));
        const region = process.env.AWS_REGION;
        return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }),
    delete: (fileUrl) => __awaiter(void 0, void 0, void 0, function* () {
        const bucketName = process.env.AWS_S3_BUCKET;
        let key = '';
        try {
            const url = new URL(fileUrl);
            const pathname = url.pathname.replace(/^\/+/, '');
            key = pathname.startsWith(`${bucketName}/`)
                ? pathname.slice(bucketName.length + 1)
                : pathname;
        }
        catch (_a) {
            key = fileUrl.replace(/^https?:\/\/[^/]+\//, '');
            if (key.startsWith(`${bucketName}/`)) {
                key = key.slice(bucketName.length + 1);
            }
        }
        yield s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: bucketName, Key: key }));
    }),
};
cloudinary_1.default.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const CloudinaryProvider = {
    upload: (buffer, fileName, folder, _mimeType) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.default.v2.uploader.upload_stream({ folder, resource_type: 'auto', public_id: fileName.split('.')[0] }, (err, res) => (err ? reject(err) : resolve(res)));
            uploadStream.end(buffer);
        });
        return result.secure_url;
    }),
    delete: (fileUrl) => __awaiter(void 0, void 0, void 0, function* () {
        let segments = [];
        try {
            const url = new URL(fileUrl);
            segments = url.pathname.split('/').filter(Boolean);
        }
        catch (_a) {
            segments = fileUrl.split('/').filter(Boolean);
        }
        const uploadIdx = segments.indexOf('upload');
        const afterUpload = uploadIdx >= 0 ? segments.slice(uploadIdx + 1) : segments;
        const filtered = afterUpload.filter(s => !/^v\d+$/i.test(s));
        const filenameWithExt = filtered[filtered.length - 1] || '';
        const publicIdFolder = filtered.slice(0, -1).join('/');
        const public_id = filenameWithExt.replace(/\.[^/.]+$/, '');
        const fullPublicId = publicIdFolder ? `${publicIdFolder}/${public_id}` : public_id;
        yield cloudinary_1.default.v2.uploader.destroy(fullPublicId, { resource_type: 'auto' });
    }),
};
const CLOUD_PROVIDERS = {
    s3: S3Provider,
    cloudinary: CloudinaryProvider,
};
// ===============================
// Helpers
// ===============================
const ensureDir = (dir) => {
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
};
// Human-readable size (e.g., 50.86 KB)
const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0)
        return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${sizes[i]}`;
};
const parseJsonData = (body) => {
    let result = Object.assign({}, body);
    // 1. Handle legacy "data" field wrapping
    if (result.data && typeof result.data === 'string') {
        try {
            const parsed = JSON.parse(result.data);
            result = Object.assign(Object.assign({}, result), parsed);
            delete result.data;
        }
        catch (_a) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid JSON in "data" field');
        }
    }
    // 2. Handle flattened fields that might be JSON strings (objects or arrays)
    for (const key in result) {
        if (typeof result[key] === 'string') {
            const value = result[key].trim();
            if ((value.startsWith('{') && value.endsWith('}')) ||
                (value.startsWith('[') && value.endsWith(']'))) {
                try {
                    result[key] = JSON.parse(value);
                }
                catch (e) {
                    // If parsing fails, it's just a regular string, so we keep it as is
                }
            }
        }
    }
    return result;
};
const getFolderByMime = (mime) => {
    if (mime.startsWith('image/'))
        return 'images';
    if (mime.startsWith('video/') || mime.startsWith('audio/'))
        return 'media';
    if (mime === 'application/pdf')
        return 'documents';
    throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Unsupported file type '${mime}'`);
};
const createStorage = (mode) => {
    if (mode === 'memory')
        return multer_1.default.memoryStorage();
    const baseUploadDir = path_1.default.join(process.cwd(), 'uploads');
    ensureDir(baseUploadDir);
    ensureDir(path_1.default.join(baseUploadDir, 'images'));
    ensureDir(path_1.default.join(baseUploadDir, 'media'));
    ensureDir(path_1.default.join(baseUploadDir, 'documents'));
    return multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            var _a;
            const canonicalFolder = getFolderByMime(file.mimetype);
            // Check if there's a custom subfolder for this field
            const options = req._fileHandlerOptions;
            const customSub = (_a = options === null || options === void 0 ? void 0 : options.perFieldSubfolder) === null || _a === void 0 ? void 0 : _a[file.fieldname];
            const folderPath = customSub
                ? path_1.default.join(baseUploadDir, customSub)
                : path_1.default.join(baseUploadDir, canonicalFolder);
            ensureDir(folderPath);
            cb(null, folderPath);
        },
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname);
            const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
            cb(null, name);
        },
    });
};
const fileFilter = (_req, file, cb) => {
    var _a, _b;
    let folder;
    try {
        folder = getFolderByMime(file.mimetype);
    }
    catch (e) {
        const msg = e.message || 'Unsupported file type';
        return cb(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, msg));
    }
    if (!((_a = allowedTypes[folder]) === null || _a === void 0 ? void 0 : _a.includes(file.mimetype))) {
        return cb(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid file type '${file.mimetype}'. Allowed for ${folder}: ${((_b = allowedTypes[folder]) === null || _b === void 0 ? void 0 : _b.join(', ')) || 'none'}`));
    }
    cb(null, true);
};
const optimizeFile = (file, storageMode) => __awaiter(void 0, void 0, void 0, function* () {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    let buffer = storageMode === 'memory' ? file.buffer : undefined;
    if (isImage) {
        let sharpInstance;
        if (storageMode === 'local') {
            // Read file into buffer first to avoid locking issues on Windows when writing back to same path
            const inputBuffer = yield fs_1.default.promises.readFile(file.path);
            sharpInstance = (0, sharp_1.default)(inputBuffer).resize(800);
        }
        else {
            sharpInstance = (0, sharp_1.default)(buffer).resize(800);
        }
        if (file.mimetype === 'image/png')
            sharpInstance = sharpInstance.png({ compressionLevel: 8, palette: true });
        else if (file.mimetype === 'image/webp')
            sharpInstance = sharpInstance.webp({ quality: 80 });
        else
            sharpInstance = sharpInstance.jpeg({ quality: 80 });
        if (storageMode === 'memory') {
            buffer = yield sharpInstance.toBuffer();
        }
        else {
            yield sharpInstance.toFile(file.path);
        }
    }
    if (isVideo && storageMode === 'memory') {
        return buffer;
    }
    return buffer;
});
const generateFileUrl = (file, storageMode, provider, baseUrl, folder) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Optimize/Process file (resize images, etc.)
    const buffer = yield optimizeFile(file, storageMode);
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
    return provider.upload(buffer, fileName, folder, file.mimetype);
});
const groupFilesByField = (files) => {
    const byField = {};
    if (Array.isArray(files)) {
        for (const f of files) {
            byField[f.fieldname] = byField[f.fieldname] || [];
            byField[f.fieldname].push(f);
        }
    }
    else {
        Object.assign(byField, files);
    }
    return byField;
};
// Simplify files for logging, keyed by field name
const buildFilesLogSummary = (filesByField) => {
    const out = {};
    for (const [field, arr] of Object.entries(filesByField)) {
        const simplify = (f) => ({
            originalname: f.originalname,
            filename: f.filename || (f.path ? path_1.default.basename(f.path) : undefined),
            mimetype: f.mimetype,
            size: formatBytes(f.size),
        });
        out[field] = arr.length === 1 ? simplify(arr[0]) : arr.map(simplify);
    }
    return out;
};
const enforceFieldPolicy = (filesByField, opts) => {
    var _a;
    if (!opts.enforceAllowedFields || opts.enforceAllowedFields.length === 0)
        return;
    const allowed = new Set(opts.enforceAllowedFields);
    for (const fieldName of Object.keys(filesByField)) {
        if (!allowed.has(fieldName)) {
            const expected = opts.enforceAllowedFields.length === 1
                ? `'${opts.enforceAllowedFields[0]}'`
                : `'${opts.enforceAllowedFields.join("', '")}'`;
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Expected field name ${expected} but got '${fieldName}'`);
        }
        const maxCount = (_a = opts.perFieldMaxCount) === null || _a === void 0 ? void 0 : _a[fieldName];
        if (maxCount && filesByField[fieldName].length > maxCount) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Too many files for field '${fieldName}'. Max ${maxCount}.`);
        }
    }
};
const processFilesToUrls = (filesByField, storageMode, provider, baseUrl, opts) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const processed = {};
    for (const [fieldName, fileArray] of Object.entries(filesByField)) {
        const folder = ((_a = opts.perFieldSubfolder) === null || _a === void 0 ? void 0 : _a[fieldName]) || getFolderByMime(fileArray[0].mimetype);
        const urls = yield Promise.all(fileArray.map(file => generateFileUrl(file, storageMode, provider, baseUrl, folder)));
        processed[fieldName] = fileArray.length > 1 ? urls : urls[0];
    }
    return processed;
});
const normalizeOptions = (fields, options) => {
    var _a;
    const arrayToOptions = (arr) => {
        var _a, _b;
        const enforceAllowedFields = [];
        const perFieldMaxCount = {};
        const perFieldSubfolder = {};
        for (const entry of arr) {
            if (typeof entry === 'string') {
                enforceAllowedFields.push(entry);
                perFieldMaxCount[entry] = (_a = perFieldMaxCount[entry]) !== null && _a !== void 0 ? _a : 1;
            }
            else if (entry && typeof entry.name === 'string') {
                enforceAllowedFields.push(entry.name);
                perFieldMaxCount[entry.name] = (_b = entry.maxCount) !== null && _b !== void 0 ? _b : 1;
                if (entry.subfolder) {
                    perFieldSubfolder[entry.name] = entry.subfolder;
                }
            }
        }
        return { enforceAllowedFields, perFieldMaxCount, perFieldSubfolder };
    };
    const baseFields = Array.isArray(fields) ? arrayToOptions(fields) : fields || {};
    const merged = Object.assign(Object.assign({}, baseFields), options);
    const storageMode = merged.storageMode || (process.env.UPLOAD_MODE === 'memory' ? 'memory' : 'local');
    const cloudProvider = merged.cloudProvider || process.env.CLOUD_PROVIDER || 's3';
    const maxFileSizeMB = merged.maxFileSizeMB || 10;
    const maxFilesTotal = (_a = merged.maxFilesTotal) !== null && _a !== void 0 ? _a : 10;
    return Object.assign(Object.assign({}, merged), { storageMode, cloudProvider, maxFileSizeMB, maxFilesTotal });
};
// ===============================
// Middleware
// ===============================
const fileHandler = (fields, options) => {
    const resolved = normalizeOptions(fields, options);
    const provider = CLOUD_PROVIDERS[resolved.cloudProvider];
    const upload = (0, multer_1.default)({
        storage: createStorage(resolved.storageMode),
        fileFilter,
        limits: { fileSize: resolved.maxFileSizeMB * 1024 * 1024, files: resolved.maxFilesTotal },
    }).any();
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Attach options to request so destination() can access them
        req._fileHandlerOptions = resolved;
        upload(req, res, (err) => __awaiter(void 0, void 0, void 0, function* () {
            if (err) {
                if (err instanceof multer_1.default.MulterError) {
                    const msg = mapMulterError(err, {
                        maxFileSizeMB: resolved.maxFileSizeMB,
                        maxFilesTotal: resolved.maxFilesTotal,
                    });
                    return next(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, msg));
                }
                return next(err);
            }
            try {
                const proto = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.get('host');
                const effectiveBaseUrl = resolved.baseUrl || process.env.BASE_URL || `${proto}://${host}`;
                req.body = parseJsonData(req.body);
                let filesByField = {};
                if (req.files) {
                    filesByField = groupFilesByField(req.files);
                    enforceFieldPolicy(filesByField, resolved);
                    const processedFiles = yield processFilesToUrls(filesByField, resolved.storageMode, provider, effectiveBaseUrl, resolved);
                    req.body = Object.assign(Object.assign({}, req.body), processedFiles);
                }
                next();
            }
            catch (error) {
                next(error);
            }
        }));
    });
};
exports.fileHandler = fileHandler;
// ===============================
// File Deletion
// ===============================
const deleteFile = (fileUrl, storageMode, cloudProviderKey) => __awaiter(void 0, void 0, void 0, function* () {
    const mode = storageMode || (process.env.UPLOAD_MODE === 'memory' ? 'memory' : 'local');
    const cloud = cloudProviderKey || process.env.CLOUD_PROVIDER || 's3';
    const provider = CLOUD_PROVIDERS[cloud];
    if (mode === 'local') {
        let pathname = '';
        try {
            pathname = new URL(fileUrl).pathname;
        }
        catch (_a) {
            pathname = fileUrl;
        }
        const relative = pathname.split('/uploads/')[1];
        if (relative) {
            const localPath = path_1.default.join(process.cwd(), 'uploads', relative);
            if (fs_1.default.existsSync(localPath))
                fs_1.default.unlinkSync(localPath);
        }
    }
    else {
        yield provider.delete(fileUrl);
    }
});
exports.deleteFile = deleteFile;
// ===============================
// Error Mapper
// ===============================
const mapMulterError = (err, opts) => {
    var _a;
    const field = err.field;
    switch (err.code) {
        case 'LIMIT_FILE_SIZE': {
            const sizeText = (opts === null || opts === void 0 ? void 0 : opts.maxFileSizeMB) ? `Max ${opts.maxFileSizeMB} MB` : 'File size limit exceeded';
            return `File too large${field ? ` for field '${field}'` : ''}. ${sizeText}.`;
        }
        case 'LIMIT_FILE_COUNT': {
            return `Too many files uploaded. Max total files: ${(_a = opts === null || opts === void 0 ? void 0 : opts.maxFilesTotal) !== null && _a !== void 0 ? _a : 'limit'}.`;
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
