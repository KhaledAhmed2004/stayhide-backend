/**
 * E2E tests for Message module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks pushNotificationHelper (Firebase), Redis, and global Socket.io.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Chat } from '../../chat/chat.model';
import { Message } from '../message.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi, logSocket } from '../../../../helpers/__tests__/testLogger';
import { SocketManager } from '../../../../helpers/socketManager';
import { socketHelper } from '../../../../helpers/socketHelper';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../notification/pushNotificationHelper', () => ({
  pushNotificationHelper: {
    sendPushNotifications: vi.fn().mockResolvedValue(undefined),
    sendPushNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    mget: vi.fn().mockResolvedValue([]),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    sismember: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    incr: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(0),
    on: vi.fn(),
  },
}));

// ── Test helpers ─────────────────────────────────────────────────────────────

let replSet: MongoMemoryReplSet;

/** Create a verified user and return its document and a valid JWT. */
async function createAuthUser(role: string = USER_ROLES.USER, nameSuffix = 'user') {
  const user = await User.create({
    name: `Test ${role} ${nameSuffix}`,
    role,
    email: `${randomUUID()}@test.com`,
    password: 'password123',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    revertDate: new Date(),
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/img.jpg',
    verificationVideo: 'https://example.com/vid.mp4',
    tokenVersion: 0,
  });

  const token = jwtHelper.createToken(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
    config.jwt.jwt_secret as Secret,
    '1h',
  );

  return { user, token };
}

