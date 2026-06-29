"use strict";
/**
 * Socket Channel - Socket.IO Real-time Notifications
 *
 * Emits real-time events to connected users via Socket.IO.
 * Uses the global io instance from socketHelper.
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
exports.sendSocket = void 0;
/**
 * Send real-time notifications via Socket.IO
 */
const sendSocket = (users, content) => __awaiter(void 0, void 0, void 0, function* () {
    const result = { sent: 0, failed: [] };
    // Get global Socket.IO instance
    // @ts-ignore - global.io is set in socketHelper.ts
    const io = global.io;
    if (!io) {
        console.warn('Socket.IO not initialized, skipping socket notifications');
        return { sent: 0, failed: users.map(u => u._id.toString()) };
    }
    const timestamp = new Date().toISOString();
    for (const user of users) {
        try {
            const userId = user._id.toString();
            // Emit to user's private room (user::{userId})
            io.to(`user::${userId}`).emit(content.event, Object.assign(Object.assign({}, content.data), { timestamp }));
            // Also emit using legacy format for backward compatibility
            // This matches the existing pattern: get-notification::{userId}
            io.emit(`get-notification::${userId}`, Object.assign(Object.assign({}, content.data), { timestamp }));
            result.sent++;
        }
        catch (error) {
            console.error(`Socket emit error for user ${user._id}:`, error);
            result.failed.push(user._id.toString());
        }
    }
    return result;
});
exports.sendSocket = sendSocket;
exports.default = exports.sendSocket;
