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
exports.socketHelper = void 0;
const colors_1 = __importDefault(require("colors"));
const logger_1 = require("../shared/logger");
const jwtHelper_1 = require("./jwtHelper");
const config_1 = __importDefault(require("../config"));
const redisClient_1 = require("../shared/redisClient");
const message_model_1 = require("../app/modules/message/message.model");
const chat_model_1 = require("../app/modules/chat/chat.model");
const support_ticket_model_1 = require("../app/modules/support-ticket/support-ticket.model");
const presenceHelper_1 = require("../app/helpers/presenceHelper");
// -------------------------
// 🔹 Room Name Generators
// -------------------------
// USER_ROOM: unique private room for each user (for personal notifications)
// CHAT_ROOM: group room for each chat conversation
const USER_ROOM = (userId) => `user::${userId}`;
const CHAT_ROOM = (chatId) => `chat::${chatId}`;
const TICKET_ROOM = (ticketId) => `ticket::${ticketId}`;
const ADMIN_TICKETS_ROOM = 'admin-tickets';
const TYPING_KEY = (chatId, userId) => `typing:${chatId}:${userId}`;
const TYPING_TTL_SECONDS = 5; // throttle window
// -------------------------
// 🔹 Rate Limiting Helper (Req 12)
// -------------------------
/**
 * Increments the rate-limit counter for an event+user pair.
 * Returns true if the limit has been exceeded (caller should reject).
 * Fails open on Redis errors — logs the error and allows the request through.
 */
