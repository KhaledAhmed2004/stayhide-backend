"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceToken = void 0;
const mongoose_1 = require("mongoose");
const DeviceTokenSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    token: { type: String, required: false },
    tokenHash: { type: String, required: true },
    tokenPrefix: { type: String, required: false },
    platform: { type: String, enum: ['ios', 'android', 'web'] },
    appVersion: { type: String },
    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt: { type: Date, default: () => new Date() },
    lastSeenIpHash: { type: String, required: false },
    lastSeenCity: { type: String, required: false },
    userAgent: { type: String, required: false },
}, {
    timestamps: true,
});
// Fast lookup for sending push notifications.
DeviceTokenSchema.index({ user: 1 });
// Guarantees a physical device token only belongs to one user at a time
DeviceTokenSchema.index({ tokenHash: 1 }, { unique: true });
exports.DeviceToken = (0, mongoose_1.model)('DeviceToken', DeviceTokenSchema);
