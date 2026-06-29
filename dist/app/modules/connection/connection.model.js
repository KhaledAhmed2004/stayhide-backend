"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connection = void 0;
const mongoose_1 = require("mongoose");
const connection_constants_1 = require("./connection.constants");
const connectionSchema = new mongoose_1.Schema({
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiver: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    connectionKey: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: Object.values(connection_constants_1.CONNECTION_STATUS),
        default: connection_constants_1.CONNECTION_STATUS.PENDING,
    },
    chatId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Chat',
    },
    respondedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Deterministic unique index using connectionKey to prevent A->B and B->A race condition
connectionSchema.index({ connectionKey: 1 }, { unique: true });
// Indexes for fast pending request lookups
connectionSchema.index({ receiver: 1, status: 1 });
connectionSchema.index({ sender: 1, status: 1 });
exports.Connection = (0, mongoose_1.model)('Connection', connectionSchema);
