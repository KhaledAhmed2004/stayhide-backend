"use strict";
/**
 * Push Channel - Firebase Cloud Messaging
 *
 * Sends push notifications via Firebase FCM to user devices.
 * Uses the existing pushNotificationHelper internally.
 */
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
exports.sendPush = void 0;
const pushNotificationHelper_1 = require("../../../modules/notification/pushNotificationHelper");
const device_token_model_1 = require("../../../modules/device-token/device-token.model");
/**
 * Send push notifications to users via Firebase FCM
 */
const sendPush = (users, content) => __awaiter(void 0, void 0, void 0, function* () {
    const result = { sent: 0, failed: [] };
    if (!users.length)
        return result;
    const userIds = users.map(u => u._id.toString());
    // TTL check: skip sending to tokens where lastSeenAt is older than 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const activeDeviceTokens = yield device_token_model_1.DeviceToken.find({
        user: { $in: userIds },
        lastSeenAt: { $gte: sixMonthsAgo }
    }).select('token user').lean();
    const validTokens = [];
    const usersWithTokens = new Set();
    for (const dt of activeDeviceTokens) {
        if (dt.token) {
            validTokens.push(dt.token);
            usersWithTokens.add(dt.user.toString());
        }
    }
    // Gracefully skip if no tokens are found (e.g., users exist but are logged out / no devices)
    if (validTokens.length === 0) {
        return { sent: users.length, failed: [] };
    }
    const message = {
        notification: {
            title: content.title,
            body: content.body,
        },
        tokens: validTokens, // FCM supports up to 500 tokens per batch via sendEachForMulticast
    };
    if (content.icon)
        message.notification.icon = content.icon;
    if (content.image)
        message.notification.image = content.image;
    if (content.data)
        message.data = content.data;
    try {
        // sendEachForMulticast internally handles batching and partial failures cleanly
        yield pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications(message);
        result.sent = usersWithTokens.size;
        const usersWithoutTokens = users.filter(u => !usersWithTokens.has(u._id.toString()));
        result.sent += usersWithoutTokens.length;
    }
    catch (error) {
        console.error('Push notification error:', error);
        result.failed = Array.from(usersWithTokens);
        const usersWithoutTokens = users.filter(u => !usersWithTokens.has(u._id.toString()));
        result.sent = usersWithoutTokens.length;
    }
    return result;
});
exports.sendPush = sendPush;
exports.default = exports.sendPush;
