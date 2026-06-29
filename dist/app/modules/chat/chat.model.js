"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = void 0;
const mongoose_1 = require("mongoose");
const lastMessageSchema = new mongoose_1.Schema({
    text: { type: String, maxlength: 2000 },
    sender: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, required: true },
}, { _id: false });
const chatSchema = new mongoose_1.Schema({
    participants: {
        type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
        validate: {
            validator: (v) => v.length === 2,
            message: 'Chat must have exactly 2 participants',
        },
    },
    lastMessage: { type: lastMessageSchema, default: null },
}, { timestamps: true });
chatSchema.index({ participants: 1 });
exports.Chat = (0, mongoose_1.model)('Chat', chatSchema);
