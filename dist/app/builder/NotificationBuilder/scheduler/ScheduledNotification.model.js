"use strict";
/**
 * ScheduledNotification Model
 *
 * MongoDB model for storing scheduled notifications.
 * The scheduler service processes these at the scheduled time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
// ==================== SCHEMA ====================
const ScheduledNotificationSchema = new mongoose_1.Schema({
    // Recipients - array of user IDs
    recipients: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }],
    // Template-based content
    template: {
        type: String,
    },
    variables: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    // Manual content
    title: {
        type: String,
    },
    text: {
        type: String,
    },
    type: {
        type: String,
        enum: [
            'PREFERENCE_CARD_CREATED',
            'EVENT_SCHEDULED',
            'GENERAL',
            'ADMIN',
            'SYSTEM',
            'MESSAGE',
            'REMINDER',
        ],
        default: 'SYSTEM',
    },
    resourceType: {
        type: String,
    },
    resourceId: {
        type: String,
    },
    data: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    // Channels to send to
    channels: [{
            type: String,
            enum: ['push', 'socket', 'email', 'database'],
            required: true,
        }],
    // When to send
    scheduledFor: {
        type: Date,
        required: true,
        index: true,
    },
    // Current status
    status: {
        type: String,
        enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
        default: 'pending',
        index: true,
    },
    // Results after processing
    result: {
        sent: {
            push: Number,
            socket: Number,
            email: Number,
            database: Number,
        },
        failed: {
            push: [String],
            socket: [String],
            email: [String],
            database: [String],
        },
        processedAt: Date,
        error: String,
    },
    // Who created this scheduled notification
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});
// ==================== INDEXES ====================
// Compound index for finding due notifications efficiently
ScheduledNotificationSchema.index({ scheduledFor: 1, status: 1 }, { name: 'due_notifications_idx' });
// Index for finding user's scheduled notifications
ScheduledNotificationSchema.index({ recipients: 1, status: 1 }, { name: 'user_scheduled_idx' });
// ==================== MODEL ====================
const ScheduledNotification = (0, mongoose_1.model)('ScheduledNotification', ScheduledNotificationSchema);
exports.default = ScheduledNotification;
