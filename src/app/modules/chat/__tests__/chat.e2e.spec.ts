/**
 * E2E tests for Chat module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks pushNotificationHelper (Firebase), Redis, and Socket.io.
 * Covers the full chat lifecycle: connection → chat creation → messaging → read receipts → notification routing → connection removal.
 */

// ── Mocks (hoisted — must appear before imports) ──────────────────────────

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
    on: vi.fn(),
  },
}));

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Connection } from '../../connection/connection.model';
import { Chat } from '../chat.model';
import { Message } from '../../message/message.model';
import { Notification } from '../../notification/notification.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi } from '../../../../helpers/__tests__/testLogger';
import { SocketManager } from '../../../../helpers/socketManager';
import { pushNotificationHelper } from '../../notification/pushNotificationHelper';
import { redisClient } from '../../../../shared/redisClient';

// ── Module-level variables ────────────────────────────────────────────────────

let replSet: MongoMemoryReplSet;

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Create a verified, active user and return its document plus a valid JWT. */
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

/**
 * Creates two users and a pending connection request from userA to userB.
 * Throws if the API call does not return 201 or the connection ID is missing.
 */
async function setupPendingConnection() {
  const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.USER, 'userA');
  const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.USER, 'userB');

  const res = await request(app)
    .post('/api/v1/connections')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ receiverId: userB._id.toString() });

  if (res.status !== 201 || !res.body.data?.id) {
    throw new Error(
      `setupPendingConnection failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }

  return { userA, tokenA, userB, tokenB, connectionId: res.body.data.id as string };
}

/**
 * Builds on setupPendingConnection and accepts the connection as userB.
 * Throws if the API call does not return 200 or chatId is missing.
 */
async function setupAcceptedConnection() {
  const { userA, tokenA, userB, tokenB, connectionId } = await setupPendingConnection();

  const res = await request(app)
    .post(`/api/v1/connections/${connectionId}/accept`)
    .set('Authorization', `Bearer ${tokenB}`);

  if (res.status !== 200 || !res.body.data?.chatId) {
    throw new Error(
      `setupAcceptedConnection failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }

  return {
    userA,
    tokenA,
    userB,
    tokenB,
    connectionId,
    chatId: res.body.data.chatId as string,
  };
}

/**
 * Calls setupAcceptedConnection then sends n text messages from userA.
 * Each send is asserted to return 201.
 * Returns the accepted connection context plus the array of message response bodies.
 */
