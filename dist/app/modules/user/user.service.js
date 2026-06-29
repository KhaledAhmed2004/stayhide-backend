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
exports.UserService = void 0;
const http_status_codes_1 = require("http-status-codes");
const user_1 = require("../../../enums/user");
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const emailHelper_1 = require("../../../helpers/emailHelper");
const emailTemplate_1 = require("../../../shared/emailTemplate");
const authHelpers_1 = require("../../../helpers/authHelpers");
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const generateOTP_1 = __importDefault(require("../../../util/generateOTP"));
const user_model_1 = require("./user.model");
const device_token_model_1 = require("../device-token/device-token.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const auth_constants_1 = require("../../../config/auth.constants");
const mongoose_2 = __importDefault(require("mongoose"));
const createUserToDB = (payload_1, ...args_1) => __awaiter(void 0, [payload_1, ...args_1], void 0, function* (payload, isAdmin = false) {
    const session = yield mongoose_2.default.startSession();
    try {
        session.startTransaction();
        // 1. Email Uniqueness Check (409 Conflict)
        const existingUser = yield user_model_1.User.findOne({ email: payload.email }).session(session);
        if (existingUser) {
            if (existingUser.isVerified) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email already registered');
            }
            else {
                // Handle pending account: If created < 24h, block. If > 24h, delete and recreate.
                const dayInMs = 24 * 60 * 60 * 1000;
                const isRecent = Date.now() - new Date(existingUser.createdAt).getTime() < dayInMs;
                if (isRecent) {
                    throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email already registered and pending verification');
                }
                else {
                    yield user_model_1.User.findByIdAndDelete(existingUser._id).session(session);
                }
            }
        }
        // 2. Prepare User Data
        const userData = Object.assign(Object.assign({}, payload), { isVerified: isAdmin ? true : false, status: isAdmin ? user_1.USER_STATUS.ACTIVE : user_1.USER_STATUS.PENDING });
        // 3. Create User
        const [createUser] = yield user_model_1.User.create([userData], { session });
        if (!createUser) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create user');
        }
        // 4. Send Verification OTP (Only for public registration)
        if (!isAdmin) {
            // Note: sendVerificationOTP must also support session if it writes to DB
            yield (0, authHelpers_1.sendVerificationOTP)(createUser.email, session);
        }
        yield session.commitTransaction();
        return createUser;
    }
    catch (err) {
        yield session.abortTransaction();
        throw err;
    }
    finally {
        session.endSession();
    }
});
const getUserProfileFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.findById(id)
        .select('-password -authentication -tokenVersion -deviceTokens -deletedAt')
        .lean();
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    return isExistUser;
});
const updateProfileToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    // //unlink file here
    // if (payload.image) {
    //   unlinkFile(isExistUser.image);
    // }
    //unlink file here
    if (payload.profileImage) {
        (0, unlinkFile_1.default)(isExistUser.profileImage);
    }
    const updateDoc = yield user_model_1.User.findOneAndUpdate({ _id: id }, payload, {
        new: true,
    });
    return updateDoc;
});
const updatePreferencesToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const updateDoc = yield user_model_1.User.findOneAndUpdate({ _id: id }, payload, {
        new: true,
    });
    return updateDoc;
});
const getAllUsersFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const userQuery = new QueryBuilder_1.default(user_model_1.User.find(), query)
        .search(['name', 'email'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const users = yield userQuery.modelQuery;
    const paginationInfo = yield userQuery.getPaginationInfo();
    return {
        meta: paginationInfo,
        data: users,
    };
});
const getUserMetricsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const aggregationBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const excludeAdminFilter = { role: { $ne: user_1.USER_ROLES.ADMIN } };
    // Overall user growth (excluding SUPER_ADMIN)
    const totalStats = yield aggregationBuilder.calculateGrowth({
        filter: excludeAdminFilter,
        period: 'month'
    });
    // Status based growth (excluding SUPER_ADMIN)
    aggregationBuilder.reset();
    const activeStats = yield aggregationBuilder.calculateGrowth({
        filter: Object.assign(Object.assign({}, excludeAdminFilter), { status: user_1.USER_STATUS.ACTIVE }),
        period: 'month'
    });
    aggregationBuilder.reset();
    const pendingStats = yield aggregationBuilder.calculateGrowth({
        filter: Object.assign(Object.assign({}, excludeAdminFilter), { status: user_1.USER_STATUS.PENDING }),
        period: 'month'
    });
    aggregationBuilder.reset();
    const suspendedStats = yield aggregationBuilder.calculateGrowth({
        filter: Object.assign(Object.assign({}, excludeAdminFilter), { status: user_1.USER_STATUS.SUSPENDED }),
        period: 'month'
    });
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: stat.growth,
        direction: stat.growthType === 'increase' ? 'up' : stat.growthType === 'decrease' ? 'down' : 'neutral',
    });
    return {
        meta: {
            comparisonPeriod: 'month',
        },
        totalUsers: formatMetric(totalStats),
        activeUsers: formatMetric(activeStats),
        pendingUsers: formatMetric(pendingStats),
        suspendedUsers: formatMetric(suspendedStats),
    };
});
const getAllUserRolesFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm, email, role, status, isVerified, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const match = {
        role: { $ne: user_1.USER_ROLES.ADMIN },
    };
    if (status)
        match.status = status;
    if (isVerified !== undefined)
        match.isVerified = isVerified === 'true' ? true : isVerified === 'false' ? false : isVerified;
    if (role)
        match.role = role;
    if (email)
        match.email = { $regex: email, $options: 'i' };
    if (searchTerm) {
        match.$or = [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
        ];
    }
    const basePipeline = [
        { $match: match },
        {
            $project: status === user_1.USER_STATUS.PENDING
                ? {
                    _id: 1,
                    name: 1,
                    email: 1,
                    role: 1,
                    verificationImage: 1,
                    verificationVideo: 1,
                    createdAt: 1,
                }
                : {
                    _id: 1,
                    name: 1,
                    email: 1,
                    phone: 1,
                    status: 1,
                    isVerified: 1,
                    role: 1,
                    profileImage: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
        },
    ];
    const sortStage = {
        $sort: { [sortBy]: sortOrder === -1 ? -1 : 1 },
    };
    const paginatedPipeline = [
        ...basePipeline,
        sortStage,
        { $skip: skip },
        { $limit: Number(limit) },
    ];
    const countPipeline = [
        ...basePipeline,
        { $count: 'total' },
    ];
    const [data, countResult] = yield Promise.all([
        user_model_1.User.aggregate(paginatedPipeline),
        user_model_1.User.aggregate(countPipeline),
    ]);
    const total = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(total / Number(limit));
    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
        },
        data,
    };
});
const getUserByIdFromDB = (id, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id).select('-password -authentication -tokenVersion -deviceTokens -deletedAt').lean();
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    // Admin specific view: can see all fields except excluded ones above
    return user;
});
// Statuses that should make every live JWT for the user stop working
// immediately. We bump `tokenVersion` on flips INTO these so a stolen or
// in-flight token can't keep being used after the admin acts.
const SESSION_INVALIDATING_STATUSES = [
    user_1.USER_STATUS.SUSPENDED,
    user_1.USER_STATUS.RESTRICTED,
    user_1.USER_STATUS.DELETED,
    user_1.USER_STATUS.REJECTED,
    user_1.USER_STATUS.INACTIVE,
];
const deleteUserPermanentlyFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const deletedUser = yield user_model_1.User.findByIdAndDelete(id)
        .select('-password -authentication');
    return deletedUser;
});
const updateUserByAdminInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Pull tokenVersion so we can bump it locally on lockout transitions.
    // password stays selected for the schema's bcrypt pre-save hook.
    const user = yield user_model_1.User.findById(id).select('+password +tokenVersion');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const previousStatus = user.status;
    // Email uniqueness â€” admin can change a user's email, but the change
    // must not collide with another active account. Without this check the
    // model's unique index trips an E11000 at .save() that surfaces as a
    // confusing 500 instead of the documented 409.
    if (payload.email !== undefined && payload.email !== user.email) {
        const taken = yield user_model_1.User.findOne({
            email: payload.email,
            _id: { $ne: user._id },
            status: { $ne: user_1.USER_STATUS.DELETED },
        }).lean();
        if (taken) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
        }
    }
    // Whitelist fields admin can update (excluding password/auth info)
    if (payload.name !== undefined)
        user.name = payload.name;
    if (payload.email !== undefined)
        user.email = payload.email;
    if (payload.dateOfBirth !== undefined)
        user.dateOfBirth = payload.dateOfBirth;
    // if (payload.gender !== undefined) (user as any).gender = payload.gender;
    if (payload.profileImage !== undefined)
        user.profileImage = payload.profileImage;
    if (payload.status !== undefined)
        user.status = payload.status;
    if (payload.role !== undefined)
        user.role = payload.role;
    if (payload.rejectionReason !== undefined)
        user.rejectionReason = payload.rejectionReason;
    // Status-change side effects
    // status. Without this hook, an admin who flips status via this route
    // bypasses both the reverify-token email and the tokenVersion bump.
    const newStatus = user.status;
    const statusChanged = payload.status !== undefined && newStatus !== previousStatus;
    const flippingToLockout = statusChanged && SESSION_INVALIDATING_STATUSES.includes(newStatus);
    if (flippingToLockout) {
        user.tokenVersion = ((_a = user.tokenVersion) !== null && _a !== void 0 ? _a : 0) + 1;
    }
    yield user.save();
    const plain = user.toObject();
    delete plain.password;
    delete plain.authentication;
    delete plain.tokenVersion;
    return plain;
});
const SOFT_DELETE_RECOVERY_DAYS = 30;
const requestAccountDeletionFromDB = (user, password) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    // Pull password + tokenVersion explicitly â€” both are select: false on the schema.
    const dbUser = yield user_model_1.User.findById(id).select('+password +tokenVersion');
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    if (dbUser.status === user_1.USER_STATUS.DELETED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Account is already scheduled for deletion');
    }
    // Defense-in-depth: stolen token alone must not be enough to wipe an account.
    if (!dbUser.password) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password-less accounts (Google/Apple) cannot be deleted via this endpoint yet');
    }
    const passwordOk = yield user_model_1.User.isMatchPassword(password, dbUser.password);
    if (!passwordOk) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Incorrect password');
    }
    const now = new Date();
    const recoveryDeadline = new Date(now.getTime() + SOFT_DELETE_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
    // Bumping tokenVersion immediately invalidates every JWT this user holds.
    yield user_model_1.User.findByIdAndUpdate(id, {
        $set: {
            status: user_1.USER_STATUS.DELETED,
            deletedAt: now,
            recoveryDeadline,
            // Drop push targets â€” the user is logically gone until they restore.
            deviceTokens: [],
        },
        $inc: { tokenVersion: 1 },
    });
    return {
        deletedAt: now.toISOString(),
        recoveryDeadline: recoveryDeadline.toISOString(),
        recoveryWindowDays: SOFT_DELETE_RECOVERY_DAYS,
    };
});
const requestEmailChangeFromDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const { newEmail, password } = payload;
    // Pull password explicitly â€” select: false on the schema.
    const dbUser = yield user_model_1.User.findById(id).select('+password');
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    if (!dbUser.password) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password-less accounts (Google/Apple) cannot change email via this endpoint yet');
    }
    const passwordOk = yield user_model_1.User.isMatchPassword(password, dbUser.password);
    if (!passwordOk) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Incorrect password');
    }
    // Reject no-op changes early so the user gets a clear message instead of
    // silently consuming an OTP slot.
    if (dbUser.email === newEmail) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'New email is the same as the current email');
    }
    // Uniqueness â€” exclude soft-deleted users so a recoverable account doesn't
    // permanently block its own email.
    const taken = yield user_model_1.User.findOne({
        email: newEmail,
        _id: { $ne: dbUser._id },
        status: { $ne: user_1.USER_STATUS.DELETED },
    }).lean();
    if (taken) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
    }
    const otp = (0, generateOTP_1.default)();
    const expireAt = new Date(Date.now() + auth_constants_1.OTP_TTL_MS);
    yield user_model_1.User.findByIdAndUpdate(id, {
        $set: {
            emailChange: { newEmail, otp, expireAt },
        },
    });
    // OTP to the NEW email â€” proves the user controls that inbox.
    yield emailHelper_1.emailHelper.enqueue(emailTemplate_1.emailTemplate.changeEmail({ newEmail, otp }), { kind: 'email_change_otp' });
    // Heads-up to the OLD email â€” catches takeover attempts where the
    // attacker has the password but not the original inbox.
    yield emailHelper_1.emailHelper.enqueue(emailTemplate_1.emailTemplate.emailChangeNotification({
        oldEmail: dbUser.email,
        newEmail,
    }), { kind: 'email_change_notification' });
    return {
        newEmail,
        expireAt: expireAt.toISOString(),
        otpTtlSeconds: auth_constants_1.OTP_TTL_MS / 1000,
    };
});
const confirmEmailChangeFromDB = (user, otp) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    // Pull emailChange + tokenVersion explicitly â€” both are select: false.
    const dbUser = yield user_model_1.User.findById(id).select('+emailChange +tokenVersion');
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const pending = dbUser.emailChange;
    if (!pending || !pending.newEmail || !pending.otp || !pending.expireAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No pending email-change request');
    }
    if (pending.expireAt.getTime() <= Date.now()) {
        // Clear the stale request so a fresh one can replace it.
        yield user_model_1.User.findByIdAndUpdate(id, {
            $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
        });
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'OTP has expired');
    }
    if (pending.otp !== otp) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid OTP');
    }
    // Re-check uniqueness at commit time â€” someone else may have grabbed the
    // address while this OTP was outstanding.
    const taken = yield user_model_1.User.findOne({
        email: pending.newEmail,
        _id: { $ne: dbUser._id },
        status: { $ne: user_1.USER_STATUS.DELETED },
    }).lean();
    if (taken) {
        yield user_model_1.User.findByIdAndUpdate(id, {
            $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
        });
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
    }
    // Commit: flip email, clear pending, bump tokenVersion to invalidate every
    // JWT issued under the old identifier. User must log in again with the new
    // email.
    //
    // Race: even though we re-checked uniqueness above, a parallel commit
    // from another user (also racing for the same address) can squeeze in
    // between the check and the write. The unique index on `email` then
    // throws E11000 â€” we catch it and surface the same `409 "This email is
    // already in use"` the pre-check would have produced. This is the final
    // safety net for the uniqueness invariant.
    try {
        yield user_model_1.User.findByIdAndUpdate(id, {
            $set: {
                email: pending.newEmail,
                emailChange: { newEmail: null, otp: null, expireAt: null },
            },
            $inc: { tokenVersion: 1 },
        });
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.code) === 11000) {
            // Mongo unique-key violation â€” another user already owns the
            // address. Clear the pending request so the user can start over.
            yield user_model_1.User.findByIdAndUpdate(id, {
                $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
            });
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
        }
        throw err;
    }
    return {
        email: pending.newEmail,
    };
});
// GDPR data export. Aggregates everything the system stores ABOUT this
// user into a single JSON envelope, then returns it synchronously. The
// caller (controller) wraps it in the standard success envelope.
//
// What's included: the user's own profile (sensitive auth fields stripped),
// their notifications, their subscription history (kept across purge for
// audit), their group activity, and their ask-imam questions.
//
// What's excluded: password hash, the `authentication` and `emailChange`
// OTP subdocs, `tokenVersion`, raw push-notification `deviceTokens` values
// (we expose only the metadata: platform, appVersion, lastSeenAt).
// Sessions = entries in User.deviceTokens. Each entry has a stable
// Mongoose subdoc `_id` (since v2 of the schema) which we expose as
// `tokenId` to the client. The raw FCM/APNs token value is NEVER
// returned â€” it's a credential that would let a third party hijack
// push delivery.
const listMySessionsFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    // Verify user still exists
    const dbUser = yield user_model_1.User.findById(id).select('_id').lean();
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const deviceTokens = yield device_token_model_1.DeviceToken.find({ user: id }).lean();
    const sessions = deviceTokens.map((dt) => {
        var _a, _b, _c, _d;
        return ({
            tokenId: dt._id ? dt._id.toString() : null,
            tokenPrefix: (_a = dt.tokenPrefix) !== null && _a !== void 0 ? _a : null,
            platform: (_b = dt.platform) !== null && _b !== void 0 ? _b : null,
            appVersion: (_c = dt.appVersion) !== null && _c !== void 0 ? _c : null,
            lastSeenAt: (_d = dt.lastSeenAt) !== null && _d !== void 0 ? _d : null,
        });
    });
    return { sessions };
});
const revokeMySessionFromDB = (user, tokenId) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const result = yield device_token_model_1.DeviceToken.findOneAndDelete({
        _id: new mongoose_1.Types.ObjectId(tokenId),
        user: id,
    });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Session not found');
    }
    return { tokenId };
});
const revokeAllMySessionsFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    yield device_token_model_1.DeviceToken.deleteMany({ user: id });
    const result = yield user_model_1.User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    return { revokedAt: new Date().toISOString() };
});
const exportMyDataFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    // Lazy-load cascade collections â€” same import paths the purge cron uses.
    // Kept inside the function so the user module doesn't pay the import
    // cost on every other endpoint.
    const { Notification } = yield Promise.resolve().then(() => __importStar(require('../notification/notification.model')));
    const { Subscription } = yield Promise.resolve().then(() => __importStar(require('../subscription/subscription.model')));
    const { SubscriptionEvent } = yield Promise.resolve().then(() => __importStar(require('../subscription/subscription-event.model')));
    // Profile â€” strip all the fields a GDPR export must NOT leak even back
    // to the user themselves (password hash, OTP state, token version).
    const profile = yield user_model_1.User.findById(id)
        .select('-password -authentication -emailChange -tokenVersion -deletedAt')
        .lean();
    if (!profile) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    // Sanitize deviceTokens â€” return display metadata only. Strip both
    // the legacy raw `token` field AND the HMAC `tokenHash` (the hash by
    // itself doesn't enable impersonation, but combined with the JWT
    // secret could verify ownership of a leaked raw token). `tokenPrefix`
    // is safe to expose â€” 6 suffix chars only.
    const rawDeviceTokens = yield device_token_model_1.DeviceToken.find({ user: id }).lean();
    const deviceTokens = rawDeviceTokens.map((dt) => {
        var _a, _b, _c, _d;
        return ({
            tokenPrefix: (_a = dt.tokenPrefix) !== null && _a !== void 0 ? _a : null,
            platform: (_b = dt.platform) !== null && _b !== void 0 ? _b : null,
            appVersion: (_c = dt.appVersion) !== null && _c !== void 0 ? _c : null,
            lastSeenAt: (_d = dt.lastSeenAt) !== null && _d !== void 0 ? _d : null,
        });
    });
    profile.deviceTokens = deviceTokens;
    // Fan-out: each collection that references this user.
    const [notifications, subscriptions, subscriptionEvents,] = yield Promise.all([
        Notification.find({ userId: id }).lean(),
        Subscription.find({ userId: id }).lean(),
        SubscriptionEvent.find({ userId: id }).lean(),
    ]);
    const payload = {
        exportedAt: new Date().toISOString(),
        schemaVersion: 1,
        profile,
        notifications,
        subscriptionData: {
            subscriptions,
            subscriptionEvents,
        },
    };
    // Size guard. Synchronous JSON export only stays safe under ~5 MB â€”
    // beyond that, mobile clients hit body-size limits and the response
    // can time out. When we exceed it, refuse with a clear message so the
    // client knows to wait for the future async-delivery variant rather
    // than mistaking it for a generic 5xx.
    const SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
    const sizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (sizeBytes > SIZE_LIMIT_BYTES) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.REQUEST_TOO_LONG, `Export payload exceeds the synchronous size limit (${(sizeBytes / 1024 / 1024).toFixed(1)} MB > 5 MB). An async email-link variant is planned; until then, contact support to receive a copy of your data.`);
    }
    return payload;
});
// Anonymized projection of a soft-deleted user. Other modules use this
// shape when they need to surface "the author of this post" without
// leaking the original identity. See system-concepts.md "Public User
// Display" for the policy.
const DELETED_USER_PROJECTION = {
    name: '[Deleted User]',
    // Hardcoded safe fallback object with no external dependencies
    profileImage: '/default-avatar.svg',
};
const projectPublic = (doc, requestedId) => {
    // If the user is completely missing (hard deleted), we return a safe projection
    // with the requested ID attached to prevent chat/post queries from breaking.
    if (!doc) {
        return {
            _id: requestedId,
            name: DELETED_USER_PROJECTION.name,
            profileImage: DELETED_USER_PROJECTION.profileImage,
            role: user_1.USER_ROLES.USER, // Safe default
            isDeleted: true,
        };
    }
    const isDeleted = doc.status === user_1.USER_STATUS.DELETED || Boolean(doc.deletedAt);
    if (isDeleted) {
        return {
            _id: doc._id,
            name: DELETED_USER_PROJECTION.name,
            profileImage: DELETED_USER_PROJECTION.profileImage,
            role: doc.role,
            isDeleted: true,
        };
    }
    return {
        _id: doc._id,
        name: doc.name,
        profileImage: doc.profileImage,
        role: doc.role,
        isDeleted: false,
    };
};
const getPublicProfileById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield user_model_1.User.findById(id)
        .select('_id name profileImage role status deletedAt')
        .lean();
    return projectPublic(doc, id);
});
const getPublicProfilesByIds = (ids) => __awaiter(void 0, void 0, void 0, function* () {
    const docs = yield user_model_1.User.find({ _id: { $in: ids } })
        .select('_id name profileImage role status deletedAt')
        .lean();
    // Ensure we map back to the requested IDs to preserve missing/deleted users
    return ids.map(id => {
        const foundDoc = docs.find(d => String(d._id) === String(id));
        return projectPublic(foundDoc, id);
    }).filter(Boolean);
});
exports.UserService = {
    createUserToDB,
    getUserProfileFromDB,
    updateProfileToDB,
    updatePreferencesToDB,
    getAllUsersFromDB,
    getAllUserRolesFromDB,
    updateUserByAdminInDB,
    deleteUserPermanentlyFromDB,
    getUserByIdFromDB,
    getUserMetricsFromDB,
    requestAccountDeletionFromDB,
    requestEmailChangeFromDB,
    confirmEmailChangeFromDB,
    exportMyDataFromDB,
    listMySessionsFromDB,
    revokeMySessionFromDB,
    revokeAllMySessionsFromDB,
    getPublicProfileById,
    getPublicProfilesByIds,
};
