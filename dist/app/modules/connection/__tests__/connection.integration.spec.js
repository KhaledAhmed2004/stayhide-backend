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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../notification/notificationsHelper', () => ({
    sendNotifications: vitest_1.vi.fn().mockResolvedValue(true),
}));
vitest_1.vi.mock('../../chat/chat.service', () => ({
    ChatService: {
        createOrGet: vitest_1.vi.fn().mockResolvedValue({ _id: new mongoose_1.default.Types.ObjectId() }),
    },
}));
vitest_1.vi.mock('../../../../config', () => ({
    default: {
        connection: {
            max_pending_requests: 3,
        },
    },
}));
// ── Imports (after mocks) ────────────────────────────────────────────────────
const connection_service_1 = require("../connection.service");
const connection_model_1 = require("../connection.model");
const user_model_1 = require("../../user/user.model");
const connection_constants_1 = require("../connection.constants");
const user_1 = require("../../../../enums/user");
// ── Test helpers ─────────────────────────────────────────────────────────────
let replSet;
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
            status: user_1.USER_STATUS.ACTIVE,
        });
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield connection_model_1.Connection.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
    // Mock global io
    global.io = {
        to: vitest_1.vi.fn().mockReturnThis(),
        emit: vitest_1.vi.fn(),
    };
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('ConnectionService Integration', () => {
    (0, vitest_1.describe)('sendConnectionRequest', () => {
        (0, vitest_1.it)('successfully sends a connection request and emits socket event', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('sender');
            const receiver = yield createUser('receiver');
            const result = yield connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString());
            console.log('--- sendConnectionRequest Response ---\n', JSON.stringify(result, null, 2));
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.status).toBe(connection_constants_1.CONNECTION_STATUS.PENDING);
            (0, vitest_1.expect)(result.receiver.id.toString()).toBe(receiver._id.toString());
            (0, vitest_1.expect)(result.id).toBeDefined();
            const { sendNotifications } = yield Promise.resolve().then(() => __importStar(require('../../notification/notificationsHelper')));
            (0, vitest_1.expect)(sendNotifications).toHaveBeenCalled();
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`user::${receiver._id}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('CONNECTION_REQUEST', vitest_1.expect.any(Object));
        }));
        (0, vitest_1.it)('throws 400 when trying to connect with yourself', () => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield createUser('self');
            yield (0, vitest_1.expect)(connection_service_1.ConnectionService.sendConnectionRequest(user._id.toString(), user._id.toString())).rejects.toMatchObject({
                statusCode: 400,
                message: 'You cannot connect with yourself',
            });
        }));
        (0, vitest_1.it)('throws 429 when max pending requests limit is reached', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('spammer');
            // We mocked config.connection.max_pending_requests = 3
            // Create 3 pending requests for this user
            for (let i = 0; i < 3; i++) {
                const tempReceiver = yield createUser(`temp-${i}`);
                yield connection_model_1.Connection.create({
                    sender: sender._id,
                    receiver: tempReceiver._id,
                    connectionKey: `${sender._id}_${tempReceiver._id}`, // Fake key for speed
                    status: connection_constants_1.CONNECTION_STATUS.PENDING,
                });
            }
            const receiver = yield createUser('receiver-4');
            yield (0, vitest_1.expect)(connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString())).rejects.toMatchObject({
                statusCode: 429,
                message: vitest_1.expect.stringContaining('reached the maximum number of pending requests'),
            });
        }));
        (0, vitest_1.it)('throws 409 if a connection request already exists between them', () => __awaiter(void 0, void 0, void 0, function* () {
            const userA = yield createUser('A');
            const userB = yield createUser('B');
            // Send first request
            yield connection_service_1.ConnectionService.sendConnectionRequest(userA._id.toString(), userB._id.toString());
            // Attempt second request in the SAME direction
            yield (0, vitest_1.expect)(connection_service_1.ConnectionService.sendConnectionRequest(userA._id.toString(), userB._id.toString())).rejects.toMatchObject({
                statusCode: 409,
                message: 'Connection request already exists',
            });
            // Attempt request in the REVERSE direction (race condition test)
            yield (0, vitest_1.expect)(connection_service_1.ConnectionService.sendConnectionRequest(userB._id.toString(), userA._id.toString())).rejects.toMatchObject({
                statusCode: 409,
                message: 'Connection request already exists',
            });
        }));
    });
    (0, vitest_1.describe)('respondToConnectionRequest', () => {
        (0, vitest_1.it)('accepts a request, creates a chat, and commits transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('sender');
            const receiver = yield createUser('receiver');
            const connection = yield connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString());
            vitest_1.vi.clearAllMocks(); // Clear io and notifications from send Request
            const accepted = yield connection_service_1.ConnectionService.respondToConnectionRequest(connection.id.toString(), receiver._id.toString(), connection_constants_1.CONNECTION_ACTION.ACCEPTED);
            console.log('--- respondToConnectionRequest (ACCEPT) Response ---\n', JSON.stringify(accepted, null, 2));
            (0, vitest_1.expect)(accepted).toBeDefined();
            (0, vitest_1.expect)(accepted === null || accepted === void 0 ? void 0 : accepted.status).toBe(connection_constants_1.CONNECTION_STATUS.ACCEPTED);
            (0, vitest_1.expect)(accepted === null || accepted === void 0 ? void 0 : accepted.chatId).toBeDefined();
            const { ChatService } = yield Promise.resolve().then(() => __importStar(require('../../chat/chat.service')));
            (0, vitest_1.expect)(ChatService.createOrGet).toHaveBeenCalledWith(sender._id.toString(), receiver._id.toString());
            // Verify socket and notification fired for sender
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`user::${sender._id}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('CONNECTION_ACCEPTED', vitest_1.expect.any(Object));
        }));
        (0, vitest_1.it)('rejects a request, deletes it, and commits transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('sender');
            const receiver = yield createUser('receiver');
            const connection = yield connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString());
            const rejected = yield connection_service_1.ConnectionService.respondToConnectionRequest(connection.id.toString(), receiver._id.toString(), connection_constants_1.CONNECTION_ACTION.REJECTED);
            console.log('--- respondToConnectionRequest (REJECT) Response ---\n', JSON.stringify(rejected, null, 2));
            (0, vitest_1.expect)(rejected).toEqual({ id: connection.id, status: 'NONE' });
            // Verify DB is clean
            const dbCheck = yield connection_model_1.Connection.findById(connection.id);
            (0, vitest_1.expect)(dbCheck).toBeNull();
        }));
        (0, vitest_1.it)('throws 403 if non-receiver tries to accept', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('sender');
            const receiver = yield createUser('receiver');
            const hacker = yield createUser('hacker');
            const connection = yield connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString());
            yield (0, vitest_1.expect)(connection_service_1.ConnectionService.respondToConnectionRequest(connection.id.toString(), hacker._id.toString(), connection_constants_1.CONNECTION_ACTION.ACCEPTED)).rejects.toMatchObject({
                statusCode: 403,
                message: 'Only the receiver can respond to this request',
            });
        }));
    });
    (0, vitest_1.describe)('cancelConnectionRequest', () => {
        (0, vitest_1.it)('successfully cancels a sent request', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('sender');
            const receiver = yield createUser('receiver');
            const connection = yield connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString());
            yield connection_service_1.ConnectionService.cancelConnectionRequest(connection.id.toString(), sender._id.toString());
            const dbCheck = yield connection_model_1.Connection.findById(connection.id);
            (0, vitest_1.expect)(dbCheck).toBeNull();
        }));
        (0, vitest_1.it)('throws 403 if someone else tries to cancel', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('sender');
            const receiver = yield createUser('receiver');
            const connection = yield connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString());
            yield (0, vitest_1.expect)(connection_service_1.ConnectionService.cancelConnectionRequest(connection.id.toString(), receiver._id.toString() // receiver cannot cancel it, only respond
            )).rejects.toMatchObject({
                statusCode: 403,
                message: 'Only the sender can cancel this request',
            });
        }));
    });
    (0, vitest_1.describe)('removeConnection', () => {
        (0, vitest_1.it)('successfully removes an accepted connection using transactions', () => __awaiter(void 0, void 0, void 0, function* () {
            const sender = yield createUser('sender');
            const receiver = yield createUser('receiver');
            const connection = yield connection_service_1.ConnectionService.sendConnectionRequest(sender._id.toString(), receiver._id.toString());
            yield connection_service_1.ConnectionService.respondToConnectionRequest(connection.id.toString(), receiver._id.toString(), connection_constants_1.CONNECTION_ACTION.ACCEPTED);
            yield connection_service_1.ConnectionService.removeConnection(connection.id.toString(), sender._id.toString() // sender removes it
            );
            const dbCheck = yield connection_model_1.Connection.findById(connection.id);
            (0, vitest_1.expect)(dbCheck).toBeNull();
        }));
    });
});