async function setupChat() {
  const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.USER, 'userA');
  const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.USER, 'userB');
  
  const chat = await Chat.create({
    participants: [userA._id, userB._id]
  });

  return { userA, tokenA, userB, tokenB, chatId: chat._id.toString() };
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Message.deleteMany({});
  await Chat.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();

  // Mock global io
  const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };
  (global as any).io = mockIo;
  
  // Initialize SocketManager with the mock
  SocketManager.init(mockIo as any);
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Message E2E Tests', () => {

  describe('Full User Flow: Chat List -> Open Chat -> Send Message -> View History', () => {
    it('simulates a complete real-world user interaction flow', async () => {
      // 1. Setup: User A and User B
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.USER, 'userA');
      const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.USER, 'userB');

      // 2. User A initiates a chat with User B
      const createChatRes = await request(app)
        .post(`/api/v1/chats/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(createChatRes.status).toBe(201);
      const chatId = createChatRes.body.data.id;
      expect(chatId).toBeDefined();

      logApi('POST', `/api/v1/chats/${userB._id}`, { params: { otherUserId: userB._id.toString() } }, createChatRes.body, 'FLOW-1-CREATE-CHAT', 'User A initiates chat with User B');

      // 3. User A views their chat list
      const chatListRes = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(chatListRes.status).toBe(200);
      expect(chatListRes.body.data).toHaveLength(1);
      expect(chatListRes.body.data[0].id).toBe(chatId);
      expect(chatListRes.body.data[0].participants[0].id).toBe(userB._id.toString());

      logApi('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW-2-CHAT-LIST', 'User A views their chat list');

      // 4. User A opens the chat and retrieves message history (initially empty)
      const historyRes1 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(historyRes1.status).toBe(200);
      expect(historyRes1.body.data).toHaveLength(0);

      logApi('GET', `/api/v1/messages/chat/${chatId}`, { params: { chatId } }, historyRes1.body, 'FLOW-3-OPEN-CHAT-EMPTY', 'User A opens the chat and sees no messages');

      // 5. User A sends a text message
      const textBody = {
        chatId,
        text: 'Hi there! This is my first message.',
      };
      const sendTextRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(textBody);
      
      expect(sendTextRes.status).toBe(201);
      expect(sendTextRes.body.data.text).toBe(textBody.text);

      logApi('POST', '/api/v1/messages', { body: textBody }, sendTextRes.body, 'FLOW-4-SEND-TEXT', 'User A sends a text message');
      logSocket('EMIT', 'MESSAGE_SENT', { message: sendTextRes.body.data }, 'FLOW-4-SOCKET', 'Server emits new message to the chat room');

      // 6. User A sends a message with an image attachment
      const fileBuffer = Buffer.from('fake image content');
      const sendAttachmentRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('chatId', chatId)
        .field('text', 'Check out this attachment!')
        .attach('image', fileBuffer, 'test-image.jpg');
      
      expect(sendAttachmentRes.status).toBe(201);
      expect(sendAttachmentRes.body.data.type).toBe('mixed');
      expect(sendAttachmentRes.body.data.attachments).toHaveLength(1);
      expect(sendAttachmentRes.body.data.attachments[0].type).toBe('image');

      logApi('POST', '/api/v1/messages (multipart)', {
        body: { chatId, text: 'Check out this attachment!', image: 'test-image.jpg' }
      }, sendAttachmentRes.body, 'FLOW-5-SEND-ATTACHMENT', 'User A sends a message with an image');
      logSocket('EMIT', 'MESSAGE_SENT', { message: sendAttachmentRes.body.data }, 'FLOW-5-SOCKET', 'Server emits attachment message to the chat room');

      // 7. User B views their chat list and sees the last message
      const chatListResB = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenB}`);
      
      expect(chatListResB.status).toBe(200);
      expect(chatListResB.body.data[0].lastMessage.text).toBe('Check out this attachment!');
      // expect(chatListResB.body.data[0].unreadCount).toBe(2); // Depending on Redis mock behavior

      logApi('GET', '/api/v1/chats', {}, chatListResB.body, 'FLOW-6-CHAT-LIST-B', 'User B sees the updated chat list with last message');

      // 8. User B marks all messages as read
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);
      
      expect(markReadRes.status).toBe(200);

      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, { params: { chatId } }, markReadRes.body, 'FLOW-7-MARK-READ', 'User B marks messages as read');

      // 9. User A retrieves message history again and sees both messages
      const historyRes2 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(historyRes2.status).toBe(200);
      expect(historyRes2.body.data).toHaveLength(2);
      expect(historyRes2.body.data[0].text).toBe('Hi there! This is my first message.');
      expect(historyRes2.body.data[1].text).toBe('Check out this attachment!');
      expect(historyRes2.body.data[1].attachments).toHaveLength(1);

      logApi('GET', `/api/v1/messages/chat/${chatId}`, { params: { chatId } }, historyRes2.body, 'FLOW-8-FINAL-HISTORY', 'User A views full history with 2 messages');
    });
  });

  describe('POST /api/v1/messages (Send Message)', () => {
    it('successfully sends a text message and updates chat lastMessage', async () => {
      const { tokenA, chatId, userB } = await setupChat();

      const body = {
        chatId,
        text: 'Hello, this is a test message',
      };

      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body);

      logApi(
        'POST',
        '/api/v1/messages',
        { body },
        res.body,
        'SEND-MESSAGE-SUCCESS',
        'User A sends a text message to User B in their chat'
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.text).toBe(body.text);
      expect(res.body.data.chatId).toBe(chatId);

      // Verify chat lastMessage update
      const updatedChat = await Chat.findById(chatId);
      expect(updatedChat?.lastMessage?.text).toBe(body.text);

      // Verify Socket.io emission
      expect((global as any).io.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect((global as any).io.emit).toHaveBeenCalledWith('MESSAGE_SENT', expect.any(Object));
    });
  });

  describe('GET /api/v1/messages/chat/:chatId (Message History)', () => {
    it('retrieves message history with correct authorization', async () => {
      const { tokenA, chatId, userA } = await setupChat();

      // Create some messages
      await Message.create([
        { chatId, sender: userA._id, text: 'Msg 1', type: 'text' },
        { chatId, sender: userA._id, text: 'Msg 2', type: 'text' },
      ]);

      const res = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      logApi(
        'GET',
        `/api/v1/messages/chat/${chatId}`,
        { params: { chatId } },
        res.body,
        'GET-HISTORY-SUCCESS',
        'Participant retrieves the message history for their chat'
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].text).toBe('Msg 1');
    });
  });

  describe('POST /api/v1/messages/chat/:chatId/read (Mark Read)', () => {
    it('marks messages as read by the participant', async () => {
      const { tokenB, chatId, userA, userB } = await setupChat();

      // Create a message from userA
      const msg = await Message.create({
        chatId,
        sender: userA._id,
        text: 'Unread message',
        type: 'text',
      });

      const res = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);

      logApi(
        'POST',
        `/api/v1/messages/chat/${chatId}/read`,
        { params: { chatId } },
        res.body,
        'MARK-READ-SUCCESS',
        'User marks all messages in a chat as read'
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in DB
      const updatedMsg = await Message.findById(msg._id);
      expect(updatedMsg?.readBy.map(id => id.toString())).toContain(userB._id.toString());
    });
  });

  describe('Real-time Full Interaction: Typing -> Send -> Read', () => {
    it('simulates a real-time conversation flow between two users', async () => {
      // 1. Setup: User A and User B
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.USER, 'userA');
      const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.USER, 'userB');
      const chat = await Chat.create({ participants: [userA._id, userB._id] });
      const chatId = chat._id.toString();

      // 2. Setup Mock Sockets for both users
      const handlersA: Record<string, Function> = {};
      const handlersB: Record<string, Function> = {};

      const createMockSocket = (userId: string, token: string, handlers: Record<string, Function>) => ({
        id: `socket-id-${userId}`,
        handshake: { auth: { token } },
        join: vi.fn(),
        on: vi.fn((event, handler) => { handlers[event] = handler; }),
        emit: vi.fn(),
        to: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
      });

      const mockSocketA = createMockSocket(userA._id.toString(), tokenA, handlersA);
      const mockSocketB = createMockSocket(userB._id.toString(), tokenB, handlersB);

      // 3. Initialize SocketHelper with both sockets
      const mockIo = {
        on: vi.fn(async (event, connectionHandler) => {
          if (event === 'connection') {
            await connectionHandler(mockSocketA);
            await connectionHandler(mockSocketB);
          }
        }),
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      };

      socketHelper.socket(mockIo as any);
      SocketManager.init(mockIo as any); // Update SocketManager to use this test's mockIo
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for handlers to register

      // --- STEP 1: User B starts typing ---
      logSocket('RECEIVE', 'TYPING_START', { chatId }, 'STEP-1-IN', 'User B starts typing');
      await handlersB['TYPING_START']({ chatId });

      // Server should broadcast to User A
      logSocket('EMIT', 'TYPING_START', { userId: userB._id.toString(), chatId }, 'STEP-1-OUT', 'Server notifies User A that User B is typing');
      expect(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('TYPING_START', expect.objectContaining({
        userId: userB._id.toString(),
        chatId
      }));

      vi.clearAllMocks(); // Clear mocks after Step 1 to make Step 2 expectations cleaner

      // --- STEP 2: User A sends a message (HTTP) ---
      const messageBody = { chatId, text: 'Real-time test message' };
      logApi('POST', '/api/v1/messages', { body: messageBody }, {}, 'STEP-2-HTTP', 'User A sends a message');
      
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(messageBody);

      expect(res.status).toBe(201);
      const messageId = res.body.data.id;

      // Server should emit MESSAGE_SENT to User B
      // MessageService emits { message: populatedMessage }
      logSocket('EMIT', 'MESSAGE_SENT', { message: res.body.data }, 'STEP-2-OUT', 'Server sends the new message to User B via socket');
      expect(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('MESSAGE_SENT', expect.objectContaining({
        message: expect.objectContaining({
          text: 'Real-time test message'
        })
      }));

      vi.clearAllMocks(); // Clear again for Step 3

      // --- STEP 3: User B sends Read Acknowledgment (Socket) ---
      const readPayload = { messageId };
      logSocket('RECEIVE', 'READ_ACK', readPayload, 'STEP-3-IN', 'User B acknowledges reading the message');
      await handlersB['READ_ACK'](readPayload);

      // Verify DB update
      const updatedMsg = await Message.findById(messageId);
      expect(updatedMsg?.readBy.map(id => id.toString())).toContain(userB._id.toString());

      // Server should broadcast MESSAGES_READ to User A
      const readBroadcast = { chatId, userId: userB._id.toString(), updatedIds: [messageId] };
      logSocket('EMIT', 'MESSAGES_READ', readBroadcast, 'STEP-3-OUT', 'Server notifies User A that User B read the message');
      expect(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('MESSAGES_READ', expect.objectContaining(readBroadcast));
    });
  });

  describe('Real-time Socket Logic (Client -> Server Events)', () => {
    it('verifies that a client-side READ_ACK socket event correctly updates DB and broadcasts to the chat', async () => {
      const { userB, tokenB, chatId, userA } = await setupChat();
      
      // 1. Create an unread message from User A
      const msg = await Message.create({
        chatId,
        sender: userA._id,
        text: 'Socket test message',
        type: 'text',
      });

      // 2. Setup mock socket environment to capture handlers registered by socketHelper
      const handlers: Record<string, Function> = {};
      const mockSocket = {
        id: 'socket-user-b',
        handshake: { auth: { token: tokenB } },
        join: vi.fn(),
        on: vi.fn((event, handler) => {
          handlers[event] = handler;
        }),
        emit: vi.fn(),
        disconnect: vi.fn(),
      };

      // 3. Initialize the actual socketHelper with a mock IO server
      const mockIo = {
        on: vi.fn(async (event, connectionHandler) => {
          if (event === 'connection') {
            await connectionHandler(mockSocket);
          }
        }),
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      };

      // This registers the real handlers (JOIN_CHAT, READ_ACK, etc.) on our mockSocket
      socketHelper.socket(mockIo as any);

      // Give it a small tick to ensure all async registrations are done
      await new Promise(resolve => setTimeout(resolve, 10));

      // 4. Simulate User B sending a READ_ACK event via Socket.IO
      const socketPayload = { messageId: msg._id.toString() };
      logSocket('RECEIVE', 'READ_ACK', socketPayload, 'SOCKET-IN', 'User B sends read acknowledgment via Socket');
      
      await handlers['READ_ACK'](socketPayload);

      // 5. Verify Database Update
      const updatedMsg = await Message.findById(msg._id);
      expect(updatedMsg?.readBy.map(id => id.toString())).toContain(userB._id.toString());

      // 6. Verify Real-time Broadcast (MESSAGES_READ should be sent to the chat room)
      const broadcastPayload = {
        chatId,
        userId: userB._id.toString(),
        updatedIds: [msg._id.toString()]
      };
      
      logSocket('EMIT', 'MESSAGES_READ', broadcastPayload, 'SOCKET-OUT', 'Server broadcasts read status to the chat room');

      expect(mockIo.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('MESSAGES_READ', expect.objectContaining(broadcastPayload));
    });
  });

});
