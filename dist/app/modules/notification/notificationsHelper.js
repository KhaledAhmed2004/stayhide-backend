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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotifications = void 0;
const notification_model_1 = require("./notification.model");
const user_model_1 = require("../user/user.model");
const pushNotificationHelper_1 = require("./pushNotificationHelper");
const sendNotifications = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.create(data);
    const user = yield user_model_1.User.findById(data === null || data === void 0 ? void 0 : data.receiver);
    // Extract raw token strings from the deviceTokens sub-document array.
    const tokens = Array.isArray(user === null || user === void 0 ? void 0 : user.deviceTokens)
        ? user.deviceTokens.map(entry => entry === null || entry === void 0 ? void 0 : entry.token).filter(Boolean)
        : [];
    if (tokens.length > 0) {
        const message = {
            notification: {
                title: (data === null || data === void 0 ? void 0 : data.title) || 'TBSosick Notification',
                body: (data === null || data === void 0 ? void 0 : data.subtitle) || (data === null || data === void 0 ? void 0 : data.text) || (data === null || data === void 0 ? void 0 : data.title) || '',
            },
            tokens,
        };
        try {
            yield pushNotificationHelper_1.pushNotificationHelper.sendPushNotifications(message);
        }
        catch (error) {
            console.error('Failed to send push notification:', error);
        }
    }
    //@ts-ignore
    const socketIo = global.io;
    if (socketIo) {
        socketIo.to(`user::${data === null || data === void 0 ? void 0 : data.receiver}`).emit('notification:new', result);
        // Legacy alias — kept for older mobile clients
        socketIo.emit(`get-notification::${data === null || data === void 0 ? void 0 : data.receiver}`, result);
    }
    return result;
});
exports.sendNotifications = sendNotifications;
