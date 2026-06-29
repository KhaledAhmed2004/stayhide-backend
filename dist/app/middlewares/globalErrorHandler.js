"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../config"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const handleValidationError_1 = __importDefault(require("../../errors/handleValidationError"));
const handleZodError_1 = __importDefault(require("../../errors/handleZodError"));
const handleCastError_1 = __importDefault(require("../../errors/handleCastError"));
const api_1 = require("@opentelemetry/api");
const globalErrorHandler = (error, req, res, next) => {
    // (disabled) redundant separate console log - now beautifully captured and handled by OTel & custom requestLogger
    // OpenTelemetry: start Error Handler span
    const tracer = api_1.trace.getTracer('app');
    const span = tracer.startSpan('Error Handler');
    try {
        span.setAttribute('layer', 'Middleware > Error');
        span.setAttribute('http.method', req.method);
        span.setAttribute('http.route', (req.route && req.route.path) || req.originalUrl || 'n/a');
        span.addEvent('ERROR_HANDLER_START');
        // Record the incoming error for context but keep handler span non-error
        span.recordException(error);
        span.setStatus({ code: 1, message: 'Formatted error response' });
        let statusCode = 500;
        let message = 'Something went wrong';
        let errorMessages = [];
        if (error.name === 'ZodError') {
            const simplifiedError = (0, handleZodError_1.default)(error);
            statusCode = simplifiedError.statusCode;
            message = simplifiedError.message;
            errorMessages = simplifiedError.errorMessages;
        }
        else if (error.name === 'ValidationError') {
            const simplifiedError = (0, handleValidationError_1.default)(error);
            statusCode = simplifiedError.statusCode;
            message = simplifiedError.message;
            errorMessages = simplifiedError.errorMessages;
        }
        else if (error.name === 'CastError') {
            const simplifiedError = (0, handleCastError_1.default)(error);
            statusCode = simplifiedError.statusCode;
            message = simplifiedError.message;
            errorMessages = simplifiedError.errorMessages;
        }
        else if (error.name === 'MongoServerError' &&
            error.code === 11000) {
            statusCode = http_status_codes_1.StatusCodes.CONFLICT;
            const duplicatedField = Object.keys(error.keyValue)[0];
            message = `${duplicatedField} already exists`;
            errorMessages = [
                { path: duplicatedField, message: `${duplicatedField} must be unique` },
            ];
        }
        else if (error.name === 'TokenExpiredError') {
            statusCode = http_status_codes_1.StatusCodes.UNAUTHORIZED;
            message = 'Session Expired';
            errorMessages = [
                {
                    path: '',
                    message: 'Your session has expired. Please log in again to continue.',
                },
            ];
        }
        else if (error instanceof Error &&
            error.message === 'Not allowed by CORS') {
            statusCode = http_status_codes_1.StatusCodes.FORBIDDEN;
            const origin = String(req.headers.origin || 'undefined');
            message = 'CORS blocked: origin not allowed';
            errorMessages = [
                {
                    path: 'Origin',
                    message: `'${origin}' is not permitted by CORS policy. Add it to allowed origins or ensure the request includes the correct Origin header.`,
                },
            ];
            try {
                res.setHeader('X-CORS-Blocked', '1');
                res.setHeader('Vary', 'Origin');
            }
            catch (_a) { }
        }
        else if (error instanceof ApiError_1.default) {
            statusCode = error.statusCode;
            message = error.message;
            errorMessages = error.message
                ? [{ path: '', message: error.message }]
                : [];
        }
        else if (error instanceof Error) {
            message = error.message;
            errorMessages = error.message
                ? [{ path: '', message: error.message }]
                : [];
        }
        res.locals.errorHandledBy = 'globalErrorHandler';
        res.locals.responsePayload = {
            success: false,
            statusCode,
            message,
            errorMessages,
        };
        res.status(statusCode).json({
            success: false,
            message,
            errorMessages,
            stack: config_1.default.node_env !== 'production' ? error === null || error === void 0 ? void 0 : error.stack : undefined,
        });
    }
    finally {
        span.addEvent('FORMATTED_ERROR_RESPONSE');
        span.addEvent('ERROR_HANDLER_COMPLETE');
        span.end();
    }
};
exports.default = globalErrorHandler;
