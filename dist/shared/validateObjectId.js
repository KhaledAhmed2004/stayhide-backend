"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateObjectId = void 0;
const mongoose_1 = require("mongoose");
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../errors/ApiError"));
/**
 * Throws a 400 ApiError if `id` is not a valid MongoDB ObjectId.
 * Use this at the top of any service function that receives an id parameter
 * to prevent raw Mongoose CastErrors from leaking into the error handler.
 *
 * @param id    - The string to validate
 * @param label - Human-readable label used in the error message (default: 'ID')
 *
 * @example
 * validateObjectId(questionId, 'question ID');
 */
const validateObjectId = (id, label = 'ID') => {
    if (!(0, mongoose_1.isValidObjectId)(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${label}`);
    }
};
exports.validateObjectId = validateObjectId;
