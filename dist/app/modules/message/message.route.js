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
exports.MessageRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const message_controller_1 = require("./message.controller");
const getFilePath_1 = require("../../../shared/getFilePath");
const fileUploadHandler_1 = __importDefault(require("../../middlewares/fileUploadHandler"));
const router = express_1.default.Router();
// ============ SEND & RETRIEVE MESSAGES ============
// Send a message with optional file attachments
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, fileUploadHandler_1.default)(), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        // Ensure these are always arrays
        const images = (_a = (0, getFilePath_1.getMultipleFilesPath)(req.files, 'image')) !== null && _a !== void 0 ? _a : [];
        const media = (_b = (0, getFilePath_1.getMultipleFilesPath)(req.files, 'media')) !== null && _b !== void 0 ? _b : [];
        const docs = (_c = (0, getFilePath_1.getMultipleFilesPath)(req.files, 'doc')) !== null && _c !== void 0 ? _c : [];
        let type = 'text';
        if (images.length && (req.body.text || media.length || docs.length)) {
            type = 'mixed';
        }
        else if (media.length &&
            (req.body.text || images.length || docs.length)) {
            type = 'mixed';
        }
        else if (docs.length &&
            (req.body.text || images.length || media.length)) {
            type = 'mixed';
        }
        else if (images.length) {
            type = 'image';
        }
        else if (media.length) {
            type = 'media';
        }
        else if (docs.length) {
            type = 'doc';
        }
        else if (req.body.text) {
            type = 'text';
        }
        const attachments = [
            ...images.map(u => ({ type: 'image', url: u, name: String(u).split('/').pop() })),
            ...media.map(u => {
                const lower = String(u).toLowerCase();
                const isVideo = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
                return { type: isVideo ? 'video' : 'audio', url: u, name: String(u).split('/').pop() };
            }),
            ...docs.map(u => ({ type: 'file', url: u, name: String(u).split('/').pop() })),
        ];
        req.body = Object.assign(Object.assign({}, req.body), { sender: (req === null || req === void 0 ? void 0 : req.user).id, attachments,
            type });
        next();
    }
    catch (error) {
        return res.status(500).json({ message: 'Invalid File Format' });
    }
}), message_controller_1.MessageController.sendMessage);
// ============ CHAT-LEVEL OPERATIONS ============
// Get all messages in a chat (alias route for frontend compatibility)
router.get('/chat/:chatId', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), message_controller_1.MessageController.getChatMessages);
// Mark all messages in a chat as read
router.post('/chat/:chatId/read', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), message_controller_1.MessageController.markChatRead);
exports.MessageRoutes = router;
