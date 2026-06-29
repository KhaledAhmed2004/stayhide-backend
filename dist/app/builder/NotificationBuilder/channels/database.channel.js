"use strict";
/**
 * Database Channel - MongoDB Notification Storage
 *
 * Persists notifications to the Notification collection.
 * Uses the existing Notification model.
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
exports.saveToDatabase = void 0;
const notification_model_1 = require("../../../modules/notification/notification.model");
/**
 * Save notifications to MongoDB
 */
const saveToDatabase = (users, content) => __awaiter(void 0, void 0, void 0, function* () {
    const result = { sent: 0, failed: [] };
    const resolvedResourceId = content.resourceId !== undefined && content.resourceId !== null
        ? typeof content.resourceId === 'string'
            ? content.resourceId
            : content.resourceId.toString()
        : undefined;
    // Prepare notification documents
    const notifications = users.map(user => ({
        title: content.title,
        text: content.text,
        receiver: user._id,
        type: content.type || 'SYSTEM',
        resourceType: content.resourceType,
        resourceId: resolvedResourceId,
        isRead: false,
    }));
    try {
        // Bulk insert for efficiency
        const created = yield notification_model_1.Notification.insertMany(notifications, {
            ordered: false, // Continue on error
        });
        result.sent = created.length;
    }
    catch (error) {
        // Handle partial success in bulk insert
        if (error.insertedDocs) {
            result.sent = error.insertedDocs.length;
            // Remaining are failed
            const insertedIds = new Set(error.insertedDocs.map((d) => d.receiver.toString()));
            result.failed = users
                .filter(u => !insertedIds.has(u._id.toString()))
                .map(u => u._id.toString());
        }
        else {
            console.error('Database insert error:', error);
            result.failed = users.map(u => u._id.toString());
        }
    }
    return result;
});
exports.saveToDatabase = saveToDatabase;
exports.default = exports.saveToDatabase;
