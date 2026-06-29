"use strict";
/**
 * E2E tests for Message module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks pushNotificationHelper (Firebase), Redis, and global Socket.io.
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
const crypto_1 = require("crypto");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../../user/user.model");
const chat_model_1 = require("../../chat/chat.model");
const message_model_1 = require("../message.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
const socketManager_1 = require("../../../../helpers/socketManager");
const socketHelper_1 = require("../../../../helpers/socketHelper");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../notification/pushNotificationHelper', () => ({
    pushNotificationHelper: {
        sendPushNotifications: vitest_1.vi.fn().mockResolvedValue(undefined),
        sendPushNotification: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        mget: vitest_1.vi.fn().mockResolvedValue([]),
        sadd: vitest_1.vi.fn().mockResolvedValue(1),
        srem: vitest_1.vi.fn().mockResolvedValue(1),
        sismember: vitest_1.vi.fn().mockResolvedValue(1),
        smembers: vitest_1.vi.fn().mockResolvedValue([]),
        incr: vitest_1.vi.fn().mockResolvedValue(1),
        decr: vitest_1.vi.fn().mockResolvedValue(0),
        on: vitest_1.vi.fn(),
    },
}));
// ── Test helpers ─────────────────────────────────────────────────────────────
let replSet;
/** Create a verified user and return its document and a valid JWT. */
function createAuthUser() {
    return __awaiter(this, arguments, void 0, function* (role = user_1.USER_ROLES.USER, nameSuffix = 'user') {
        const user = yield user_model_1.User.create({
            name: `Test ${role} ${nameSuffix}`,
            role,
            email: `${(0, crypto_1.randomUUID)()}@test.com`,
            password: 'password123',
            isVerified: true,
            status: user_1.USER_STATUS.ACTIVE,
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
function setupChat() {
    return __awaiter(this, void 0, void 0, function* () {
        const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.USER, 'userA');
        const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.USER, 'userB');
        const chat = yield chat_model_1.Chat.create({
            participants: [userA._id, userB._id]
        });
        return { userA, tokenA, userB, tokenB, chatId: chat._id.toString() };
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
    yield message_model_1.Message.deleteMany({});
    yield chat_model_1.Chat.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
    // Mock global io
    const mockIo = {
        to: vitest_1.vi.fn().mockReturnThis(),
        emit: vitest_1.vi.fn(),
    };
    global.io = mockIo;
    // Initialize SocketManager with the mock
    socketManager_1.SocketManager.init(mockIo);
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Message E2E Tests', () => {
    (0, vitest_1.describe)('Full User Flow: Chat List -> Open Chat -> Send Message -> View History', () => {
        (0, vitest_1.it)('simulates a complete real-world user interaction flow', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Setup: User A and User B
            const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.USER, 'userA');
            const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.USER, 'userB');
            // 2. User A initiates a chat with User B
            const createChatRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/chats/${userB._id}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(createChatRes.status).toBe(201);
            const chatId = createChatRes.body.data.id;
            (0, vitest_1.expect)(chatId).toBeDefined();
            (0, testLogger_1.logApi)('POST', `/api/v1/chats/${userB._id}`, { params: { otherUserId: userB._id.toString() } }, createChatRes.body, 'FLOW-1-CREATE-CHAT', 'User A initiates chat with User B');
            // 3. User A views their chat list
            const chatListRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(chatListRes.status).toBe(200);
            (0, vitest_1.expect)(chatListRes.body.data).toHaveLength(1);
            (0, vitest_1.expect)(chatListRes.body.data[0].id).toBe(chatId);
            (0, vitest_1.expect)(chatListRes.body.data[0].participants[0].id).toBe(userB._id.toString());
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW-2-CHAT-LIST', 'User A views their chat list');
            // 4. User A opens the chat and retrieves message history (initially empty)
            const historyRes1 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(historyRes1.status).toBe(200);
            (0, vitest_1.expect)(historyRes1.body.data).toHaveLength(0);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { params: { chatId } }, historyRes1.body, 'FLOW-3-OPEN-CHAT-EMPTY', 'User A opens the chat and sees no messages');
            // 5. User A sends a text message
            const textBody = {
                chatId,
                text: 'Hi there! This is my first message.',
            };
            const sendTextRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send(textBody);
            (0, vitest_1.expect)(sendTextRes.status).toBe(201);
            (0, vitest_1.expect)(sendTextRes.body.data.text).toBe(textBody.text);
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { body: textBody }, sendTextRes.body, 'FLOW-4-SEND-TEXT', 'User A sends a text message');
            (0, testLogger_1.logSocket)('EMIT', 'MESSAGE_SENT', { message: sendTextRes.body.data }, 'FLOW-4-SOCKET', 'Server emits new message to the chat room');
            // 6. User A sends a message with an image attachment
            const fileBuffer = Buffer.from('fake image content');
            const sendAttachmentRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .field('chatId', chatId)
                .field('text', 'Check out this attachment!')
                .attach('image', fileBuffer, 'test-image.jpg');
            (0, vitest_1.expect)(sendAttachmentRes.status).toBe(201);
            (0, vitest_1.expect)(sendAttachmentRes.body.data.type).toBe('mixed');
            (0, vitest_1.expect)(sendAttachmentRes.body.data.attachments).toHaveLength(1);
            (0, vitest_1.expect)(sendAttachmentRes.body.data.attachments[0].type).toBe('image');
            (0, testLogger_1.logApi)('POST', '/api/v1/messages (multipart)', {
                body: { chatId, text: 'Check out this attachment!', image: 'test-image.jpg' }
            }, sendAttachmentRes.body, 'FLOW-5-SEND-ATTACHMENT', 'User A sends a message with an image');
            (0, testLogger_1.logSocket)('EMIT', 'MESSAGE_SENT', { message: sendAttachmentRes.body.data }, 'FLOW-5-SOCKET', 'Server emits attachment message to the chat room');
            // 7. User B views their chat list and sees the last message
            const chatListResB = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/chats')
                .set('Authorization', `Bearer ${tokenB}`);
            (0, vitest_1.expect)(chatListResB.status).toBe(200);
            (0, vitest_1.expect)(chatListResB.body.data[0].lastMessage.text).toBe('Check out this attachment!');
            // expect(chatListResB.body.data[0].unreadCount).toBe(2); // Depending on Redis mock behavior
            (0, testLogger_1.logApi)('GET', '/api/v1/chats', {}, chatListResB.body, 'FLOW-6-CHAT-LIST-B', 'User B sees the updated chat list with last message');
            // 8. User B marks all messages as read
            const markReadRes = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, vitest_1.expect)(markReadRes.status).toBe(200);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, { params: { chatId } }, markReadRes.body, 'FLOW-7-MARK-READ', 'User B marks messages as read');
            // 9. User A retrieves message history again and sees both messages
            const historyRes2 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, vitest_1.expect)(historyRes2.status).toBe(200);
            (0, vitest_1.expect)(historyRes2.body.data).toHaveLength(2);
            (0, vitest_1.expect)(historyRes2.body.data[0].text).toBe('Hi there! This is my first message.');
            (0, vitest_1.expect)(historyRes2.body.data[1].text).toBe('Check out this attachment!');
            (0, vitest_1.expect)(historyRes2.body.data[1].attachments).toHaveLength(1);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { params: { chatId } }, historyRes2.body, 'FLOW-8-FINAL-HISTORY', 'User A views full history with 2 messages');
        }));
    });
    (0, vitest_1.describe)('POST /api/v1/messages (Send Message)', () => {
        (0, vitest_1.it)('successfully sends a text message and updates chat lastMessage', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const { tokenA, chatId, userB } = yield setupChat();
            const body = {
                chatId,
                text: 'Hello, this is a test message',
            };
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send(body);
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { body }, res.body, 'SEND-MESSAGE-SUCCESS', 'User A sends a text message to User B in their chat');
            (0, vitest_1.expect)(res.status).toBe(201);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.text).toBe(body.text);
            (0, vitest_1.expect)(res.body.data.chatId).toBe(chatId);
            // Verify chat lastMessage update
            const updatedChat = yield chat_model_1.Chat.findById(chatId);
            (0, vitest_1.expect)((_a = updatedChat === null || updatedChat === void 0 ? void 0 : updatedChat.lastMessage) === null || _a === void 0 ? void 0 : _a.text).toBe(body.text);
            // Verify Socket.io emission
            (0, vitest_1.expect)(global.io.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(global.io.emit).toHaveBeenCalledWith('MESSAGE_SENT', vitest_1.expect.any(Object));
        }));
    });
    (0, vitest_1.describe)('GET /api/v1/messages/chat/:chatId (Message History)', () => {
        (0, vitest_1.it)('retrieves message history with correct authorization', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenA, chatId, userA } = yield setupChat();
            // Create some messages
            yield message_model_1.Message.create([
                { chatId, sender: userA._id, text: 'Msg 1', type: 'text' },
                { chatId, sender: userA._id, text: 'Msg 2', type: 'text' },
            ]);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/messages/chat/${chatId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/messages/chat/${chatId}`, { params: { chatId } }, res.body, 'GET-HISTORY-SUCCESS', 'Participant retrieves the message history for their chat');
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.length).toBe(2);
            (0, vitest_1.expect)(res.body.data[0].text).toBe('Msg 1');
        }));
    });
    (0, vitest_1.describe)('POST /api/v1/messages/chat/:chatId/read (Mark Read)', () => {
        (0, vitest_1.it)('marks messages as read by the participant', () => __awaiter(void 0, void 0, void 0, function* () {
            const { tokenB, chatId, userA, userB } = yield setupChat();
            // Create a message from userA
            const msg = yield message_model_1.Message.create({
                chatId,
                sender: userA._id,
                text: 'Unread message',
                type: 'text',
            });
            const res = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/messages/chat/${chatId}/read`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/messages/chat/${chatId}/read`, { params: { chatId } }, res.body, 'MARK-READ-SUCCESS', 'User marks all messages in a chat as read');
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Verify in DB
            const updatedMsg = yield message_model_1.Message.findById(msg._id);
            (0, vitest_1.expect)(updatedMsg === null || updatedMsg === void 0 ? void 0 : updatedMsg.readBy.map(id => id.toString())).toContain(userB._id.toString());
        }));
    });
    (0, vitest_1.describe)('Real-time Full Interaction: Typing -> Send -> Read', () => {
        (0, vitest_1.it)('simulates a real-time conversation flow between two users', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Setup: User A and User B
            const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.USER, 'userA');
            const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.USER, 'userB');
            const chat = yield chat_model_1.Chat.create({ participants: [userA._id, userB._id] });
            const chatId = chat._id.toString();
            // 2. Setup Mock Sockets for both users
            const handlersA = {};
            const handlersB = {};
            const createMockSocket = (userId, token, handlers) => ({
                id: `socket-id-${userId}`,
                handshake: { auth: { token } },
                join: vitest_1.vi.fn(),
                on: vitest_1.vi.fn((event, handler) => { handlers[event] = handler; }),
                emit: vitest_1.vi.fn(),
                to: vitest_1.vi.fn().mockReturnThis(),
                disconnect: vitest_1.vi.fn(),
            });
            const mockSocketA = createMockSocket(userA._id.toString(), tokenA, handlersA);
            const mockSocketB = createMockSocket(userB._id.toString(), tokenB, handlersB);
            // 3. Initialize SocketHelper with both sockets
            const mockIo = {
                on: vitest_1.vi.fn((event, connectionHandler) => __awaiter(void 0, void 0, void 0, function* () {
                    if (event === 'connection') {
                        yield connectionHandler(mockSocketA);
                        yield connectionHandler(mockSocketB);
                    }
                })),
                to: vitest_1.vi.fn().mockReturnThis(),
                emit: vitest_1.vi.fn(),
            };
            socketHelper_1.socketHelper.socket(mockIo);
            socketManager_1.SocketManager.init(mockIo); // Update SocketManager to use this test's mockIo
            yield new Promise(resolve => setTimeout(resolve, 20)); // Wait for handlers to register
            // --- STEP 1: User B starts typing ---
            (0, testLogger_1.logSocket)('RECEIVE', 'TYPING_START', { chatId }, 'STEP-1-IN', 'User B starts typing');
            yield handlersB['TYPING_START']({ chatId });
            // Server should broadcast to User A
            (0, testLogger_1.logSocket)('EMIT', 'TYPING_START', { userId: userB._id.toString(), chatId }, 'STEP-1-OUT', 'Server notifies User A that User B is typing');
            (0, vitest_1.expect)(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(mockIo.emit).toHaveBeenCalledWith('TYPING_START', vitest_1.expect.objectContaining({
                userId: userB._id.toString(),
                chatId
            }));
            vitest_1.vi.clearAllMocks(); // Clear mocks after Step 1 to make Step 2 expectations cleaner
            // --- STEP 2: User A sends a message (HTTP) ---
            const messageBody = { chatId, text: 'Real-time test message' };
            (0, testLogger_1.logApi)('POST', '/api/v1/messages', { body: messageBody }, {}, 'STEP-2-HTTP', 'User A sends a message');
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/messages')
                .set('Authorization', `Bearer ${tokenA}`)
                .send(messageBody);
            (0, vitest_1.expect)(res.status).toBe(201);
            const messageId = res.body.data.id;
            // Server should emit MESSAGE_SENT to User B
            // MessageService emits { message: populatedMessage }
            (0, testLogger_1.logSocket)('EMIT', 'MESSAGE_SENT', { message: res.body.data }, 'STEP-2-OUT', 'Server sends the new message to User B via socket');
            (0, vitest_1.expect)(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(mockIo.emit).toHaveBeenCalledWith('MESSAGE_SENT', vitest_1.expect.objectContaining({
                message: vitest_1.expect.objectContaining({
                    text: 'Real-time test message'
                })
            }));
            vitest_1.vi.clearAllMocks(); // Clear again for Step 3
            // --- STEP 3: User B sends Read Acknowledgment (Socket) ---
            const readPayload = { messageId };
            (0, testLogger_1.logSocket)('RECEIVE', 'READ_ACK', readPayload, 'STEP-3-IN', 'User B acknowledges reading the message');
            yield handlersB['READ_ACK'](readPayload);
            // Verify DB update
            const updatedMsg = yield message_model_1.Message.findById(messageId);
            (0, vitest_1.expect)(updatedMsg === null || updatedMsg === void 0 ? void 0 : updatedMsg.readBy.map(id => id.toString())).toContain(userB._id.toString());
            // Server should broadcast MESSAGES_READ to User A
            const readBroadcast = { chatId, userId: userB._id.toString(), updatedIds: [messageId] };
            (0, testLogger_1.logSocket)('EMIT', 'MESSAGES_READ', readBroadcast, 'STEP-3-OUT', 'Server notifies User A that User B read the message');
            (0, vitest_1.expect)(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(mockIo.emit).toHaveBeenCalledWith('MESSAGES_READ', vitest_1.expect.objectContaining(readBroadcast));
        }));
    });
    (0, vitest_1.describe)('Real-time Socket Logic (Client -> Server Events)', () => {
        (0, vitest_1.it)('verifies that a client-side READ_ACK socket event correctly updates DB and broadcasts to the chat', () => __awaiter(void 0, void 0, void 0, function* () {
            const { userB, tokenB, chatId, userA } = yield setupChat();
            // 1. Create an unread message from User A
            const msg = yield message_model_1.Message.create({
                chatId,
                sender: userA._id,
                text: 'Socket test message',
                type: 'text',
            });
            // 2. Setup mock socket environment to capture handlers registered by socketHelper
            const handlers = {};
            const mockSocket = {
                id: 'socket-user-b',
                handshake: { auth: { token: tokenB } },
                join: vitest_1.vi.fn(),
                on: vitest_1.vi.fn((event, handler) => {
                    handlers[event] = handler;
                }),
                emit: vitest_1.vi.fn(),
                disconnect: vitest_1.vi.fn(),
            };
            // 3. Initialize the actual socketHelper with a mock IO server
            const mockIo = {
                on: vitest_1.vi.fn((event, connectionHandler) => __awaiter(void 0, void 0, void 0, function* () {
                    if (event === 'connection') {
                        yield connectionHandler(mockSocket);
                    }
                })),
                to: vitest_1.vi.fn().mockReturnThis(),
                emit: vitest_1.vi.fn(),
            };
            // This registers the real handlers (JOIN_CHAT, READ_ACK, etc.) on our mockSocket
            socketHelper_1.socketHelper.socket(mockIo);
            // Give it a small tick to ensure all async registrations are done
            yield new Promise(resolve => setTimeout(resolve, 10));
            // 4. Simulate User B sending a READ_ACK event via Socket.IO
            const socketPayload = { messageId: msg._id.toString() };
            (0, testLogger_1.logSocket)('RECEIVE', 'READ_ACK', socketPayload, 'SOCKET-IN', 'User B sends read acknowledgment via Socket');
            yield handlers['READ_ACK'](socketPayload);
            // 5. Verify Database Update
            const updatedMsg = yield message_model_1.Message.findById(msg._id);
            (0, vitest_1.expect)(updatedMsg === null || updatedMsg === void 0 ? void 0 : updatedMsg.readBy.map(id => id.toString())).toContain(userB._id.toString());
            // 6. Verify Real-time Broadcast (MESSAGES_READ should be sent to the chat room)
            const broadcastPayload = {
                chatId,
                userId: userB._id.toString(),
                updatedIds: [msg._id.toString()]
            };
            (0, testLogger_1.logSocket)('EMIT', 'MESSAGES_READ', broadcastPayload, 'SOCKET-OUT', 'Server broadcasts read status to the chat room');
            (0, vitest_1.expect)(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
            (0, vitest_1.expect)(mockIo.emit).toHaveBeenCalledWith('MESSAGES_READ', vitest_1.expect.objectContaining(broadcastPayload));
        }));
    });
});
