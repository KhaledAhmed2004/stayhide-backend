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
exports.ConnectionService = void 0;
const http_status_codes_1 = require("http-status-codes");
const connection_utils_1 = require("./connection.utils");
const connection_constants_1 = require("./connection.constants");
const config_1 = __importDefault(require("../../../config"));
const mongoose_1 = __importDefault(require("mongoose"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_model_1 = require("../user/user.model");
const connection_model_1 = require("./connection.model");
const chat_service_1 = require("../chat/chat.service");
const user_1 = require("../../../enums/user");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const notificationsHelper_1 = require("../notification/notificationsHelper");
const sendConnectionRequest = (senderId, receiverId) => __awaiter(void 0, void 0, void 0, function* () {
    if (senderId === receiverId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You cannot connect with yourself');
    }
    const sender = yield user_model_1.User.findById(senderId);
    if (!sender || sender.status !== user_1.USER_STATUS.ACTIVE) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Sender not found or inactive');
    }
    const receiver = yield user_model_1.User.findById(receiverId);
    if (!receiver || receiver.status !== user_1.USER_STATUS.ACTIVE) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Receiver not found or inactive');
    }
    if (sender.role !== receiver.role) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `A ${sender.role.toLowerCase()} can only connect with another ${sender.role.toLowerCase()}`);
    }
    // Check pending limit to prevent spam
    const pendingCount = yield connection_model_1.Connection.countDocuments({ sender: senderId, status: connection_constants_1.CONNECTION_STATUS.PENDING });
    const maxRequests = config_1.default.connection.max_pending_requests;
    if (pendingCount >= maxRequests) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.TOO_MANY_REQUESTS, `You have reached the maximum number of pending requests (${maxRequests})`);
    }
    // Generate deterministic connectionKey to prevent A->B and B->A race condition
    const connectionKey = (0, connection_utils_1.generateConnectionKey)(senderId, receiverId);
    // Check if connection already exists (either direction) using connectionKey
    const existingConnection = yield connection_model_1.Connection.findOne({ connectionKey });
    if (existingConnection) {
        if (existingConnection.status === connection_constants_1.CONNECTION_STATUS.ACCEPTED) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'You are already connected with this user');
        }
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Connection request already exists');
    }
    const connection = yield connection_model_1.Connection.create({
        sender: senderId,
        receiver: receiverId,
        connectionKey,
        status: connection_constants_1.CONNECTION_STATUS.PENDING,
    });
    const senderUser = sender;
    // Send in-app notification & push/socket
    yield (0, notificationsHelper_1.sendNotifications)({
        receiver: new mongoose_1.default.Types.ObjectId(receiverId),
        type: 'CONNECTION_REQUEST',
        title: 'New Connection Request',
        text: `${senderUser.name} wants to connect`,
        resourceType: 'User',
        resourceId: senderId,
        schemaVersion: 1,
        metadata: {
            actor: {
                id: senderUser._id.toString(),
                name: senderUser.name,
                profileImage: senderUser.profileImage,
            },
            subject: {
                type: 'Connection',
                id: connection._id.toString(),
            },
            actions: [
                { type: 'ACCEPT' },
                { type: 'REJECT' },
                { type: 'VIEW_PROFILE' },
            ],
        },
    });
    // @ts-ignore
    const io = global.io;
    if (io) {
        io.to(`user::${receiverId}`).emit('CONNECTION_REQUEST', {
            connectionId: connection._id,
            sender: senderUser,
        });
    }
    return {
        id: connection._id,
        status: connection.status,
        receiver: {
            id: receiver._id,
            name: receiver.name,
            profileImage: receiver.profileImage,
        },
    };
});
const respondToConnectionRequest = (connectionId, userId, action) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const connection = yield connection_model_1.Connection.findById(connectionId).session(session);
        if (!connection) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Connection request not found');
        }
        if (String(connection.receiver) !== userId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the receiver can respond to this request');
        }
        if (connection.status !== connection_constants_1.CONNECTION_STATUS.PENDING) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This request is no longer pending');
        }
        // @ts-ignore
        const io = global.io;
        if (action === connection_constants_1.CONNECTION_ACTION.REJECTED) {
            // Delete the connection
            yield connection_model_1.Connection.findByIdAndDelete(connectionId).session(session);
            yield session.commitTransaction();
            if (io) {
                io.to(`user::${String(connection.sender)}`).emit('CONNECTION_REJECTED', {
                    connectionId: connection._id,
                });
            }
            // Return the processed id with a 'NONE' status so the client can
            // immediately update its local cache without a second request.
            return { id: connection._id, status: 'NONE' };
        }
        // Action is ACCEPT
        const participants = [String(connection.sender), String(connection.receiver)];
        // Create or get chat using ChatService
        const chat = yield chat_service_1.ChatService.createOrGet(participants[0], participants[1]);
        connection.status = connection_constants_1.CONNECTION_STATUS.ACCEPTED;
        connection.chatId = chat._id;
        connection.respondedAt = new Date();
        yield connection.save({ session });
        yield session.commitTransaction();
        const receiverUser = yield user_model_1.User.findById(userId).select('name profileImage');
        // Notify sender
        yield (0, notificationsHelper_1.sendNotifications)({
            receiver: new mongoose_1.default.Types.ObjectId(String(connection.sender)),
            type: 'CONNECTION_ACCEPTED',
            title: 'Connection Accepted',
            text: `${receiverUser === null || receiverUser === void 0 ? void 0 : receiverUser.name} accepted your connection request`,
            resourceType: 'User',
            resourceId: userId,
            schemaVersion: 1,
            metadata: {
                actor: {
                    id: receiverUser === null || receiverUser === void 0 ? void 0 : receiverUser._id.toString(),
                    name: receiverUser === null || receiverUser === void 0 ? void 0 : receiverUser.name,
                    profileImage: receiverUser === null || receiverUser === void 0 ? void 0 : receiverUser.profileImage,
                },
                subject: {
                    type: 'Connection',
                    id: connectionId,
                    chatId: chat._id.toString(),
                },
                actions: [
                    { type: 'OPEN_CHAT' },
                    { type: 'VIEW_PROFILE' },
                ],
            },
        });
        if (io) {
            io.to(`user::${String(connection.sender)}`).emit('CONNECTION_ACCEPTED', {
                connectionId: connection._id,
                chatId: chat._id,
                user: receiverUser,
            });
        }
        return {
            id: connection._id,
            status: connection.status,
            chatId: connection.chatId,
        };
    }
    catch (error) {
        yield session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
const cancelConnectionRequest = (connectionId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield connection_model_1.Connection.findById(connectionId);
    if (!connection) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Connection request not found');
    }
    if (String(connection.sender) !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the sender can cancel this request');
    }
    if (connection.status !== connection_constants_1.CONNECTION_STATUS.PENDING) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This request is no longer pending');
    }
    yield connection_model_1.Connection.findByIdAndDelete(connectionId);
    // Return the processed id with a 'NONE' status so the client can
    // immediately update its local cache without a second request.
    return { id: connection._id, status: 'NONE' };
});
const removeConnection = (connectionId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const connection = yield connection_model_1.Connection.findById(connectionId).session(session);
        if (!connection) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Connection not found');
        }
        if (String(connection.sender) !== userId && String(connection.receiver) !== userId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this connection');
        }
        if (connection.status !== connection_constants_1.CONNECTION_STATUS.ACCEPTED) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You can only remove an accepted connection');
        }
        const otherUserId = String(connection.sender) === userId ? String(connection.receiver) : String(connection.sender);
        yield connection_model_1.Connection.findByIdAndDelete(connectionId).session(session);
        yield session.commitTransaction();
        // @ts-ignore
        const io = global.io;
        if (io) {
            io.to(`user::${otherUserId}`).emit('CONNECTION_REMOVED', {
                connectionId: connection._id,
                chatId: connection.chatId,
            });
        }
        // Return the processed id with a 'NONE' status so the client can
        // immediately update its local cache without a second request.
        return { id: connection._id, status: 'NONE' };
    }
    catch (error) {
        yield session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
const getMyConnections = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const connectionQuery = new QueryBuilder_1.default(connection_model_1.Connection.find({
        $or: [{ sender: userId }, { receiver: userId }],
        status: connection_constants_1.CONNECTION_STATUS.ACCEPTED,
    }).populate([
        { path: 'sender', select: 'name profileImage' },
        { path: 'receiver', select: 'name profileImage' }
    ]), query)
        .filter()
        .sort()
        .fields();
    const { data, meta } = yield connectionQuery.cursorPaginate('_id');
    // Format data to expose "connectedUser" instead of sender/receiver to make it easier for frontend
    const formattedData = data.map((conn) => {
        const isSender = String(conn.sender._id) === userId;
        return {
            _id: conn._id,
            status: conn.status,
            chatId: conn.chatId,
            createdAt: conn.createdAt,
            connectedUser: isSender ? {
                id: conn.receiver._id,
                name: conn.receiver.name,
                profileImage: conn.receiver.profileImage,
            } : {
                id: conn.sender._id,
                name: conn.sender.name,
                profileImage: conn.sender.profileImage,
            },
        };
    });
    return {
        data: formattedData,
        pagination: meta,
    };
});
const getPendingConnectionRequests = (userId, direction, query) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = direction === 'sent' ? { sender: userId, status: connection_constants_1.CONNECTION_STATUS.PENDING } : { receiver: userId, status: connection_constants_1.CONNECTION_STATUS.PENDING };
    const populateField = direction === 'sent' ? 'receiver' : 'sender';
    const connectionQuery = new QueryBuilder_1.default(connection_model_1.Connection.find(filter).populate({ path: populateField, select: 'name profileImage role' }), query)
        .filter()
        .sort()
        .fields();
    const { data, meta } = yield connectionQuery.cursorPaginate('_id');
    const formattedData = data.map((conn) => {
        if (direction === 'sent') {
            return {
                connectionId: conn._id,
                receiver: conn.receiver ? {
                    id: conn.receiver._id,
                    name: conn.receiver.name,
                    profileImage: conn.receiver.profileImage,
                } : null,
                status: conn.status,
                createdAt: conn.createdAt,
            };
        }
        else {
            return {
                connectionId: conn._id,
                sender: conn.sender ? {
                    id: conn.sender._id,
                    name: conn.sender.name,
                    profileImage: conn.sender.profileImage,
                } : null,
                status: conn.status,
                createdAt: conn.createdAt,
            };
        }
    });
    return {
        data: formattedData,
        pagination: meta,
    };
});
exports.ConnectionService = {
    sendConnectionRequest,
    respondToConnectionRequest,
    cancelConnectionRequest,
    removeConnection,
    getMyConnections,
    getPendingConnectionRequests,
};