const isRateLimited = (event, userId, limit, windowSeconds) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const key = `ratelimit:${event}:${userId}`;
        const count = yield redisClient_1.redisClient.incr(key);
        if (count === 1) {
            // First increment — set TTL for the window
            yield redisClient_1.redisClient.expire(key, windowSeconds);
        }
        return count > limit;
    }
    catch (err) {
        logger_1.errorLogger.error(`isRateLimited: Redis error for event=${event} user=${userId}: ${String(err)}`);
        return false; // fail open
    }
});
// -------------------------
// 🔹 Main Socket Handler
// -------------------------
const socket = (io) => {
    io.on('connection', (socket) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            // -----------------------------
            // 🧩 STEP 1 — Authenticate Socket
            // -----------------------------
            const token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) ||
                ((_b = socket.handshake.query) === null || _b === void 0 ? void 0 : _b.token);
            if (!token || typeof token !== 'string') {
                logger_1.logger.warn(colors_1.default.yellow('Socket connection without token. Disconnecting.'));
                return socket.disconnect(true);
            }
            let payload;
            try {
                payload = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
            }
            catch (err) {
                logger_1.logger.warn(colors_1.default.red('Invalid JWT on socket connection. Disconnecting.'));
                return socket.disconnect(true);
            }
            const userId = payload === null || payload === void 0 ? void 0 : payload.id;
            if (!userId) {
                logger_1.logger.warn(colors_1.default.red('JWT payload missing id. Disconnecting.'));
                return socket.disconnect(true);
            }
            // -----------------------------
            // 🧩 STEP 2 — Mark Online & Join Personal Room
            // -----------------------------
            yield (0, presenceHelper_1.setOnline)(userId);
            yield (0, presenceHelper_1.incrConnCount)(userId);
            yield (0, presenceHelper_1.updateLastActive)(userId);
            socket.join(USER_ROOM(userId)); // join user's personal private room
            logger_1.logger.info(`✅ User ${userId} connected & joined ${USER_ROOM(userId)}`);
            logger_1.logger.info(`🔔 Event processed: socket_connected for user_id: ${userId}`);
            // Admins auto-join the global support-ticket broadcast room so they
            // receive TICKET_CREATED/TICKET_REPLY events without needing to
            // subscribe per-ticket. Per-ticket rooms (ticket::{id}) are still
            // joined on demand via JOIN_TICKET for the detail view.
            const role = payload === null || payload === void 0 ? void 0 : payload.role;
            if (role === 'SUPER_ADMIN') {
                socket.join(ADMIN_TICKETS_ROOM);
            }
            // ---------------------------------------------
            // 🔹 Chat Room Join / Leave Events
            // ---------------------------------------------
            socket.on('JOIN_CHAT', (_a) => __awaiter(void 0, [_a], void 0, function* ({ chatId }) {
                // Requirement 8.2: ignore event if chatId is absent or empty string
                if (!chatId)
                    return;
                // Req 7: participant authorization
                const isParticipant = yield chat_model_1.Chat.exists({ _id: chatId, participants: userId });
                if (!isParticipant) {
                    socket.emit('ACK_ERROR', {
                        message: 'You are not a participant of this chat',
                        chatId,
                    });
                    return;
                }
                // Write active:{userId}:chat = chatId with 3600-second TTL (Requirement 8.1)
                try {
                    yield redisClient_1.redisClient.set(`active:${userId}:chat`, chatId, 'EX', 3600);
                }
                catch (err) {
                    logger_1.errorLogger.error(colors_1.default.red(`JOIN_CHAT: failed to write active-chat key for user ${userId}: ${String(err)}`));
                }
                // Join the socket room for this chat
                socket.join(CHAT_ROOM(chatId));
                yield (0, presenceHelper_1.addUserRoom)(userId, chatId);
                (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                logger_1.logger.info(`🔔 Event processed: JOIN_CHAT for chat_id: ${chatId}`);
                // Broadcast to others in the chat that this user is now online
                const lastActive = yield (0, presenceHelper_1.getLastActive)(userId);
                io.to(CHAT_ROOM(chatId)).emit('USER_ONLINE', {
                    userId,
                    chatId,
                    lastActive,
                });
                logger_1.logger.info(`User ${userId} joined chat room ${CHAT_ROOM(chatId)}`);
            }));
            socket.on('LEAVE_CHAT', (_a) => __awaiter(void 0, [_a], void 0, function* ({ chatId }) {
                if (!chatId)
                    return;
                // Delete active:{userId}:chat from Redis (Requirement 8.3)
                try {
                    yield redisClient_1.redisClient.del(`active:${userId}:chat`);
                }
                catch (err) {
                    logger_1.errorLogger.error(colors_1.default.red(`LEAVE_CHAT: failed to delete active-chat key for user ${userId}: ${String(err)}`));
                }
                socket.leave(CHAT_ROOM(chatId));
                yield (0, presenceHelper_1.removeUserRoom)(userId, chatId);
                (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                logger_1.logger.info(`🔔 Event processed: LEAVE_CHAT for chat_id: ${chatId}`);
                // Notify others that user went offline in this chat
                const lastActive = yield (0, presenceHelper_1.getLastActive)(userId);
                io.to(CHAT_ROOM(chatId)).emit('USER_OFFLINE', {
                    userId,
                    chatId,
                    lastActive,
                });
                logger_1.logger.info(colors_1.default.yellow(`User ${userId} left chat room ${CHAT_ROOM(chatId)}`));
            }));
            // ---------------------------------------------
            // 🔹 Support Ticket Room Join / Leave Events
            // ---------------------------------------------
            socket.on('JOIN_TICKET', (_a) => __awaiter(void 0, [_a], void 0, function* ({ ticketId }) {
                if (!ticketId)
                    return;
                try {
                    const ticket = yield support_ticket_model_1.SupportTicket.findById(ticketId).select('_id userId');
                    if (!ticket) {
                        socket.emit('ACK_ERROR', {
                            message: 'Ticket not found',
                            ticketId: String(ticketId),
                        });
                        (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                        logger_1.logger.info(`🔔 Event processed: JOIN_TICKET_DENIED not_found ticket_id: ${ticketId}`);
                        return;
                    }
                    const isAdmin = role === 'SUPER_ADMIN';
                    const isOwner = String(ticket.userId) === String(userId);
                    if (!isAdmin && !isOwner) {
                        socket.emit('ACK_ERROR', {
                            message: 'You do not have access to this ticket',
                            ticketId: String(ticketId),
                        });
                        (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                        logger_1.logger.info(`🔔 Event processed: JOIN_TICKET_DENIED forbidden ticket_id: ${ticketId}`);
                        return;
                    }
                    socket.join(TICKET_ROOM(String(ticketId)));
                    (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                    logger_1.logger.info(`🔔 Event processed: JOIN_TICKET for ticket_id: ${ticketId}`);
                }
                catch (err) {
                    logger_1.logger.error(colors_1.default.red(`JOIN_TICKET error: ${String(err)}`));
                }
            }));
            socket.on('LEAVE_TICKET', (_a) => __awaiter(void 0, [_a], void 0, function* ({ ticketId }) {
                if (!ticketId)
                    return;
                socket.leave(TICKET_ROOM(String(ticketId)));
                (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                logger_1.logger.info(`🔔 Event processed: LEAVE_TICKET for ticket_id: ${ticketId}`);
            }));
            // ---------------------------------------------
            // 🔹 Typing Indicators
            // ---------------------------------------------
            socket.on('TYPING_START', (_a) => __awaiter(void 0, [_a], void 0, function* ({ chatId }) {
                if (!chatId)
                    return;
                // Req 12: rate limit TYPING_START (60 per 60s)
                if (yield isRateLimited('TYPING_START', userId, 60, 60)) {
                    socket.emit('ACK_ERROR', { message: 'Rate limit exceeded', event: 'TYPING_START' });
                    return;
                }
                // Guard: Only participants can emit typing events for a chat
                const allowed = yield chat_model_1.Chat.exists({ _id: chatId, participants: userId });
                if (!allowed) {
                    (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                    logger_1.logger.info(`🔔 Event processed: TYPING_START_DENIED for chat_id: ${chatId}`);
                    return;
                }
                // Req 2: Throttle typing events per user per chat using Redis SET NX
                const key = TYPING_KEY(chatId, userId);
                const acquired = yield redisClient_1.redisClient.set(key, '1', 'EX', TYPING_TTL_SECONDS, 'NX');
                if (acquired === null) {
                    // Already throttled — suppress broadcast
                    (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                    logger_1.logger.info(`🔔 Event processed: TYPING_START_THROTTLED_SKIP for chat_id: ${chatId}`);
                    return;
                }
                io.to(CHAT_ROOM(chatId)).emit('TYPING_START', { userId, chatId });
                (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                logger_1.logger.info(`🔔 Event processed: TYPING_START for chat_id: ${chatId}`);
            }));
            socket.on('TYPING_STOP', (_a) => __awaiter(void 0, [_a], void 0, function* ({ chatId }) {
                if (!chatId)
                    return;
                // Guard: Only participants can emit typing stop events
                const allowed = yield chat_model_1.Chat.exists({ _id: chatId, participants: userId });
                if (!allowed) {
                    (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                    logger_1.logger.info(`🔔 Event processed: TYPING_STOP_DENIED for chat_id: ${chatId}`);
                    return;
                }
                // Req 2.5: Clear throttle key so next start can emit immediately
                yield redisClient_1.redisClient.del(TYPING_KEY(chatId, userId));
                io.to(CHAT_ROOM(chatId)).emit('TYPING_STOP', { userId, chatId });
                (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                logger_1.logger.info(`🔔 Event processed: TYPING_STOP for chat_id: ${chatId}`);
            }));
            // ---------------------------------------------
            // 🔹 Message Delivery & Read Acknowledgements
            // ---------------------------------------------
            socket.on('DELIVERED_ACK', (_a) => __awaiter(void 0, [_a], void 0, function* ({ messageId }) {
                try {
                    const found = yield message_model_1.Message.findById(messageId).select('_id chatId');
                    if (!found) {
                        socket.emit('ACK_ERROR', {
                            message: 'Message not found',
                            messageId,
                        });
                        return;
                    }
                    const allowed = yield chat_model_1.Chat.exists({ _id: found.chatId, participants: userId });
                    if (!allowed) {
                        socket.emit('ACK_ERROR', {
                            message: 'You are not a participant of this chat',
                            chatId: String(found.chatId),
                            messageId: String(found._id),
                        });
                        (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                        logger_1.logger.info(`🔔 Event processed: DELIVERED_ACK_DENIED chat_id: ${String(found.chatId)}`);
                        return;
                    }
                    // Req 5: emit MESSAGE_DELIVERED without any DB write
                    io.to(CHAT_ROOM(String(found.chatId))).emit('MESSAGE_DELIVERED', {
                        messageId: String(found._id),
                        chatId: String(found.chatId),
                        userId,
                    });
                    (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                    logger_1.logger.info(`🔔 Event processed: DELIVERED_ACK for message_id: ${String(found._id)}`);
                }
                catch (err) {
                    logger_1.logger.error(colors_1.default.red(`❌ DELIVERED_ACK error: ${String(err)}`));
                }
            }));
            socket.on('READ_ACK', (_a) => __awaiter(void 0, [_a], void 0, function* ({ messageId }) {
                try {
                    // Req 12: rate limit READ_ACK (60 per 60s)
                    if (yield isRateLimited('READ_ACK', userId, 60, 60)) {
                        socket.emit('ACK_ERROR', { message: 'Rate limit exceeded', event: 'READ_ACK' });
                        return;
                    }
                    const found = yield message_model_1.Message.findById(messageId).select('_id chatId');
                    if (!found) {
                        socket.emit('ACK_ERROR', {
                            message: 'Message not found',
                            messageId,
                        });
                        return;
                    }
                    const allowed = yield chat_model_1.Chat.exists({ _id: found.chatId, participants: userId });
                    if (!allowed) {
                        socket.emit('ACK_ERROR', {
                            message: 'You are not a participant of this chat',
                            chatId: String(found.chatId),
                            messageId: String(found._id),
                        });
                        (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                        logger_1.logger.info(`🔔 Event processed: READ_ACK_DENIED chat_id: ${String(found.chatId)}`);
                        return;
                    }
                    const msg = yield message_model_1.Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: userId } }, { new: true });
                    if (msg) {
                        // Req 8: emit MESSAGES_READ (plural) with correct payload shape
                        io.to(CHAT_ROOM(String(msg.chatId))).emit('MESSAGES_READ', {
                            chatId: String(msg.chatId),
                            userId,
                            updatedIds: [String(msg._id)],
                        });
                        (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                        logger_1.logger.info(`🔔 Event processed: READ_ACK for message_id: ${String(msg._id)}`);
                    }
                }
                catch (err) {
                    logger_1.logger.error(colors_1.default.red(`❌ READ_ACK error: ${String(err)}`));
                }
            }));
            // ---------------------------------------------
            // 🔹 Handle Disconnect Event
            // ---------------------------------------------
            socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    yield (0, presenceHelper_1.updateLastActive)(userId);
                    const remaining = yield (0, presenceHelper_1.decrConnCount)(userId);
                    const lastActive = yield (0, presenceHelper_1.getLastActive)(userId);
                    // Delete active:{userId}:chat from Redis on disconnect (Requirement 8.4)
                    try {
                        yield redisClient_1.redisClient.del(`active:${userId}:chat`);
                    }
                    catch (err) {
                        logger_1.errorLogger.error(colors_1.default.red(`disconnect: failed to delete active-chat key for user ${userId}: ${String(err)}`));
                    }
                    // Only mark offline and broadcast if no other sessions remain
                    if (!remaining || remaining <= 0) {
                        yield (0, presenceHelper_1.setOffline)(userId);
                        // Notify all chat rooms this user participated in
                        try {
                            const rooms = yield (0, presenceHelper_1.getUserRooms)(userId);
                            for (const chatId of rooms || []) {
                                io.to(CHAT_ROOM(String(chatId))).emit('USER_OFFLINE', {
                                    userId,
                                    chatId: String(chatId),
                                    lastActive,
                                });
                            }
                            yield (0, presenceHelper_1.clearUserRooms)(userId);
                        }
                        catch (_a) { }
                    }
                    else {
                        logger_1.logger.info(colors_1.default.yellow(`User ${userId} disconnected one session; ${remaining} session(s) remain.`));
                    }
                    logger_1.logger.info(colors_1.default.red(`User ${userId} disconnected`));
                    logger_1.logger.info(`🔔 Event processed: socket_disconnected for user_id: ${userId}`);
                }
                catch (err) {
                    logger_1.logger.error(colors_1.default.red(`❌ Disconnect handling error: ${String(err)}`));
                }
            }));
        }
        catch (err) {
            logger_1.logger.error(colors_1.default.red(`Socket connection error: ${String(err)}`));
            try {
                socket.disconnect(true);
            }
            catch (_c) { }
        }
    }));
};
exports.socketHelper = { socket };
