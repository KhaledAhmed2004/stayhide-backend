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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../app"));
const user_model_1 = require("./user.model");
const connection_model_1 = require("../connection/connection.model");
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
vitest_1.vi.mock('../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        on: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../../../helpers/captchaHelper', () => ({
    captchaHelper: {
        verify: vitest_1.vi.fn().mockResolvedValue(true),
    },
}));
vitest_1.vi.mock('../../../helpers/authHelpers', () => ({
    sendVerificationOTP: vitest_1.vi.fn().mockResolvedValue(true),
}));
let replSet;
function createAuthUser(role_1) {
    return __awaiter(this, arguments, void 0, function* (role, status = user_1.USER_STATUS.ACTIVE) {
        const user = yield user_model_1.User.create({
            name: `Test ${role}`,
            role,
            email: `test-${role}-${Math.random()}@example.com`,
            password: 'password123',
            isVerified: true,
            status,
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
        });
        const token = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, config_1.default.jwt.jwt_secret, '1h');
        return { user, token };
    });
}
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create();
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield user_model_1.User.deleteMany({});
    yield connection_model_1.Connection.deleteMany({});
}));
(0, vitest_1.describe)('User Profile APIs', () => {
    (0, vitest_1.describe)('Admin View: GET /api/v1/users/:userId', () => {
        (0, vitest_1.it)('allows Admin to get any user by ID', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token: adminToken } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const { user: targetUser } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${targetUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.email).toBe(targetUser.email);
        }));
        (0, vitest_1.it)('forbids regular user from accessing Admin-only endpoint', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token: brotherToken } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: targetBrother } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${targetBrother._id}`)
                .set('Authorization', `Bearer ${brotherToken}`);
            (0, vitest_1.expect)(response.status).toBe(403);
            (0, vitest_1.expect)(response.body.success).toBe(false);
            (0, vitest_1.expect)(response.body.message).toBe("You don't have permission to access this API");
        }));
    });
    (0, vitest_1.describe)('Public View: GET /api/v1/users/:userId/public', () => {
        (0, vitest_1.it)('allows User (BROTHER) to get another BROTHER profile', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token: brotherToken } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: targetBrother } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${targetBrother._id}/public`)
                .set('Authorization', `Bearer ${brotherToken}`);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.name).toBe(targetBrother.name);
            // Sensitive fields should be missing (email is not selected in getUserDetailsByIdFromDB)
            (0, vitest_1.expect)(response.body.data.email).toBeUndefined();
        }));
        (0, vitest_1.it)('forbids User (BROTHER) to get a SISTER profile', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token: brotherToken } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: targetSister } = yield createAuthUser(user_1.USER_ROLES.SISTER);
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${targetSister._id}/public`)
                .set('Authorization', `Bearer ${brotherToken}`);
            (0, vitest_1.expect)(response.status).toBe(403);
            (0, vitest_1.expect)(response.body.success).toBe(false);
            (0, vitest_1.expect)(response.body.message).toBe("You don't have permission to view this profile");
        }));
        (0, vitest_1.it)('returns 404 for non-active user when requested by regular user', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token: brotherToken } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: pendingUser } = yield createAuthUser(user_1.USER_ROLES.BROTHER, user_1.USER_STATUS.PENDING);
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${pendingUser._id}/public`)
                .set('Authorization', `Bearer ${brotherToken}`);
            (0, vitest_1.expect)(response.status).toBe(404);
            (0, vitest_1.expect)(response.body.message).toBe("User not found");
        }));
        (0, vitest_1.it)('returns profile details with connection: null when no connection exists', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token: brotherToken } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: targetBrother } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${targetBrother._id}/public`)
                .set('Authorization', `Bearer ${brotherToken}`);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.connection).toBeNull();
        }));
        (0, vitest_1.it)('returns profile details with connection status PENDING and direction OUTGOING when a request is sent by requester', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: userB } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const connectionKey = [userA._id.toString(), userB._id.toString()].sort().join('_');
            const connection = yield connection_model_1.Connection.create({
                sender: userA._id,
                receiver: userB._id,
                connectionKey,
                status: 'PENDING',
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.connection).toBeDefined();
            (0, vitest_1.expect)(response.body.data.connection.status).toBe('PENDING');
            (0, vitest_1.expect)(response.body.data.connection.direction).toBe('OUTGOING');
            (0, vitest_1.expect)(response.body.data.connection.id).toBe(connection._id.toString());
        }));
        (0, vitest_1.it)('returns profile details with connection status PENDING and direction INCOMING when a request is received by requester', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: userB } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const connectionKey = [userA._id.toString(), userB._id.toString()].sort().join('_');
            const connection = yield connection_model_1.Connection.create({
                sender: userB._id,
                receiver: userA._id,
                connectionKey,
                status: 'PENDING',
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.connection).toBeDefined();
            (0, vitest_1.expect)(response.body.data.connection.status).toBe('PENDING');
            (0, vitest_1.expect)(response.body.data.connection.direction).toBe('INCOMING');
            (0, vitest_1.expect)(response.body.data.connection.id).toBe(connection._id.toString());
        }));
        (0, vitest_1.it)('returns profile details with connection status ACCEPTED and omitted direction when connection is accepted', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const { user: userB } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const connectionKey = [userA._id.toString(), userB._id.toString()].sort().join('_');
            const fakeChatId = new mongoose_1.default.Types.ObjectId();
            const connection = yield connection_model_1.Connection.create({
                sender: userA._id,
                receiver: userB._id,
                connectionKey,
                status: 'ACCEPTED',
                chatId: fakeChatId,
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${userB._id}/public`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.connection).toBeDefined();
            (0, vitest_1.expect)(response.body.data.connection.status).toBe('ACCEPTED');
            (0, vitest_1.expect)(response.body.data.connection.direction).toBeUndefined();
            (0, vitest_1.expect)(response.body.data.connection.id).toBe(connection._id.toString());
            (0, vitest_1.expect)(response.body.data.connection.chatId).toBe(fakeChatId.toString());
        }));
    });
});
