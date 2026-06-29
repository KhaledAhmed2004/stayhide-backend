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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const http_status_codes_1 = require("http-status-codes");
const config_1 = __importDefault(require("../../../config"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const auth_service_1 = require("./auth.service");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
// Pull the bits of session metadata we persist on `deviceTokens[]` —
// IP (will be hashed by the model) and User-Agent (plain). Kept here
// so every credential-issuing controller (login, social-login,
// restore) feeds the same shape into the service.
const sessionMetadataFromReq = (req) => {
    var _a, _b, _c, _d, _e;
    const ip = (_d = (_a = req.headers['cf-connecting-ip']) !== null && _a !== void 0 ? _a : (_c = (_b = req.headers['x-forwarded-for']) === null || _b === void 0 ? void 0 : _b.split(',')[0]) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : req.ip;
    const userAgent = (_e = req.headers['user-agent']) !== null && _e !== void 0 ? _e : undefined;
    return { ip, userAgent };
};
const verifyEmail = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const verifyData = __rest(req.body, []);
    const result = yield auth_service_1.AuthService.verifyEmailToDB(verifyData);
    // Set refresh token in httpOnly cookie for better security
    if ((_a = result === null || result === void 0 ? void 0 : result.tokens) === null || _a === void 0 ? void 0 : _a.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            path: '/',
        });
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.message,
        data: result.data,
    });
}));
const loginUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const loginData = __rest(req.body, []);
    const result = yield auth_service_1.AuthService.loginUserFromDB(loginData, sessionMetadataFromReq(req));
    // Set refresh token in httpOnly cookie for better security
    if ((_a = result === null || result === void 0 ? void 0 : result.tokens) === null || _a === void 0 ? void 0 : _a.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
        });
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User logged in successfully.',
        data: Object.assign({}, result.tokens),
    });
}));
const logoutUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { deviceToken } = req.body;
    console.log('deviceToken', deviceToken);
    const user = req.user;
    yield auth_service_1.AuthService.logoutUserFromDB(user, deviceToken);
    // Clear refresh token cookie on logout
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.node_env === 'production',
        sameSite: 'lax',
        path: '/',
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User logged out successfully.',
    });
}));
const forgetPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.body.email;
    const result = yield auth_service_1.AuthService.forgetPasswordToDB(email);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Please check your email. We have sent you a one-time passcode (OTP).',
        data: result,
    });
}));
const resetPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Reset token is required');
    }
    // Handle both raw token and Bearer token formats
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : authHeader;
    const resetData = __rest(req.body, []);
    const result = yield auth_service_1.AuthService.resetPasswordToDB(token, resetData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Your password has been successfully reset.',
        data: result,
    });
}));
const changePassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const passwordData = __rest(req.body, []);
    yield auth_service_1.AuthService.changePasswordToDB(user, passwordData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Your password has been successfully changed',
    });
}));
const resendVerifyEmail = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const result = yield auth_service_1.AuthService.resendVerifyEmailToDB(email);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Verification code has been resent to your email.',
        data: result,
    });
}));
const refreshToken = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    // Prefer reading refresh token from cookie; fallback to body if present
    const cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
    const bodyToken = (_b = req.body) === null || _b === void 0 ? void 0 : _b.refreshToken;
    const token = cookieToken || bodyToken || '';
    const result = yield auth_service_1.AuthService.refreshTokenToDB(token);
    // Rotate refresh token in httpOnly cookie
    if ((_c = result === null || result === void 0 ? void 0 : result.tokens) === null || _c === void 0 ? void 0 : _c.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            path: '/',
        });
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Token refreshed successfully.',
        data: result.tokens,
    });
}));
const socialLogin = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield auth_service_1.AuthService.socialLoginToDB(req.body, sessionMetadataFromReq(req));
    // Set refresh token in httpOnly cookie
    if ((_a = result === null || result === void 0 ? void 0 : result.tokens) === null || _a === void 0 ? void 0 : _a.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            path: '/',
        });
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User logged in successfully.',
        data: Object.assign({}, result.tokens),
    });
}));
const restoreAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield auth_service_1.AuthService.restoreAccountFromDB(req.body, sessionMetadataFromReq(req));
    if ((_a = result === null || result === void 0 ? void 0 : result.tokens) === null || _a === void 0 ? void 0 : _a.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config_1.default.node_env === 'production',
            sameSite: 'lax',
            path: '/',
        });
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Account restored successfully.',
        data: Object.assign({}, result.tokens),
    });
}));
exports.AuthController = {
    verifyEmail,
    logoutUser,
    loginUser,
    forgetPassword,
    resetPassword,
    changePassword,
    resendVerifyEmail,
    socialLogin,
    refreshToken,
    restoreAccount,
};
