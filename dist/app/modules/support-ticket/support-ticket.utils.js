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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidStatusTransition = exports.buildAttachmentsFromBody = exports.generateTicketNumber = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CounterSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: Number, default: 1000 },
});
const Counter = mongoose_1.default.models.SupportTicketCounter ||
    (0, mongoose_1.model)('SupportTicketCounter', CounterSchema);
const TICKET_COUNTER_KEY = 'support_ticket';
const generateTicketNumber = () => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield Counter.findOneAndUpdate({ key: TICKET_COUNTER_KEY }, { $inc: { value: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `TCK-${doc.value}`;
});
exports.generateTicketNumber = generateTicketNumber;
// Map fileHandler output (req.body[fieldName] = url | url[]) into the
// typed attachment shape the model stores. fileHandler resolves images
// under /images, audio+video under /media, and PDFs under /documents,
// so we infer the attachment type from the URL extension. We deliberately
// don't read MIME from req.files because fileHandler doesn't pass that
// downstream in a stable shape.
const guessTypeFromUrl = (url) => {
    const lower = url.toLowerCase();
    if (/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/.test(lower))
        return 'image';
    if (/\.(mp4|webm|mov)(\?.*)?$/.test(lower))
        return 'video';
    if (/\.(mp3|wav|ogg|m4a)(\?.*)?$/.test(lower))
        return 'audio';
    return 'file';
};
const filenameFromUrl = (url) => {
    const segs = url.split('?')[0].split('/');
    return segs[segs.length - 1] || undefined;
};
const buildAttachmentsFromBody = (raw) => {
    if (!raw)
        return [];
    const urls = Array.isArray(raw) ? raw : [raw];
    return urls
        .filter((u) => typeof u === 'string' && u.length > 0)
        .map(url => ({
        type: guessTypeFromUrl(url),
        url,
        name: filenameFromUrl(url),
    }));
};
exports.buildAttachmentsFromBody = buildAttachmentsFromBody;
const ALLOWED_TRANSITIONS = {
    OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
    RESOLVED: ['CLOSED', 'REOPENED'],
    REOPENED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    CLOSED: ['REOPENED'],
};
const isValidStatusTransition = (from, to) => {
    if (from === to)
        return false;
    return (ALLOWED_TRANSITIONS[from] || []).includes(to);
};
exports.isValidStatusTransition = isValidStatusTransition;
