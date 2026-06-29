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
exports.MessageController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const message_service_1 = require("./message.service");
// POST /api/v1/messages
// Requirements: 5.1 — send wired to HTTP route
const sendMessage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { chatId, text, type, attachments } = req.body;
    const message = yield message_service_1.MessageService.send(chatId, user.id, {
        text,
        type,
        attachments,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Message sent successfully',
        data: message,
    });
}));
// GET /api/v1/messages/chat/:chatId
// Requirements: 6.1 — getHistory wired to HTTP route
const getChatMessages = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const chatId = req.params.chatId;
    const cursor = req.query.cursor;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const result = yield message_service_1.MessageService.getHistory(chatId, user.id, cursor, limit);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Chat messages retrieved successfully',
        data: result.messages,
        meta: result.pagination,
    });
}));
// POST /api/v1/messages/chat/:chatId/read
// Requirements: 7.1 — markRead wired to HTTP route
const markChatRead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const chatId = req.params.chatId;
    const result = yield message_service_1.MessageService.markRead(chatId, user.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Chat messages marked as read',
        data: result,
    });
}));
exports.MessageController = { sendMessage, getChatMessages, markChatRead };
