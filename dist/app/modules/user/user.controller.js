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
exports.UserController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const user_service_1 = require("./user.service");
const user_1 = require("../../../enums/user");
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../config"));
const createUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const _a = req.body, { profileImage } = _a, userData = __rest(_a, ["profileImage"]);
    // Check if requester is an admin (optional auth for this specific endpoint)
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const verifiedUser = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
            if (verifiedUser && verifiedUser.role === user_1.USER_ROLES.ADMIN) {
                isAdmin = true;
            }
        }
        catch (err) {
            // Ignore token errors; fallback to public registration flow
        }
    }
    const result = yield user_service_1.UserService.createUserToDB(Object.assign(Object.assign({}, userData), { profileImage }), isAdmin);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'User created successfully. Please verify your email with the OTP sent.',
        data: {
            email: result.email,
            isVerified: result.isVerified,
            status: result.status,
        },
    });
}));
const getUserProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield user_service_1.UserService.getUserProfileFromDB(user);
    // Private payload (email, dateOfBirth, verification artefacts). Forbid
    // any shared cache and disable disk persistence. Clients may still keep
    // an in-memory copy for the session.
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Profile data retrieved successfully',
        data: result,
    });
}));
const updateProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    // All files + text data are in req.body
    const _a = req.body, { profileImage } = _a, rest = __rest(_a, ["profileImage"]);
    const payload = Object.assign(Object.assign({}, rest), (profileImage ? { profileImage } : {}));
    const result = yield user_service_1.UserService.updateProfileToDB(user, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Profile updated successfully',
        data: Object.assign(Object.assign({ id: result === null || result === void 0 ? void 0 : result._id }, payload), { updatedAt: result === null || result === void 0 ? void 0 : result.updatedAt }),
    });
}));
const updatePreferences = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const payload = req.body;
    const result = yield user_service_1.UserService.updatePreferencesToDB(user, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Preferences updated successfully',
        data: result,
    });
}));
const adminUpdateUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const payload = Object.assign({}, req.body);
    const result = yield user_service_1.UserService.updateUserByAdminInDB(userId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User updated successfully',
        data: {
            id: result === null || result === void 0 ? void 0 : result._id,
            updatedAt: result === null || result === void 0 ? void 0 : result.updatedAt,
        },
    });
}));
const deleteUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const result = yield user_service_1.UserService.deleteUserPermanentlyFromDB(userId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User deleted permanently',
        data: { id: result === null || result === void 0 ? void 0 : result._id },
    });
}));
const getAllUserRoles = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserService.getAllUserRolesFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User list fetched',
        meta: result.meta,
        data: result.data,
    });
}));
const getUserById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const requester = req.user;
    const result = yield user_service_1.UserService.getUserByIdFromDB(userId, requester);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User data retrieved',
        data: result,
    });
}));
const getUserMetrics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_service_1.UserService.getUserMetricsFromDB();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'User metrics retrieved',
        data: result,
    });
}));
const requestAccountDeletion = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { password } = req.body;
    const result = yield user_service_1.UserService.requestAccountDeletionFromDB(user, password);
    // The user's tokens were just invalidated server-side; clear the cookie too.
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.node_env === 'production',
        sameSite: 'lax',
        path: '/',
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Account scheduled for deletion. You can restore it within the recovery window.',
        data: result,
    });
}));
const requestEmailChange = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { newEmail, password } = req.body;
    const result = yield user_service_1.UserService.requestEmailChangeFromDB(user, {
        newEmail,
        password,
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Verification code sent to the new email. Confirm within the OTP window to complete the change.',
        data: result,
    });
}));
const listMySessions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield user_service_1.UserService.listMySessionsFromDB(user);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Active sessions retrieved.',
        data: result,
    });
}));
const revokeMySession = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { tokenId } = req.params;
    const result = yield user_service_1.UserService.revokeMySessionFromDB(user, tokenId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Session revoked.',
        data: result,
    });
}));
const revokeAllMySessions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield user_service_1.UserService.revokeAllMySessionsFromDB(user);
    // tokenVersion was bumped — wipe the refresh cookie so the current
    // browser can't ride its old refresh token.
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.node_env === 'production',
        sameSite: 'lax',
        path: '/',
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'All sessions revoked. Please log in again.',
        data: result,
    });
}));
const exportMyData = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield user_service_1.UserService.exportMyDataFromDB(user);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Personal data export generated.',
        data: result,
    });
}));
const confirmEmailChange = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { otp } = req.body;
    const result = yield user_service_1.UserService.confirmEmailChangeFromDB(user, otp);
    // tokenVersion was bumped — wipe the refresh-token cookie so the browser
    // can't retry with stale credentials.
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.node_env === 'production',
        sameSite: 'lax',
        path: '/',
    });
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Email changed successfully. Please log in again with the new email.',
        data: result,
    });
}));
exports.UserController = {
    createUser,
    getUserProfile,
    updateProfile,
    getAllUserRoles,
    updatePreferences,
    adminUpdateUser,
    deleteUser,
    getUserById,
    getUserMetrics,
    requestAccountDeletion,
    requestEmailChange,
    confirmEmailChange,
    exportMyData,
    listMySessions,
    revokeMySession,
    revokeAllMySessions,
};
