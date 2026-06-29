"use strict";
/**
 * E2E tests for AskQuestion module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server for real MongoDB.
 * Mocks NotificationBuilder and Redis.
 */
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
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../../user/user.model");
const ask_question_model_1 = __importDefault(require("../ask-question.model"));
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../../builder/NotificationBuilder/NotificationBuilder', () => {
    const mockSend = vitest_1.vi.fn().mockResolvedValue({ success: true });
    const mockBuilder = {
        to: vitest_1.vi.fn().mockReturnThis(),
        setTitle: vitest_1.vi.fn().mockReturnThis(),
        setText: vitest_1.vi.fn().mockReturnThis(),
        setType: vitest_1.vi.fn().mockReturnThis(),
        setResource: vitest_1.vi.fn().mockReturnThis(),
        viaAll: vitest_1.vi.fn().mockReturnThis(),
        send: mockSend,
    };
    return {
        default: vitest_1.vi.fn().mockImplementation(() => mockBuilder),
    };
});
// Mock Redis to prevent connection issues
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        mget: vitest_1.vi.fn().mockResolvedValue([]),
        on: vitest_1.vi.fn(),
    },
}));
// ── Test helpers ─────────────────────────────────────────────────────────────
let mongod;
/** Create a verified user and return its document and a valid JWT. */
function createAuthUser() {
    return __awaiter(this, arguments, void 0, function* (role = user_1.USER_ROLES.BROTHER) {
        const user = yield user_model_1.User.create({
            name: `Test ${role}`,
            role,
            email: `test-${role}-${Date.now()}@example.com`,
            password: 'password123',
            isVerified: true,
            status: 'ACTIVE',
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
            tokenVersion: 0,
        });
        const token = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, config_1.default.jwt.jwt_secret, '1h');
        return { user, token };
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    mongod = yield mongodb_memory_server_1.MongoMemoryServer.create();
    yield mongoose_1.default.connect(mongod.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield mongod.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield ask_question_model_1.default.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('AskQuestion E2E Tests', () => {
    (0, vitest_1.describe)('POST /api/v1/ask-question', () => {
        (0, vitest_1.it)('successfully submits a question', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser();
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/ask-question')
                .set('Authorization', `Bearer ${token}`)
                .field('question', 'How to write E2E tests?');
            console.log('POST /api/v1/ask-question Response:', JSON.stringify(response.body, null, 2));
            (0, vitest_1.expect)(response.status).toBe(201);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.question).toBe('How to write E2E tests?');
        }));
        (0, vitest_1.it)('returns 401 when no token is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/ask-question')
                .field('question', 'Unauthorized?');
            (0, vitest_1.expect)(response.status).toBe(401);
            (0, vitest_1.expect)(response.body.success).toBe(false);
        }));
    });
    (0, vitest_1.describe)('GET /api/v1/ask-question/my-questions', () => {
        (0, vitest_1.it)('returns my questions', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, token } = yield createAuthUser();
            yield ask_question_model_1.default.create({
                userId: user._id,
                userRole: user.role,
                question: 'My test question',
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/ask-question/my-questions')
                .set('Authorization', `Bearer ${token}`);
            console.log('GET /api/v1/ask-question/my-questions Response:', JSON.stringify(response.body, null, 2));
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.data).toHaveLength(1);
            (0, vitest_1.expect)(response.body.data[0].question).toBe('My test question');
        }));
    });
    (0, vitest_1.describe)('GET /api/v1/ask-question (Admin Only)', () => {
        (0, vitest_1.it)('returns all questions for admin', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const userB = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            yield ask_question_model_1.default.create({
                userId: userB.user._id,
                userRole: userB.user.role,
                question: 'Question from User B',
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/ask-question')
                .set('Authorization', `Bearer ${token}`);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.data).toHaveLength(1);
            (0, vitest_1.expect)(response.body.data[0].question).toBe('Question from User B');
        }));
        (0, vitest_1.it)('returns 403 for non-admin user', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/ask-question')
                .set('Authorization', `Bearer ${token}`);
            (0, vitest_1.expect)(response.status).toBe(403);
        }));
    });
    (0, vitest_1.describe)('PATCH /api/v1/ask-question/:questionId/answer (Admin Only)', () => {
        (0, vitest_1.it)('successfully answers a question', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const userB = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            const question = yield ask_question_model_1.default.create({
                userId: userB.user._id,
                userRole: userB.user.role,
                question: 'Please answer this',
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/ask-question/${question._id}/answer`)
                .set('Authorization', `Bearer ${token}`)
                .send({ answer: 'This is the answer from E2E test' });
            console.log('PATCH /api/v1/ask-question/:questionId/answer Response:', JSON.stringify(response.body, null, 2));
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.data.status).toBe('answered');
            (0, vitest_1.expect)(response.body.data.answers[0].text).toBe('This is the answer from E2E test');
        }));
    });
});
