"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModel = exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const notification_interface_1 = require("./notification.interface");
const NotificationSchema = new mongoose_1.Schema({
    receiver: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: notification_interface_1.NOTIFICATION_TYPES,
        required: true,
    },
    title: { type: String, required: true },
    text: { type: String, required: true },
    // 0 = legacy flat notification, 1 = typed notification with actor/subject/actions in metadata
    schemaVersion: { type: Number, default: 0 },
    resourceType: { type: String },
    resourceId: { type: String },
    link: {
        label: { type: String },
        url: { type: String },
    },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    icon: { type: String },
}, { timestamps: true });
// Indexes for performance
NotificationSchema.index({ receiver: 1, createdAt: -1 });
NotificationSchema.index({ receiver: 1, isRead: 1 });
NotificationSchema.index({ resourceType: 1, resourceId: 1 });
exports.Notification = (0, mongoose_1.model)('Notification', NotificationSchema);
exports.NotificationModel = exports.Notification;
