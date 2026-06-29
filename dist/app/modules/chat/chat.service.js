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
exports.ChatService = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = __importDefault(require("mongoose"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_model_1 = require("../user/user.model");
const chat_model_1 = require("./chat.model");
const unreadHelper_1 = require("../../helpers/unreadHelper");
const logger_1 = require("../../../shared/logger");
const createOrGet = (userId, otherUserId) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate both IDs as valid ObjectIds
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid userId');
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(otherUserId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid otherUserId');
    }
    // Prevent self-chat
    if (userId === otherUserId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Cannot create a chat with yourself');
    }
    // Verify otherUserId exists in the User collection
    const otherUserExists = yield user_model_1.User.exists({ _id: otherUserId });
    if (!otherUserExists) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    // Find existing chat or create a new one
    let chat = yield chat_model_1.Chat.findOne({
        participants: { $all: [userId, otherUserId] },
    });
    if (!chat) {
        chat = yield chat_model_1.Chat.create({ participants: [userId, otherUserId] });
    }
    // Populate participants
    yield chat.populate('participants', '_id name profileImage role');
    return chat.toObject();
});
const getList = (userId, searchTerm) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate userId as a valid ObjectId (throw 400 if invalid)
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid userId');
    }
    // Single Chat.find with explicit populate and DB-side sort (Req 10)
    const chats = yield chat_model_1.Chat.find({ participants: userId })
        .sort({ 'lastMessage.createdAt': -1 })
        .populate('participants', '_id name profileImage role')
        .lean();
    // Return empty array when no chats found
    if (!chats || chats.length === 0) {
        return [];
    }
    // Apply optional case-insensitive search filter on the other participant's name (in JS after populate)
    let filteredChats = chats;
    if (searchTerm && searchTerm.trim().length > 0) {
        const searchRegex = new RegExp(searchTerm.trim(), 'i');
        filteredChats = chats.filter(chat => {
            var _a;
            const participants = chat.participants;
            const other = participants.find(p => String(p._id) !== String(userId));
            return other && searchRegex.test((_a = other.name) !== null && _a !== void 0 ? _a : '');
        });
    }
    // Batch-fetch all unread counts via single Redis MGET
    const pairs = filteredChats.map(chat => ({
        chatId: String(chat._id),
        userId: String(userId),
    }));
    let unreadCounts;
    try {
        unreadCounts = yield (0, unreadHelper_1.batchGetUnreadCounts)(pairs);
    }
    catch (err) {
        // Return 0 on any Redis error (log with errorLogger)
        logger_1.errorLogger.error('getList: Redis batchGetUnreadCounts failed', err);
        unreadCounts = filteredChats.map(() => 0);
    }
    // Attach unreadCount and strip the logged-in user from participants
    // so the response only contains the other person in the conversation
    return filteredChats.map((chat, index) => {
        var _a;
        const participants = chat.participants.filter(p => String(p._id) !== String(userId));
        return Object.assign(Object.assign({}, chat), { participants, unreadCount: (_a = unreadCounts[index]) !== null && _a !== void 0 ? _a : 0 });
    });
});
exports.ChatService = { createOrGet, getList };
