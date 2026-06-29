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
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../config"));
const user_1 = require("../../enums/user");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const jwtHelper_1 = require("../../helpers/jwtHelper");
const user_model_1 = require("../modules/user/user.model");
const auth = (...allowedRoles) => (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const authHeader = req.headers.authorization;
        // 1ï¸âƒ£ No token provided â€” require authentication for all protected routes
        if (!authHeader) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Unauthorized access');
        }
        // 2ï¸âƒ£ Validate Bearer format
        if (!authHeader.startsWith('Bearer ')) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Authorization header must start with "Bearer "');
        }
        // 3ï¸âƒ£ Extract token and ensure it's not empty
        const token = authHeader.split(' ')[1];
        if (!token || token.trim() === '') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Unauthorized access');
        }
        // 4ï¸âƒ£ Verify JWT token
        const verifiedUser = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
        if (!verifiedUser || !verifiedUser.role) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid token payload');
        }
        // 5ï¸âƒ£ tokenVersion check â€” ensure the JWT's version still matches the
        //     current DB value. This is what makes force-logout / password
        //     reset / status flip actually invalidate live access tokens
        //     instead of waiting for them to expire naturally.
        //
        //     `tokenVersion` is `select: false` on the schema, so we must pull
        //     it explicitly. `.lean()` keeps this ~1ms indexed `_id` lookup.
        const dbUser = yield user_model_1.User.findById(verifiedUser.id)
            .select('+tokenVersion status')
            .lean();
        if (!dbUser) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'User no longer exists');
        }
        // Block access for non-active accounts at the middleware level so
        // every protected route gets the guarantee for free.
        if (dbUser.status === user_1.USER_STATUS.DELETED ||
            dbUser.status === user_1.USER_STATUS.RESTRICTED ||
            dbUser.status === user_1.USER_STATUS.SUSPENDED ||
            dbUser.status === user_1.USER_STATUS.REJECTED ||
            dbUser.status === user_1.USER_STATUS.INACTIVE ||
            dbUser.status === user_1.USER_STATUS.PENDING) {
            let message;
            if (dbUser.status === user_1.USER_STATUS.SUSPENDED) {
                message = 'Account is suspended. Please contact support.';
            }
            else if (dbUser.status === user_1.USER_STATUS.REJECTED) {
                message = 'Account verification was rejected. Please re-submit your documents.';
            }
            else if (dbUser.status === user_1.USER_STATUS.PENDING) {
                message = 'Admin Verification Pending. Your account is currently under review.';
            }
            else {
                message = 'Account is no longer active';
            }
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, message);
        }
        const jwtTokenVersion = verifiedUser.tokenVersion;
        // Handle the case where tokenVersion might be missing in DB (legacy users)
        // or missing in the lean object. Treat missing as 0 to match schema default.
        const dbTokenVersion = (_a = dbUser.tokenVersion) !== null && _a !== void 0 ? _a : 0;
        if (typeof jwtTokenVersion === 'number' &&
            dbTokenVersion !== jwtTokenVersion) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Session invalidated â€” please log in again');
        }
        // 6ï¸âƒ£ Attach verified user to request
        req.user = verifiedUser;
        // 7ï¸âƒ£ Role-based access check
        if (allowedRoles.length && !allowedRoles.includes(verifiedUser.role)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You don't have permission to access this API");
        }
        // 8ï¸âƒ£ Proceed
        next();
    }
    catch (error) {
        // Handle JWT-specific errors
        if (error.name === 'JsonWebTokenError') {
            return next(new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Invalid token'));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Token has expired'));
        }
        if (error.name === 'NotBeforeError') {
            return next(new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Token not active'));
        }
        // Pass other errors
        next(error);
    }
});
exports.default = auth;
