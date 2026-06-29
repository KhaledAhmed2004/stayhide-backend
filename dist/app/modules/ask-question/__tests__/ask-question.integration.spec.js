"use strict";
/**
 * Integration tests for AskQuestionService
 *
 * Uses mongodb-memory-server for real MongoDB.
 * Mocks NotificationBuilder to avoid sending real notifications.
 */
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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
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
// ── Imports (after mocks) ────────────────────────────────────────────────────
const ask_question_service_1 = require("../ask-question.service");
const ask_question_model_1 = __importDefault(require("../ask-question.model"));
const user_model_1 = require("../../user/user.model");
// ── Test helpers ─────────────────────────────────────────────────────────────
let mongod;
/** Create a minimal User document with required fields. */
function createUser(suffix) {
    return __awaiter(this, void 0, void 0, function* () {
        const tag = suffix !== null && suffix !== void 0 ? suffix : `${Date.now()}-${Math.random()}`;
        return user_model_1.User.create({
            name: `Test User ${tag}`,
            role: 'BROTHER',
            email: `test-${tag}@example.com`,
            password: 'password123',
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
        });
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
(0, vitest_1.describe)('AskQuestionService', () => {
    (0, vitest_1.describe)('submitQuestionIntoDB', () => {
        (0, vitest_1.it)('successfully creates a new question', () => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield createUser('submit');
            const payload = {
                userId: user._id,
                userRole: user.role,
                question: 'What is the best way to learn integration testing?',
            };
            const result = yield ask_question_service_1.AskQuestionService.submitQuestionIntoDB(payload);
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.question).toBe(payload.question);
            (0, vitest_1.expect)(result.userId.toString()).toBe(user._id.toString());
            (0, vitest_1.expect)(result.status).toBe('pending');
            (0, vitest_1.expect)(result.answers).toHaveLength(0);
        }));
    });
    (0, vitest_1.describe)('getMyQuestionsFromDB', () => {
        (0, vitest_1.it)('returns only questions belonging to the specified user', () => __awaiter(void 0, void 0, void 0, function* () {
            const userA = yield createUser('a');
            const userB = yield createUser('b');
            yield ask_question_model_1.default.create({
                userId: userA._id,
                userRole: userA.role,
                question: 'Question from User A',
            });
            yield ask_question_model_1.default.create({
                userId: userB._id,
                userRole: userB.role,
                question: 'Question from User B',
            });
            const result = yield ask_question_service_1.AskQuestionService.getMyQuestionsFromDB(userA._id.toString(), {});
            (0, vitest_1.expect)(result.data).toHaveLength(1);
            (0, vitest_1.expect)(result.data[0].question).toBe('Question from User A');
            (0, vitest_1.expect)(result.pagination.total).toBe(1);
        }));
    });
    (0, vitest_1.describe)('getAllQuestionsFromDB', () => {
        (0, vitest_1.it)('returns all questions with user info populated', () => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield createUser('all');
            yield ask_question_model_1.default.create({
                userId: user._id,
                userRole: user.role,
                question: 'Global question?',
            });
            const result = yield ask_question_service_1.AskQuestionService.getAllQuestionsFromDB({});
            (0, vitest_1.expect)(result.data).toHaveLength(1);
            (0, vitest_1.expect)(result.data[0].question).toBe('Global question?');
            (0, vitest_1.expect)(result.data[0].userId).toBeDefined();
            // Verify population (userId should have name and email)
            const populatedUser = result.data[0].userId;
            (0, vitest_1.expect)(populatedUser.name).toBe(user.name);
            (0, vitest_1.expect)(populatedUser.email).toBe(user.email);
        }));
    });
    (0, vitest_1.describe)('getQuestionMetricsFromDB', () => {
        (0, vitest_1.it)('returns metrics with correct structure', () => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield createUser('metrics');
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            // Create some questions in different periods
            yield ask_question_model_1.default.create({
                userId: user._id,
                userRole: user.role,
                question: 'Current month pending',
                status: 'pending',
                createdAt: now,
            });
            yield ask_question_model_1.default.create({
                userId: user._id,
                userRole: user.role,
                question: 'Current month answered',
                status: 'answered',
                createdAt: now,
            });
            yield ask_question_model_1.default.create({
                userId: user._id,
                userRole: user.role,
                question: 'Last month answered',
                status: 'answered',
                createdAt: lastMonth,
            });
            const result = yield ask_question_service_1.AskQuestionService.getQuestionMetricsFromDB();
            (0, vitest_1.expect)(result).toHaveProperty('totalQuestions');
            (0, vitest_1.expect)(result).toHaveProperty('answeredQuestions');
            (0, vitest_1.expect)(result).toHaveProperty('pendingQuestions');
            (0, vitest_1.expect)(result.totalQuestions.value).toBe(3);
            (0, vitest_1.expect)(result.answeredQuestions.value).toBe(2);
            (0, vitest_1.expect)(result.pendingQuestions.value).toBe(1);
        }));
    });
    (0, vitest_1.describe)('answerQuestionInDB', () => {
        (0, vitest_1.it)('successfully answers a pending question and sends notification', () => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield createUser('answer');
            const question = yield ask_question_model_1.default.create({
                userId: user._id,
                userRole: user.role,
                question: 'Pending question?',
            });
            const answerText = 'This is the answer.';
            const result = yield ask_question_service_1.AskQuestionService.answerQuestionInDB(question._id.toString(), answerText);
            (0, vitest_1.expect)(result.status).toBe('answered');
            (0, vitest_1.expect)(result.answers).toHaveLength(1);
            (0, vitest_1.expect)(result.answers[0].text).toBe(answerText);
            (0, vitest_1.expect)(result.answers[0].version).toBe(1);
            (0, vitest_1.expect)(result.answers[0].isActive).toBe(true);
            // Verify notification was sent
            const NotificationBuilder = (yield Promise.resolve().then(() => __importStar(require('../../../builder/NotificationBuilder/NotificationBuilder')))).default;
            (0, vitest_1.expect)(NotificationBuilder).toHaveBeenCalled();
        }));
        (0, vitest_1.it)('adds a new version and deactivates old answer when re-answering', () => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield createUser('re-answer');
            const question = yield ask_question_model_1.default.create({
                userId: user._id,
                userRole: user.role,
                question: 'Original question?',
                status: 'answered',
                answers: [
                    {
                        version: 1,
                        text: 'First answer',
                        isActive: true,
                        createdAt: new Date(),
                    },
                ],
            });
            const newAnswerText = 'Second improved answer.';
            const result = yield ask_question_service_1.AskQuestionService.answerQuestionInDB(question._id.toString(), newAnswerText);
            (0, vitest_1.expect)(result.answers).toHaveLength(2);
            (0, vitest_1.expect)(result.answers[0].isActive).toBe(false);
            (0, vitest_1.expect)(result.answers[1].isActive).toBe(true);
            (0, vitest_1.expect)(result.answers[1].text).toBe(newAnswerText);
            (0, vitest_1.expect)(result.answers[1].version).toBe(2);
            // Verify NO notification was sent for re-answer
            const NotificationBuilder = (yield Promise.resolve().then(() => __importStar(require('../../../builder/NotificationBuilder/NotificationBuilder')))).default;
            vitest_1.vi.clearAllMocks(); // Clear call from setup if any
            yield ask_question_service_1.AskQuestionService.answerQuestionInDB(question._id.toString(), 'Third answer');
            (0, vitest_1.expect)(NotificationBuilder).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)('throws 404 when question does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeId = new mongoose_1.default.Types.ObjectId().toString();
            yield (0, vitest_1.expect)(ask_question_service_1.AskQuestionService.answerQuestionInDB(fakeId, 'Some answer')).rejects.toMatchObject({
                statusCode: 404,
                message: 'Question not found',
            });
        }));
        (0, vitest_1.it)('throws 400 when question ID is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, vitest_1.expect)(ask_question_service_1.AskQuestionService.answerQuestionInDB('invalid-id', 'Some answer')).rejects.toMatchObject({
                statusCode: 400,
            });
        }));
    });
});
