"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentNotification = void 0;
const mongoose_1 = require("mongoose");
const sentNotificationSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true },
    audience: {
        type: String,
        required: true,
    },
    recipientCount: { type: Number, required: true },
}, { timestamps: true });
sentNotificationSchema.index({ createdAt: -1 });
exports.SentNotification = (0, mongoose_1.model)('SentNotification', sentNotificationSchema);