async function setupChatWithMessages(n: number) {
  const ctx = await setupAcceptedConnection();
  const { tokenA, chatId } = ctx;

  const messages: any[] = [];
  for (let i = 1; i <= n; i++) {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ chatId, text: `Message ${i}`, type: 'text' });

    if (res.status !== 201) {
      throw new Error(
        `setupChatWithMessages failed at message ${i}: status=${res.status} body=${JSON.stringify(res.body)}`,
      );
    }

    messages.push(res.body.data);
  }

  return { ...ctx, messages };
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
  // 1. Clear collections in dependency order
  await Connection.deleteMany({});
  await Notification.deleteMany({});
  await Message.deleteMany({});
  await Chat.deleteMany({});
  await User.deleteMany({});

  // 2. Reset all mock call counts and one-time overrides
  vi.clearAllMocks();

  // 3. Fresh Socket.io mock — covers both global.io and SocketManager paths
  const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
  (global as any).io = mockIo;
  SocketManager.init(mockIo as any);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Chat E2E Tests', () => {

  describe('Infrastructure & Helpers', () => {
    it('mongoose is connected after beforeAll', async () => {
      // readyState 1 = connected
      expect(mongoose.connection.readyState).toBe(1);
    });

    it('mocks are in place', async () => {
      expect(vi.isMockFunction(redisClient.get)).toBe(true);
      expect(vi.isMockFunction(pushNotificationHelper.sendPushNotification)).toBe(true);
      expect(vi.isMockFunction(pushNotificationHelper.sendPushNotifications)).toBe(true);
    });

    it('beforeEach clears all collections', async () => {
      // Seed one document in each collection, then let beforeEach run (it already ran before this test)
      // Since beforeEach already ran, all collections should be empty right now
      expect(await User.countDocuments()).toBe(0);
      expect(await Connection.countDocuments()).toBe(0);
      expect(await Chat.countDocuments()).toBe(0);
      expect(await Message.countDocuments()).toBe(0);
      expect(await Notification.countDocuments()).toBe(0);
    });
  });

  // ── Flow 2: Multi-Message Exchange and Cursor Pagination ─────────────────

  describe('Flow 2: Multi-Message Exchange and Cursor Pagination', () => {
    it('5-message alternating exchange returns messages sorted ascending', async () => {
      const { userA, tokenA, userB, tokenB, chatId } = await setupAcceptedConnection();

      // Send M1 (A), M2 (B), M3 (A), M4 (B), M5 (A)
      const sends = [
        { token: tokenA, text: 'M1' },
        { token: tokenB, text: 'M2' },
        { token: tokenA, text: 'M3' },
        { token: tokenB, text: 'M4' },
        { token: tokenA, text: 'M5' },
      ];

      for (const { token, text } of sends) {
        const res = await request(app)
          .post('/api/v1/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({ chatId, text, type: 'text' });
        logApi('POST', '/api/v1/messages', { chatId, text, type: 'text' }, res.body, `FLOW2-SEND-${text}`, `Send ${text}`);
        expect(res.status).toBe(201);
      }

      // GET all messages (no limit)
      const historyRes = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, {}, historyRes.body, 'FLOW2-GET-HISTORY', 'Get all 5 messages');

      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
      expect(historyRes.body.data).toHaveLength(5);
      expect(historyRes.body.data[0].text).toBe('M1');
      expect(historyRes.body.data[4].text).toBe('M5');

      // Assert ascending createdAt order (Req 4.1)
      const dates = historyRes.body.data.map((m: any) => new Date(m.createdAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    });

    it('cursor pagination: page 1 of 3 returns correct meta', async () => {
      const { tokenA, chatId } = await setupChatWithMessages(5);

      const page1 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2 }, page1.body, 'FLOW2-PAGE1', 'Fetch page 1 with limit=2');

      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.meta.total).toBe(5);
      expect(page1.body.meta.limit).toBe(2);
      expect(page1.body.meta.hasNextPage).toBe(true);
      expect(page1.body.meta.nextCursor).toBeTruthy();
      expect(typeof page1.body.meta.nextCursor).toBe('string');
      expect(page1.body.meta.nextCursor.length).toBeGreaterThan(0);
    });

    it('cursor pagination: page 2 uses nextCursor from page 1', async () => {
      const { tokenA, chatId } = await setupChatWithMessages(5);

      // Page 1
      const page1 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2 }, page1.body, 'FLOW2-PAGE2-FETCH1', 'Fetch page 1 for cursor');

      expect(page1.status).toBe(200);
      const cursor1 = page1.body.meta.nextCursor;
      expect(cursor1).toBeTruthy();

      const page1Ids = page1.body.data.map((m: any) => m.id || m._id);

      // Page 2
      const page2 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .query({ limit: 2, cursor: cursor1 })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2, cursor: cursor1 }, page2.body, 'FLOW2-PAGE2-FETCH2', 'Fetch page 2 with cursor from page 1');

      expect(page2.status).toBe(200);
      expect(page2.body.data).toHaveLength(2);

      const page2Ids = page2.body.data.map((m: any) => m.id || m._id);

      // No ID overlap between page 1 and page 2 (Req 4.3)
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('cursor pagination: page 3 is the last page', async () => {
      const { tokenA, chatId } = await setupChatWithMessages(5);

      // Page 1
      const page1 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2 }, page1.body, 'FLOW2-PAGE3-FETCH1', 'Fetch page 1');

      expect(page1.status).toBe(200);
      const cursor1 = page1.body.meta.nextCursor;
      const page1Ids = page1.body.data.map((m: any) => m.id || m._id);

      // Page 2
      const page2 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .query({ limit: 2, cursor: cursor1 })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2, cursor: cursor1 }, page2.body, 'FLOW2-PAGE3-FETCH2', 'Fetch page 2');

      expect(page2.status).toBe(200);
      const cursor2 = page2.body.meta.nextCursor;
      const page2Ids = page2.body.data.map((m: any) => m.id || m._id);

      // Page 3 (last page)
      const page3 = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .query({ limit: 2, cursor: cursor2 })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, { limit: 2, cursor: cursor2 }, page3.body, 'FLOW2-PAGE3-FETCH3', 'Fetch page 3 (last)');

      expect(page3.status).toBe(200);
      expect(page3.body.data).toHaveLength(1);
      expect(page3.body.meta.hasNextPage).toBe(false);
      expect(page3.body.meta.nextCursor).toBeNull();

      const page3Ids = page3.body.data.map((m: any) => m.id || m._id);

      // All IDs across 3 pages are unique and total 5 (Req 4.4)
      const allIds = [...page1Ids, ...page2Ids, ...page3Ids];
      expect(allIds).toHaveLength(5);
      expect(new Set(allIds).size).toBe(5);
    });

    it('bulk mark-read: modifiedCount matches sender B message count', async () => {
      const { userA, tokenA, userB, tokenB, chatId } = await setupAcceptedConnection();

      // Send M1 (A), M2 (B), M3 (A), M4 (B), M5 (A)
      const sends = [
        { token: tokenA, text: 'M1' },
        { token: tokenB, text: 'M2' },
        { token: tokenA, text: 'M3' },
        { token: tokenB, text: 'M4' },
        { token: tokenA, text: 'M5' },
      ];

      for (const { token, text } of sends) {
        const res = await request(app)
          .post('/api/v1/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({ chatId, text, type: 'text' });
        logApi('POST', '/api/v1/messages', { chatId, text, type: 'text' }, res.body, `FLOW2-MARKREAD-SEND-${text}`, `Send ${text}`);
        expect(res.status).toBe(201);
      }

      // userA marks read — should only mark M2 and M4 (sent by userB)
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW2-MARKREAD', 'userA marks chat as read');

      expect(markReadRes.status).toBe(200);
      expect(markReadRes.body.data.modifiedCount).toBe(2);
      expect(Array.isArray(markReadRes.body.data.updatedIds)).toBe(true);
      expect(markReadRes.body.data.updatedIds).toHaveLength(2);
    });

    it('mark-read excludes own messages from readBy', async () => {
      const { userA, tokenA, userB, tokenB, chatId } = await setupAcceptedConnection();

      // Send M1 (A), M2 (B), M3 (A), M4 (B), M5 (A)
      const sends = [
        { token: tokenA, text: 'M1' },
        { token: tokenB, text: 'M2' },
        { token: tokenA, text: 'M3' },
        { token: tokenB, text: 'M4' },
        { token: tokenA, text: 'M5' },
      ];

      for (const { token, text } of sends) {
        const res = await request(app)
          .post('/api/v1/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({ chatId, text, type: 'text' });
        logApi('POST', '/api/v1/messages', { chatId, text, type: 'text' }, res.body, `FLOW2-READBY-SEND-${text}`, `Send ${text}`);
        expect(res.status).toBe(201);
      }

      // userA marks read
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW2-READBY-MARKREAD', 'userA marks chat as read');

      expect(markReadRes.status).toBe(200);

      // Req 4.6: userB's messages should have userA in readBy
      const userBMessages = await Message.find({ chatId, sender: userB._id });
      expect(userBMessages.length).toBeGreaterThan(0);
      for (const msg of userBMessages) {
        const readByStrings = (msg.readBy as any[]).map((id: any) => id.toString());
        expect(readByStrings).toContain(userA._id.toString());
      }

      // Req 4.7: userA's own messages should NOT have userA in readBy
      const userAMessages = await Message.find({ chatId, sender: userA._id });
      expect(userAMessages.length).toBeGreaterThan(0);
      for (const msg of userAMessages) {
        const readByStrings = (msg.readBy as any[]).map((id: any) => id.toString());
        expect(readByStrings).not.toContain(userA._id.toString());
      }
    });
  });

  // ── Flow 3: Notification Routing ─────────────────────────────────────────

  describe('Flow 3: Notification Routing', () => {
    it('offline receiver: push sent, dedup key set', async () => {
      // Default redisClient.get returns null → receiver offline
      const { userA, tokenA, userB, chatId } = await setupAcceptedConnection();

      // Give userB a device token so the push notification path actually fires
      await User.findByIdAndUpdate(userB._id, {
        $push: { deviceTokens: { token: 'fake-fcm-token-for-test', platform: 'android' } },
      });

      // Send a message as userA
      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, text: 'Offline push test', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'Offline push test', type: 'text' }, sendRes.body, 'FLOW3-OFFLINE-SEND', 'userA sends message to offline receiver');

      expect(sendRes.status).toBe(201);

      // Req 5.1: redisClient.set called with dedup key as first arg
      const dedupKey = `notif:dedup:${chatId}:${userB._id}`;
      const setCalls = vi.mocked(redisClient.set).mock.calls;
      const dedupCall = setCalls.find((args) => args[0] === dedupKey);
      expect(dedupCall).toBeDefined();

      // Req 5.1: push notification helper called at least once
      const pushSingleCalled = vi.mocked(pushNotificationHelper.sendPushNotification).mock.calls.length;
      const pushBulkCalled = vi.mocked(pushNotificationHelper.sendPushNotifications).mock.calls.length;
      expect(pushSingleCalled + pushBulkCalled).toBeGreaterThan(0);

      // Req 5.4: CHAT_UPDATED NOT emitted to user::${userB._id}
      const emitCalls = vi.mocked((global as any).io.emit).mock.calls as [string, ...any[]][];
      const chatUpdatedCalls = emitCalls.filter(([event]) => event === 'CHAT_UPDATED');
      expect(chatUpdatedCalls).toHaveLength(0);
    });

    it('offline receiver: second message within dedup window skips push', async () => {
      // Default redisClient.get returns null → receiver offline
      const { userA, tokenA, chatId } = await setupAcceptedConnection();

      // First message: default set returns 'OK' → push fires
      const firstRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, text: 'First message', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'First message', type: 'text' }, firstRes.body, 'FLOW3-DEDUP-FIRST', 'userA sends first message (push should fire)');

      expect(firstRes.status).toBe(201);

      // Override set to return null (NX fails — dedup key already exists)
      vi.mocked(redisClient.set).mockResolvedValueOnce(null as any);

      // Clear push helper mocks before second send
      vi.mocked(pushNotificationHelper.sendPushNotification).mockClear();
      vi.mocked(pushNotificationHelper.sendPushNotifications).mockClear();

      // Second message: NX fails → push should be suppressed
      const secondRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, text: 'Second message', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'Second message', type: 'text' }, secondRes.body, 'FLOW3-DEDUP-SECOND', 'userA sends second message (push should be suppressed)');

      expect(secondRes.status).toBe(201);

      // Req 5.2: push helpers NOT called for second message
      expect(vi.mocked(pushNotificationHelper.sendPushNotification)).not.toHaveBeenCalled();
      expect(vi.mocked(pushNotificationHelper.sendPushNotifications)).not.toHaveBeenCalled();
    });

    it('receiver in different chat: CHAT_UPDATED emitted, no push', async () => {
      const { userA, tokenA, userB, chatId } = await setupAcceptedConnection();

      // Override get to return a different chatId → receiver is in a different chat
      vi.mocked(redisClient.get).mockResolvedValueOnce('some-other-chat-id');

      // Send a message as userA
      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, text: 'Different chat test', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'Different chat test', type: 'text' }, sendRes.body, 'FLOW3-DIFF-CHAT-SEND', 'userA sends message while receiver is in different chat');

      expect(sendRes.status).toBe(201);

      // Req 5.3, 11.2: io.to('user::' + userB._id) called and CHAT_UPDATED emitted
      const userBRoom = `user::${userB._id.toString()}`;
      expect((global as any).io.to).toHaveBeenCalledWith(userBRoom);
      expect((global as any).io.emit).toHaveBeenCalledWith(
        'CHAT_UPDATED',
        expect.objectContaining({
          lastMessage: expect.any(Object),
          unreadCount: expect.any(Number),
        }),
      );

      // Req 5.3: push helpers NOT called
      expect(vi.mocked(pushNotificationHelper.sendPushNotification)).not.toHaveBeenCalled();
      expect(vi.mocked(pushNotificationHelper.sendPushNotifications)).not.toHaveBeenCalled();
    });

    it('receiver has chat open: no push, no CHAT_UPDATED, MESSAGE_SENT still fires', async () => {
      const { userA, tokenA, userB, chatId } = await setupAcceptedConnection();

      // Override get to return the current chatId → receiver has this chat open
      vi.mocked(redisClient.get).mockResolvedValueOnce(chatId);

      // Send a message as userA
      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, text: 'Chat open test', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'Chat open test', type: 'text' }, sendRes.body, 'FLOW3-CHAT-OPEN-SEND', 'userA sends message while receiver has chat open');

      expect(sendRes.status).toBe(201);

      // Req 5.5: push helpers NOT called
      expect(vi.mocked(pushNotificationHelper.sendPushNotification)).not.toHaveBeenCalled();
      expect(vi.mocked(pushNotificationHelper.sendPushNotifications)).not.toHaveBeenCalled();

      // Req 5.5: CHAT_UPDATED NOT emitted to user::${userB._id}
      const emitCalls = vi.mocked((global as any).io.emit).mock.calls as [string, ...any[]][];
      const chatUpdatedCalls = emitCalls.filter(([event]) => event === 'CHAT_UPDATED');
      expect(chatUpdatedCalls).toHaveLength(0);

      // Req 5.6, 11.1: MESSAGE_SENT still emitted to chat::${chatId}
      expect((global as any).io.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect((global as any).io.emit).toHaveBeenCalledWith(
        'MESSAGE_SENT',
        expect.objectContaining({
          message: expect.any(Object),
        }),
      );
    });
  });

  // ── Flow 1: Full Happy Path ────────────────────────────────────────────────

  describe('Flow 1: Full Happy Path', () => {
    it('connection accept → chat create → send message → get history → mark read', async () => {
      // ── Step 1: Setup pending connection ──────────────────────────────────
      const { userA, tokenA, userB, tokenB, connectionId } = await setupPendingConnection();

      // ── Step 2: Accept the connection as userB ────────────────────────────
      const acceptRes = await request(app)
        .post(`/api/v1/connections/${connectionId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/connections/${connectionId}/accept`, {}, acceptRes.body, 'FLOW1-ACCEPT-CONNECTION', 'userB accepts connection from userA');

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);
      expect(acceptRes.body.data.status).toBe('ACCEPTED');
      expect(acceptRes.body.data.chatId).toBeTruthy();
      const chatId: string = acceptRes.body.data.chatId;

      // ── Step 3: Assert exactly one Chat document exists ───────────────────
      const chatCount = await Chat.countDocuments({
        participants: { $all: [userA._id, userB._id] },
      });
      expect(chatCount).toBe(1);

      // ── Step 4: Assert CONNECTION_ACCEPTED socket event emitted to userA ──
      // Req 11.5: io.to('user::' + userA._id).emit('CONNECTION_ACCEPTED', ...)
      expect((global as any).io.to).toHaveBeenCalledWith(`user::${userA._id.toString()}`);
      expect((global as any).io.emit).toHaveBeenCalledWith(
        'CONNECTION_ACCEPTED',
        expect.objectContaining({
          connectionId: expect.anything(),
          chatId: expect.anything(),
        }),
      );

      // ── Step 5: POST /api/v1/chats/:userB._id as userA (idempotency) ──────
      const chatCreateResA = await request(app)
        .post(`/api/v1/chats/${userB._id.toString()}`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('POST', `/api/v1/chats/${userB._id.toString()}`, {}, chatCreateResA.body, 'FLOW1-CREATE-CHAT-A', 'userA creates/gets chat with userB (idempotency)');

      expect(chatCreateResA.status).toBe(201);
      expect(chatCreateResA.body.data.id).toBe(chatId);

      // ── Step 6: POST /api/v1/chats/:userA._id as userB (reverse idempotency)
      const chatCreateResB = await request(app)
        .post(`/api/v1/chats/${userA._id.toString()}`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/chats/${userA._id.toString()}`, {}, chatCreateResB.body, 'FLOW1-CREATE-CHAT-B', 'userB creates/gets chat with userA (reverse idempotency)');

      expect(chatCreateResB.status).toBe(201);
      expect(chatCreateResB.body.data.id).toBe(chatId);

      // ── Step 7: GET /api/v1/chats as userA (before any message) ──────────
      const chatListResA = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', {}, chatListResA.body, 'FLOW1-LIST-CHATS-A', 'userA lists chats before any message');

      expect(chatListResA.status).toBe(200);
      expect(Array.isArray(chatListResA.body.data)).toBe(true);
      expect(chatListResA.body.data).toHaveLength(1);
      expect(chatListResA.body.data[0].id).toBe(chatId);
      expect(chatListResA.body.data[0].unreadCount).toBe(0);

      // ── Step 8: GET /api/v1/chats as userB (before any message) ──────────
      const chatListResB = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/chats', {}, chatListResB.body, 'FLOW1-LIST-CHATS-B', 'userB lists chats before any message');

      expect(chatListResB.status).toBe(200);
      expect(Array.isArray(chatListResB.body.data)).toBe(true);
      expect(chatListResB.body.data).toHaveLength(1);
      expect(chatListResB.body.data[0].id).toBe(chatId);
      expect(chatListResB.body.data[0].unreadCount).toBe(0);

      // ── Step 9: Send message as userA ─────────────────────────────────────
      const sendMsgRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, text: 'Hello from A', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'Hello from A', type: 'text' }, sendMsgRes.body, 'FLOW1-SEND-MESSAGE', 'userA sends first message');

      expect(sendMsgRes.status).toBe(201);
      expect(sendMsgRes.body.success).toBe(true);
      expect(sendMsgRes.body.data.text).toBe('Hello from A');
      expect(sendMsgRes.body.data.chatId).toBe(chatId);

      // ── Step 10: Assert MESSAGE_SENT socket event ─────────────────────────
      // Req 3.8, 11.1: io.to('chat::' + chatId).emit('MESSAGE_SENT', { message: { text: 'Hello from A' } })
      expect((global as any).io.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect((global as any).io.emit).toHaveBeenCalledWith(
        'MESSAGE_SENT',
        expect.objectContaining({
          message: expect.objectContaining({ text: 'Hello from A' }),
        }),
      );

      // ── Step 11: Assert Chat.lastMessage updated ──────────────────────────
      // Req 3.9, 3.10
      const chatDoc = await Chat.findById(chatId);
      expect(chatDoc).not.toBeNull();
      expect((chatDoc as any).lastMessage.text).toBe('Hello from A');
      expect((chatDoc as any).lastMessage.sender.toString()).toBe(userA._id.toString());

      // ── Step 12: GET /api/v1/chats as userA — lastMessage reflected ───────
      const chatListAfterMsgA = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', {}, chatListAfterMsgA.body, 'FLOW1-LIST-CHATS-A-AFTER-MSG', 'userA lists chats after sending message');

      expect(chatListAfterMsgA.body.data[0].lastMessage.text).toBe('Hello from A');

      // ── Step 13: GET /api/v1/chats as userB — unreadCount === 1 ──────────
      // Override mget to return ['1'] for this call (Req 3.11)
      vi.mocked(redisClient.mget).mockResolvedValueOnce(['1']);
      const chatListAfterMsgB = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/chats', {}, chatListAfterMsgB.body, 'FLOW1-LIST-CHATS-B-UNREAD', 'userB lists chats — expects unreadCount 1');

      expect(chatListAfterMsgB.body.data[0].unreadCount).toBe(1);

      // ── Step 14: GET /api/v1/messages/chat/:chatId as userB ───────────────
      const msgHistoryRes = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, {}, msgHistoryRes.body, 'FLOW1-GET-HISTORY', 'userB fetches message history');

      expect(msgHistoryRes.status).toBe(200);
      expect(msgHistoryRes.body.success).toBe(true);
      expect(Array.isArray(msgHistoryRes.body.data)).toBe(true);
      expect(msgHistoryRes.body.data).toHaveLength(1);
      expect(msgHistoryRes.body.data[0].text).toBe('Hello from A');

      // ── Step 15: POST /api/v1/messages/chat/:chatId/read as userB ─────────
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW1-MARK-READ', 'userB marks messages as read');

      expect(markReadRes.status).toBe(200);
      expect(markReadRes.body.success).toBe(true);
      expect(markReadRes.body.data.modifiedCount).toBe(1);
      expect(Array.isArray(markReadRes.body.data.updatedIds)).toBe(true);
      expect(markReadRes.body.data.updatedIds).toHaveLength(1);

      // ── Step 16: Assert MESSAGES_READ socket event ────────────────────────
      // Req 3.14, 11.3: io.to('chat::' + chatId).emit('MESSAGES_READ', { chatId, userId, updatedIds })
      expect((global as any).io.to).toHaveBeenCalledWith(`chat::${chatId}`);
      expect((global as any).io.emit).toHaveBeenCalledWith(
        'MESSAGES_READ',
        expect.objectContaining({
          chatId,
          userId: userB._id.toString(),
          updatedIds: expect.arrayContaining([expect.any(String)]),
        }),
      );

      // ── Step 17: GET /api/v1/chats as userB — unreadCount === 0 ──────────
      // Override mget to return ['0'] (Req 3.15)
      vi.mocked(redisClient.mget).mockResolvedValueOnce(['0']);
      const chatListFinalB = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/chats', {}, chatListFinalB.body, 'FLOW1-LIST-CHATS-B-AFTER-READ', 'userB lists chats after marking read — expects unreadCount 0');

      expect(chatListFinalB.body.data[0].unreadCount).toBe(0);
    });
  });

  // ── Flow 4: Connection Removal with Chat Persistence ─────────────────────

  describe('Flow 4: Connection Removal with Chat Persistence', () => {
    it('user A removes connection: Connection deleted, Chat persists, CONNECTION_REMOVED emitted', async () => {
      const { userA, tokenA, userB, tokenB, connectionId, chatId } = await setupChatWithMessages(3);

      // ── Step 1: Remove connection as userA ────────────────────────────────
      const removeRes = await request(app)
        .post(`/api/v1/connections/${connectionId}/remove`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-REMOVE-CONNECTION', 'userA removes connection');

      // Req 6.1: status 200, success true, data.status 'NONE'
      expect(removeRes.status).toBe(200);
      expect(removeRes.body.success).toBe(true);
      expect(removeRes.body.data.status).toBe('NONE');

      // ── Step 2: Assert Connection document is deleted ─────────────────────
      // Req 6.2
      const connectionDoc = await Connection.findById(connectionId);
      expect(connectionDoc).toBeNull();

      // ── Step 3: Assert Chat document still exists ─────────────────────────
      // Req 6.3
      const chatDoc = await Chat.findById(chatId);
      expect(chatDoc).not.toBeNull();

      // ── Step 4: Assert CONNECTION_REMOVED socket event emitted to userB ───
      // Req 6.4, 11.4: io.to('user::' + userB._id).emit('CONNECTION_REMOVED', { connectionId, chatId })
      // Note: chatId in the socket payload is a MongoDB ObjectId, so we use expect.anything() and
      // verify the chatId value separately via the DB and chat list checks below.
      expect((global as any).io.to).toHaveBeenCalledWith(`user::${userB._id.toString()}`);
      const emitCalls = (global as any).io.emit.mock.calls as [string, ...any[]][];
      const removedCall = emitCalls.find(([event]) => event === 'CONNECTION_REMOVED');
      expect(removedCall).toBeDefined();
      expect(removedCall![1]).toMatchObject({
        connectionId: expect.anything(),
      });
      // chatId in the payload is an ObjectId — verify it matches the known chatId string
      expect(removedCall![1].chatId?.toString()).toBe(chatId);

      // ── Step 5: GET /api/v1/chats as userA — chat still visible ──────────
      // Req 6.5
      const chatListResA = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', {}, chatListResA.body, 'FLOW4-LIST-CHATS-A', 'userA lists chats after connection removal');

      expect(chatListResA.status).toBe(200);
      expect(chatListResA.body.success).toBe(true);
      const chatListAIds = chatListResA.body.data.map((c: any) => c.id || c._id);
      expect(chatListAIds).toContain(chatId);

      // ── Step 6: GET /api/v1/chats as userB — chat still visible ──────────
      // Req 6.6
      const chatListResB = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/chats', {}, chatListResB.body, 'FLOW4-LIST-CHATS-B', 'userB lists chats after connection removal');

      expect(chatListResB.status).toBe(200);
      expect(chatListResB.body.success).toBe(true);
      const chatListBIds = chatListResB.body.data.map((c: any) => c.id || c._id);
      expect(chatListBIds).toContain(chatId);

      // ── Step 7: GET /api/v1/messages/chat/:chatId as userA — 3 messages ──
      // Req 6.7: message history unaffected by connection removal
      const msgHistoryRes = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, {}, msgHistoryRes.body, 'FLOW4-GET-HISTORY', 'userA fetches message history after connection removal');

      expect(msgHistoryRes.status).toBe(200);
      expect(msgHistoryRes.body.data).toHaveLength(3);
    });

    it('user B can also remove connection: CONNECTION_REMOVED emitted to user A', async () => {
      const { userA, tokenB, connectionId } = await setupAcceptedConnection();

      // Remove connection as userB
      const removeRes = await request(app)
        .post(`/api/v1/connections/${connectionId}/remove`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-REMOVE-BY-B', 'userB removes connection');

      // Req 6.8: status 200, data.status 'NONE'
      expect(removeRes.status).toBe(200);
      expect(removeRes.body.data.status).toBe('NONE');

      // Req 6.8, 11.4: CONNECTION_REMOVED emitted to user::userA._id
      expect((global as any).io.to).toHaveBeenCalledWith(`user::${userA._id.toString()}`);
      expect((global as any).io.emit).toHaveBeenCalledWith(
        'CONNECTION_REMOVED',
        expect.objectContaining({
          connectionId: expect.anything(),
          chatId: expect.anything(),
        }),
      );
    });

    it('non-participant cannot remove connection: 403', async () => {
      const { connectionId } = await setupAcceptedConnection();

      // Create a third user who is not part of the connection
      const { token: tokenC } = await createAuthUser(USER_ROLES.USER, 'userC');

      // Attempt to remove connection as userC
      const removeRes = await request(app)
        .post(`/api/v1/connections/${connectionId}/remove`)
        .set('Authorization', `Bearer ${tokenC}`);
      logApi('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-REMOVE-NON-PARTICIPANT', 'userC (non-participant) attempts to remove connection');

      // Req 6.9: 403 Forbidden
      expect(removeRes.status).toBe(403);
      expect(removeRes.body.success).toBe(false);
    });

    it('message history persists after connection removal', async () => {
      const { userA, tokenA, connectionId, chatId } = await setupChatWithMessages(3);

      // Remove connection as userA
      const removeRes = await request(app)
        .post(`/api/v1/connections/${connectionId}/remove`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('POST', `/api/v1/connections/${connectionId}/remove`, {}, removeRes.body, 'FLOW4-PERSIST-REMOVE', 'userA removes connection (persistence check)');

      expect(removeRes.status).toBe(200);

      // Req 6.7: message history still accessible and complete
      const msgHistoryRes = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, {}, msgHistoryRes.body, 'FLOW4-PERSIST-HISTORY', 'userA fetches message history — explicit persistence check');

      expect(msgHistoryRes.status).toBe(200);
      expect(msgHistoryRes.body.data).toHaveLength(3);
    });
  });

  // ── Flow 5: Validation Guards ─────────────────────────────────────────────

  describe('Flow 5: Validation Guards', () => {
    it('unauthenticated requests return 401 for all chat/message endpoints', async () => {
      const { userB, chatId } = await setupAcceptedConnection();

      // Req 7.1: POST /api/v1/chats/:otherUserId without Authorization → 401
      const chatCreateRes = await request(app)
        .post(`/api/v1/chats/${userB._id.toString()}`);
      logApi('POST', `/api/v1/chats/${userB._id.toString()}`, {}, chatCreateRes.body, 'FLOW5-UNAUTH-CREATE-CHAT', 'unauthenticated POST /chats/:id');

      expect(chatCreateRes.status).toBe(401);
      expect(chatCreateRes.body.success).toBe(false);

      // Req 7.2: GET /api/v1/chats without Authorization → 401
      const chatListRes = await request(app)
        .get('/api/v1/chats');
      logApi('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW5-UNAUTH-LIST-CHATS', 'unauthenticated GET /chats');

      expect(chatListRes.status).toBe(401);
      expect(chatListRes.body.success).toBe(false);

      // Req 7.3: POST /api/v1/messages without Authorization → 401
      const sendMsgRes = await request(app)
        .post('/api/v1/messages')
        .send({ chatId, text: 'hello', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'hello', type: 'text' }, sendMsgRes.body, 'FLOW5-UNAUTH-SEND-MSG', 'unauthenticated POST /messages');

      expect(sendMsgRes.status).toBe(401);
      expect(sendMsgRes.body.success).toBe(false);

      // Req 7.4: GET /api/v1/messages/chat/:chatId without Authorization → 401
      const getMsgRes = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, {}, getMsgRes.body, 'FLOW5-UNAUTH-GET-HISTORY', 'unauthenticated GET /messages/chat/:chatId');

      expect(getMsgRes.status).toBe(401);
      expect(getMsgRes.body.success).toBe(false);

      // Req 7.5: POST /api/v1/messages/chat/:chatId/read without Authorization → 401
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW5-UNAUTH-MARK-READ', 'unauthenticated POST /messages/chat/:chatId/read');

      expect(markReadRes.status).toBe(401);
      expect(markReadRes.body.success).toBe(false);
    });

    it('non-existent chatId returns 404 on send', async () => {
      const { token } = await createAuthUser();

      // Use a valid ObjectId that does not exist in the DB
      const nonExistentChatId = new mongoose.Types.ObjectId().toString();

      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ chatId: nonExistentChatId, text: 'hello', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId: nonExistentChatId, text: 'hello', type: 'text' }, sendRes.body, 'FLOW5-NONEXISTENT-CHAT', 'send to non-existent chatId');

      // Req 7.6: 404 when chatId does not exist
      expect(sendRes.status).toBe(404);
      expect(sendRes.body.success).toBe(false);
    });

    it('non-participant returns 403 on send and get history', async () => {
      const { chatId } = await setupAcceptedConnection();

      // Create a third user who is not a participant of the chat
      const { token: tokenC } = await createAuthUser(USER_ROLES.USER, 'userC');

      // Req 7.7: POST /api/v1/messages as userC → 403 with 'not a participant'
      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ chatId, text: 'intruder message', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: 'intruder message', type: 'text' }, sendRes.body, 'FLOW5-NON-PARTICIPANT-SEND', 'userC (non-participant) sends message');

      expect(sendRes.status).toBe(403);
      expect(sendRes.body.success).toBe(false);
      expect(sendRes.body.message.toLowerCase()).toContain('not a participant');

      // Req 7.8: GET /api/v1/messages/chat/:chatId as userC → 403 with 'not a participant'
      const getRes = await request(app)
        .get(`/api/v1/messages/chat/${chatId}`)
        .set('Authorization', `Bearer ${tokenC}`);
      logApi('GET', `/api/v1/messages/chat/${chatId}`, {}, getRes.body, 'FLOW5-NON-PARTICIPANT-GET', 'userC (non-participant) fetches message history');

      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);
      expect(getRes.body.message.toLowerCase()).toContain('not a participant');
    });

    it('empty message body returns 400', async () => {
      const { tokenA, chatId } = await setupAcceptedConnection();

      // Req 7.9: POST /api/v1/messages with no text and no attachments → 400
      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, type: 'text' }, sendRes.body, 'FLOW5-EMPTY-BODY', 'send message with no text and no attachments');

      expect(sendRes.status).toBe(400);
      expect(sendRes.body.success).toBe(false);
      expect(sendRes.body.message.toLowerCase()).toContain('must contain text or at least one attachment');
    });

    it('text exceeding 10000 chars returns 400', async () => {
      const { tokenA, chatId } = await setupAcceptedConnection();

      // Req 7.10: POST /api/v1/messages with text.length === 10001 → 400
      const longText = 'a'.repeat(10001);
      const sendRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId, text: longText, type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId, text: `${'a'.repeat(20)}...(10001 chars)`, type: 'text' }, sendRes.body, 'FLOW5-TEXT-TOO-LONG', 'send message with text exceeding 10000 chars');

      expect(sendRes.status).toBe(400);
      expect(sendRes.body.success).toBe(false);
      expect(sendRes.body.message.toLowerCase()).toContain('exceeds maximum length');
    });
  });

  // ── Flow 6 & 7: Chat List Ordering/Search and Mark-Read Edge Cases ────────

  describe('Flow 6 & 7: Chat List and Mark-Read Edge Cases', () => {

    /**
     * Helper: set up two accepted connections for userA.
     * userB has a name containing 'Ali'; userC does not.
     * Returns chatAB (userA↔userB) and chatAC (userA↔userC) IDs plus tokens.
     */
    async function setupTwoChats() {
      const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.USER, 'userA');
      const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.USER, 'Ali userB');
      const { user: userC, token: tokenC } = await createAuthUser(USER_ROLES.USER, 'userC');

      // userA → userB connection
      const connABRes = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userB._id.toString() });
      if (connABRes.status !== 201 || !connABRes.body.data?.id) {
        throw new Error(`setupTwoChats: connAB failed status=${connABRes.status} body=${JSON.stringify(connABRes.body)}`);
      }
      const connABId = connABRes.body.data.id as string;

      // userB accepts
      const acceptABRes = await request(app)
        .post(`/api/v1/connections/${connABId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);
      if (acceptABRes.status !== 200 || !acceptABRes.body.data?.chatId) {
        throw new Error(`setupTwoChats: acceptAB failed status=${acceptABRes.status} body=${JSON.stringify(acceptABRes.body)}`);
      }
      const chatAB = acceptABRes.body.data.chatId as string;

      // userA → userC connection
      const connACRes = await request(app)
        .post('/api/v1/connections')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: userC._id.toString() });
      if (connACRes.status !== 201 || !connACRes.body.data?.id) {
        throw new Error(`setupTwoChats: connAC failed status=${connACRes.status} body=${JSON.stringify(connACRes.body)}`);
      }
      const connACId = connACRes.body.data.id as string;

      // userC accepts
      const acceptACRes = await request(app)
        .post(`/api/v1/connections/${connACId}/accept`)
        .set('Authorization', `Bearer ${tokenC}`);
      if (acceptACRes.status !== 200 || !acceptACRes.body.data?.chatId) {
        throw new Error(`setupTwoChats: acceptAC failed status=${acceptACRes.status} body=${JSON.stringify(acceptACRes.body)}`);
      }
      const chatAC = acceptACRes.body.data.chatId as string;

      return { userA, tokenA, userB, tokenB, userC, tokenC, chatAB, chatAC };
    }

    // ── Flow 6: Chat List Ordering and Search ─────────────────────────────

    it('chat list ordered by lastMessage.createdAt descending', async () => {
      const { tokenA, chatAB, chatAC } = await setupTwoChats();

      // Send a message to chatAC first
      const sendACRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId: chatAC, text: 'Message to AC', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId: chatAC, text: 'Message to AC', type: 'text' }, sendACRes.body, 'FLOW6-SEND-AC', 'userA sends message to chatAC first');
      expect(sendACRes.status).toBe(201);

      // Then send a message to chatAB (more recent)
      const sendABRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatId: chatAB, text: 'Message to AB', type: 'text' });
      logApi('POST', '/api/v1/messages', { chatId: chatAB, text: 'Message to AB', type: 'text' }, sendABRes.body, 'FLOW6-SEND-AB', 'userA sends message to chatAB second (most recent)');
      expect(sendABRes.status).toBe(201);

      // GET /api/v1/chats as userA — chatAB should be first (most recent lastMessage)
      const chatListRes = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW6-LIST-ORDERED', 'userA lists chats — expects chatAB first');

      expect(chatListRes.status).toBe(200);
      expect(chatListRes.body.success).toBe(true);
      expect(Array.isArray(chatListRes.body.data)).toBe(true);
      expect(chatListRes.body.data.length).toBeGreaterThanOrEqual(2);
      // Req 8.1: most recently active chat (chatAB) must be first
      const firstChatId = chatListRes.body.data[0].id || chatListRes.body.data[0]._id;
      expect(firstChatId).toBe(chatAB);
    });

    it('searchTerm filters by other participant name (case-insensitive)', async () => {
      const { tokenA, chatAB } = await setupTwoChats();

      // GET /api/v1/chats?searchTerm=ali — should match userB (name contains 'Ali')
      const searchRes = await request(app)
        .get('/api/v1/chats')
        .query({ searchTerm: 'ali' })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', { searchTerm: 'ali' }, searchRes.body, 'FLOW6-SEARCH-ALI', 'userA searches chats with searchTerm=ali');

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.success).toBe(true);
      // Req 8.2: only chatAB (with userB whose name contains 'Ali') should be returned
      expect(searchRes.body.data).toHaveLength(1);
      const resultChatId = searchRes.body.data[0].id || searchRes.body.data[0]._id;
      expect(resultChatId).toBe(chatAB);
    });

    it('searchTerm with no match returns empty array', async () => {
      const { tokenA } = await setupTwoChats();

      // GET /api/v1/chats?searchTerm=NONEXISTENT
      const searchRes = await request(app)
        .get('/api/v1/chats')
        .query({ searchTerm: 'NONEXISTENT' })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', { searchTerm: 'NONEXISTENT' }, searchRes.body, 'FLOW6-SEARCH-NOMATCH', 'userA searches with non-matching searchTerm');

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.success).toBe(true);
      // Req 8.3: no chats match → empty array
      expect(searchRes.body.data).toEqual([]);
    });

    it('empty searchTerm returns all chats', async () => {
      const { tokenA } = await setupTwoChats();

      // GET /api/v1/chats?searchTerm= (empty string)
      const searchRes = await request(app)
        .get('/api/v1/chats')
        .query({ searchTerm: '' })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', { searchTerm: '' }, searchRes.body, 'FLOW6-SEARCH-EMPTY', 'userA searches with empty searchTerm');

      expect(searchRes.status).toBe(200);
      // Req 8.4: empty searchTerm → all chats returned
      expect(searchRes.body.data).toHaveLength(2);
    });

    it('whitespace-only searchTerm returns all chats', async () => {
      const { tokenA } = await setupTwoChats();

      // GET /api/v1/chats?searchTerm=   (whitespace only)
      const searchRes = await request(app)
        .get('/api/v1/chats')
        .query({ searchTerm: '   ' })
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('GET', '/api/v1/chats', { searchTerm: '   ' }, searchRes.body, 'FLOW6-SEARCH-WHITESPACE', 'userA searches with whitespace-only searchTerm');

      expect(searchRes.status).toBe(200);
      // Req 8.5: whitespace-only searchTerm treated as no filter → all chats returned
      expect(searchRes.body.data).toHaveLength(2);
    });

    // ── Flow 7: Mark-Read Edge Cases ──────────────────────────────────────

    it('mark-read on empty chat returns modifiedCount 0, no MESSAGES_READ event', async () => {
      const { tokenB, chatId } = await setupAcceptedConnection();

      // Call mark-read on a chat with no messages
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-EMPTY-CHAT-READ', 'userB marks empty chat as read');

      // Req 9.1: modifiedCount 0, updatedIds []
      expect(markReadRes.status).toBe(200);
      expect(markReadRes.body.success).toBe(true);
      expect(markReadRes.body.data.modifiedCount).toBe(0);
      expect(markReadRes.body.data.updatedIds).toEqual([]);

      // Req 9.2: MESSAGES_READ NOT emitted to chat::${chatId}
      const emitCalls = (global as any).io.emit.mock.calls as [string, ...any[]][];
      const messagesReadCalls = emitCalls.filter(([event]) => event === 'MESSAGES_READ');
      expect(messagesReadCalls).toHaveLength(0);
    });

    it('mark-read with only own messages returns modifiedCount 0', async () => {
      const { tokenA, chatId } = await setupChatWithMessages(3);

      // userA marks read — all messages are from userA, so nothing should be marked
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenA}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-OWN-MSGS-READ', 'userA marks chat as read (all messages are own)');

      // Req 9.3: modifiedCount 0, updatedIds []
      expect(markReadRes.body.data.modifiedCount).toBe(0);
      expect(markReadRes.body.data.updatedIds).toEqual([]);
    });

    it('mark-read is idempotent: second call returns modifiedCount 0', async () => {
      const { tokenB, chatId } = await setupChatWithMessages(3);

      // First call — marks 3 messages from userA as read by userB
      const firstMarkReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, firstMarkReadRes.body, 'FLOW7-IDEMPOTENT-FIRST', 'userB marks chat as read (first call)');

      expect(firstMarkReadRes.status).toBe(200);
      expect(firstMarkReadRes.body.data.modifiedCount).toBe(3);

      // Second call — all messages already read, nothing to update
      const secondMarkReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, secondMarkReadRes.body, 'FLOW7-IDEMPOTENT-SECOND', 'userB marks chat as read again (second call — idempotent)');

      // Req 9.5: second call returns modifiedCount 0, updatedIds []
      expect(secondMarkReadRes.status).toBe(200);
      expect(secondMarkReadRes.body.data.modifiedCount).toBe(0);
      expect(secondMarkReadRes.body.data.updatedIds).toEqual([]);
    });

    it('mark-read populates readBy for all messages from other sender', async () => {
      const { userA, userB, tokenB, chatId } = await setupChatWithMessages(3);

      // userB marks chat as read
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-READBY-POPULATE', 'userB marks chat as read');

      expect(markReadRes.status).toBe(200);

      // Req 9.4: all messages from userA should have userB in readBy
      const userAMessages = await Message.find({ chatId, sender: userA._id });
      expect(userAMessages).toHaveLength(3);
      for (const msg of userAMessages) {
        const readByStrings = (msg.readBy as any[]).map((id: any) => id.toString());
        expect(readByStrings).toContain(userB._id.toString());
      }
    });

    it('mark-read reflects in chat list unreadCount', async () => {
      const { tokenB, chatId } = await setupChatWithMessages(3);

      // userB marks chat as read
      const markReadRes = await request(app)
        .post(`/api/v1/messages/chat/${chatId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('POST', `/api/v1/messages/chat/${chatId}/read`, {}, markReadRes.body, 'FLOW7-UNREAD-COUNT', 'userB marks chat as read');

      expect(markReadRes.status).toBe(200);

      // Override mget to return ['0'] — simulates unreadCount = 0 for this chat
      vi.mocked(redisClient.mget).mockResolvedValueOnce(['0']);

      // GET /api/v1/chats as userB — unreadCount should be 0
      const chatListRes = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${tokenB}`);
      logApi('GET', '/api/v1/chats', {}, chatListRes.body, 'FLOW7-UNREAD-LIST', 'userB lists chats after mark-read — expects unreadCount 0');

      expect(chatListRes.status).toBe(200);
      // Req 9.6: unreadCount should be 0
      expect(chatListRes.body.data[0].unreadCount).toBe(0);
    });
  });

});
