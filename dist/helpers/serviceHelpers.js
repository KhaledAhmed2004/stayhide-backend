"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.ensureOwnershipOrThrow = exports.ensureStatusOrThrow = exports.withTransaction = exports.getCount = exports.existsById = exports.restoreByIdOrThrow = exports.softDeleteByIdOrThrow = exports.deleteByIdOrThrow = exports.updateByIdOrThrow = exports.findByIdOrThrow = exports.notDeleted = exports.validateObjectIdOrThrow = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ApiError_1 = __importDefault(require("../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const validateObjectIdOrThrow = (id, field = 'id') => {
    var _a, _b;
    const s = (_b = (_a = id === null || id === void 0 ? void 0 : id.toString) === null || _a === void 0 ? void 0 : _a.call(id)) !== null && _b !== void 0 ? _b : String(id);
    if (!mongoose_1.Types.ObjectId.isValid(s)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${field}: ${s}`);
    }
};
exports.validateObjectIdOrThrow = validateObjectIdOrThrow;
// Helper to exclude soft deleted docs by default
const notDeleted = (extra = {}) => (Object.assign({ isDeleted: { $ne: true } }, extra));
exports.notDeleted = notDeleted;
/**
 * Generic function to find a document by ID with error handling
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param entityName - Name of the entity for error messages
 * @returns Found document
 * @throws ApiError if document not found
 */
const findByIdOrThrow = (model_1, id_1, ...args_1) => __awaiter(void 0, [model_1, id_1, ...args_1], void 0, function* (model, id, entityName = 'Resource', opts = {}) {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findById(id, opts.projection);
    if (opts.session)
        q = q.session(opts.session);
    if (opts.lean)
        q = q.lean();
    const document = yield q;
    if (!document) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return document;
});
exports.findByIdOrThrow = findByIdOrThrow;
/**
 * Generic function to update a document by ID with validation
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param updateData - Data to update
 * @param entityName - Name of the entity for error messages
 * @returns Updated document
 * @throws ApiError if document not found
 */
const updateByIdOrThrow = (model_1, id_1, updateData_1, ...args_1) => __awaiter(void 0, [model_1, id_1, updateData_1, ...args_1], void 0, function* (model, id, updateData, entityName = 'Resource', opts = {}) {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });
    if (opts.session)
        q = q.session(opts.session);
    if (opts.projection)
        q = q.select(opts.projection);
    const updatedDocument = yield q;
    if (!updatedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return updatedDocument;
});
exports.updateByIdOrThrow = updateByIdOrThrow;
/**
 * Generic function to delete a document by ID with validation
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param entityName - Name of the entity for error messages
 * @returns Deleted document
 * @throws ApiError if document not found
 */
const deleteByIdOrThrow = (model_1, id_1, ...args_1) => __awaiter(void 0, [model_1, id_1, ...args_1], void 0, function* (model, id, entityName = 'Resource') {
    (0, exports.validateObjectIdOrThrow)(id);
    const deletedDocument = yield model.findByIdAndDelete(id);
    if (!deletedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return deletedDocument;
});
exports.deleteByIdOrThrow = deleteByIdOrThrow;
/**
 * Generic function to soft delete a document (set isDeleted: true)
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param entityName - Name of the entity for error messages
 * @returns Updated document
 * @throws ApiError if document not found
 */
const softDeleteByIdOrThrow = (model_1, id_1, ...args_1) => __awaiter(void 0, [model_1, id_1, ...args_1], void 0, function* (model, id, entityName = 'Resource', opts = {}) {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() }, { new: true, runValidators: true });
    if (opts.session)
        q = q.session(opts.session);
    if (opts.projection)
        q = q.select(opts.projection);
    const updatedDocument = yield q;
    if (!updatedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return updatedDocument;
});
exports.softDeleteByIdOrThrow = softDeleteByIdOrThrow;
const restoreByIdOrThrow = (model_1, id_1, ...args_1) => __awaiter(void 0, [model_1, id_1, ...args_1], void 0, function* (model, id, entityName = 'Resource', opts = {}) {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null }, { new: true, runValidators: true });
    if (opts.session)
        q = q.session(opts.session);
    if (opts.projection)
        q = q.select(opts.projection);
    const updatedDocument = yield q;
    if (!updatedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return updatedDocument;
});
exports.restoreByIdOrThrow = restoreByIdOrThrow;
/**
 * Check if a document exists by ID
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @returns Boolean indicating existence
 */
const existsById = (model, id) => __awaiter(void 0, void 0, void 0, function* () {
    (0, exports.validateObjectIdOrThrow)(id);
    const res = yield model.exists({ _id: id });
    return !!res;
});
exports.existsById = existsById;
/**
 * Get document count with optional filter
 * @param model - Mongoose model
 * @param filter - Optional filter conditions
 * @returns Document count
 */
const getCount = (model_1, ...args_1) => __awaiter(void 0, [model_1, ...args_1], void 0, function* (model, filter = {}) {
    const isEmpty = Object.keys(filter).length === 0;
    if (isEmpty)
        return model.estimatedDocumentCount();
    return yield model.countDocuments(filter);
});
exports.getCount = getCount;
/**
 * Run a set of operations inside a MongoDB transaction
 * @param fn - Callback that receives the session and returns a result
 * @returns Result of the callback after commit
 */
const withTransaction = (fn, opts) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const session = yield mongoose_1.default.startSession();
    const readConcern = (_a = opts === null || opts === void 0 ? void 0 : opts.readConcern) !== null && _a !== void 0 ? _a : { level: 'snapshot' };
    const writeConcern = (_b = opts === null || opts === void 0 ? void 0 : opts.writeConcern) !== null && _b !== void 0 ? _b : { w: 'majority', j: true };
    const maxRetries = Math.max(0, (_c = opts === null || opts === void 0 ? void 0 : opts.maxRetries) !== null && _c !== void 0 ? _c : 0);
    let attempt = 0;
    while (true) {
        try {
            yield session.startTransaction({ readConcern, writeConcern });
            const result = yield fn(session);
            yield session.commitTransaction();
            return result;
        }
        catch (error) {
            yield session.abortTransaction();
            const transient = !!((_e = (_d = error === null || error === void 0 ? void 0 : error.errorLabels) === null || _d === void 0 ? void 0 : _d.includes) === null || _e === void 0 ? void 0 : _e.call(_d, 'TransientTransactionError'));
            if (transient && attempt < maxRetries) {
                attempt += 1;
                continue;
            }
            throw error;
        }
        finally {
            session.endSession();
        }
    }
});
exports.withTransaction = withTransaction;
/**
 * Ensure a document's status matches expected value(s), otherwise throw
 * @param currentStatus - The current status value
 * @param expected - A single expected status or a list of allowed statuses
 * @param options - Optional error customization
 */
const ensureStatusOrThrow = (currentStatus, expected, options) => {
    var _a, _b, _c;
    const ok = Array.isArray(expected)
        ? expected.includes(currentStatus)
        : currentStatus === expected;
    if (!ok) {
        const code = (_a = options === null || options === void 0 ? void 0 : options.code) !== null && _a !== void 0 ? _a : http_status_codes_1.StatusCodes.BAD_REQUEST;
        const entity = (_b = options === null || options === void 0 ? void 0 : options.entityName) !== null && _b !== void 0 ? _b : 'Resource';
        const message = (_c = options === null || options === void 0 ? void 0 : options.message) !== null && _c !== void 0 ? _c : `${entity} has invalid status: ${String(currentStatus)}`;
        throw new ApiError_1.default(code, message);
    }
};
exports.ensureStatusOrThrow = ensureStatusOrThrow;
const toIdStr = (v) => (v ? v.toString() : '');
const ensureOwnershipOrThrow = (entity, ownerKey, userId, options) => {
    var _a, _b;
    const keys = Array.isArray(ownerKey) ? ownerKey : [ownerKey];
    const userStr = userId.toString();
    const hasOwnership = keys.some((k) => {
        const value = k
            .split('.')
            .reduce((acc, part) => (acc ? acc[part] : undefined), entity);
        if (Array.isArray(value))
            return value.map(toIdStr).includes(userStr);
        return toIdStr(value) === userStr;
    });
    if (!hasOwnership) {
        const code = (_a = options === null || options === void 0 ? void 0 : options.code) !== null && _a !== void 0 ? _a : http_status_codes_1.StatusCodes.FORBIDDEN;
        const message = (_b = options === null || options === void 0 ? void 0 : options.message) !== null && _b !== void 0 ? _b : 'You are not authorized to perform this action';
        throw new ApiError_1.default(code, message);
    }
};
exports.ensureOwnershipOrThrow = ensureOwnershipOrThrow;
