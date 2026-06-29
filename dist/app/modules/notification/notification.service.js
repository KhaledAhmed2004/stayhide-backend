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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const NotificationBuilder_1 = __importDefault(require("../../builder/NotificationBuilder/NotificationBuilder"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const notification_model_1 = require("./notification.model");
const sentNotification_model_1 = require("./sentNotification.model");
const user_model_1 = require("../user/user.model");
const user_1 = require("../../../enums/user");
// ── Notification formatter ────────────────────────────────────────────────────
//
// v1 typed notifications (schemaVersion === 1) store a rich payload in `metadata`
// at write time: { actor, subject, actions }. The formatter reads that directly —
// zero extra DB joins at read time.
//
// Legacy notifications (schemaVersion === 0 or missing) fall back to the old flat
// shape so existing records keep rendering correctly.
//
const formatNotification = (doc) => {
    var _a, _b, _c, _d, _e;
    const base = {
        id: doc._id,
        type: doc.type,
        isRead: doc.isRead,
        readAt: (_a = doc.readAt) !== null && _a !== void 0 ? _a : null,
        createdAt: doc.createdAt,
        schemaVersion: (_b = doc.schemaVersion) !== null && _b !== void 0 ? _b : 0,
    };
    if (doc.schemaVersion === 1 && ((_c = doc.metadata) === null || _c === void 0 ? void 0 : _c.actor)) {
        // Typed notification — return structured actor/subject/actions
        return Object.assign(Object.assign({}, base), { actor: doc.metadata.actor, subject: (_d = doc.metadata.subject) !== null && _d !== void 0 ? _d : null, actions: (_e = doc.metadata.actions) !== null && _e !== void 0 ? _e : [] });
    }
    // Legacy flat notification — keep title/text/resource for backward compatibility
    return Object.assign(Object.assign({}, base), { title: doc.title, text: doc.text, subject: doc.resourceType
            ? { type: doc.resourceType, id: doc.resourceId }
            : null, actor: null, actions: [] });
};
// get notifications — cursor-based pagination
//
// Offset/page pagination is intentionally NOT used here. Notification feeds are
// high-frequency real-time streams: new items arrive between page loads, causing
// page drift (skipped or duplicated items) with skip/limit. Cursor pagination
// anchors each page to the last-seen document ID, making it drift-proof.
//
// Client usage:
//   First page : GET /api/v1/notifications/me
//   Next page  : GET /api/v1/notifications/me?nextCursor=<token>
//   No more    : meta.hasNext === false
const getNotificationFromDB = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const notificationQuery = new QueryBuilder_1.default(notification_model_1.Notification.find({ receiver: user.id }), query)
        .search(['title', 'text'])
        .filter()
        .sort()
        .fields();
    // cursorPaginate executes the query internally and returns { data, meta }
    const { data, meta } = yield notificationQuery.cursorPaginate('_id');
    const formattedData = data.map((item) => formatNotification(item.toObject()));
    const unreadCount = yield notification_model_1.Notification.countDocuments({
        receiver: user.id,
        isRead: false,
    });
    // Flatten cursor fields and unreadCount into a single meta object.
    // unreadCount is notification-domain data; limit/nextCursor/hasNext are
    // transport metadata. Both live at the same level — no nested `pagination`
    // wrapper — matching the Twitter v2 pattern: { meta: { result_count, next_token } }.
    return {
        data: formattedData,
        meta: {
            limit: meta.limit,
            nextCursor: meta.nextCursor,
            hasNext: meta.hasNext,
            unreadCount,
        },
    };
});
const markNotificationAsReadIntoDB = (notificationId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const notification = yield notification_model_1.Notification.findOneAndUpdate({ _id: notificationId, receiver: userId }, { isRead: true, readAt: new Date() }, { new: true });
    if (!notification) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Notification not found');
    }
    return notification;
});
const markAllNotificationsAsRead = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_model_1.Notification.updateMany({ receiver: userId, isRead: false }, { isRead: true, readAt: new Date() });
    return {
        modifiedCount: result.modifiedCount,
        message: 'All notifications marked as read',
    };
});
// Send notification via NotificationBuilder + save sent record
const sendAdminNotification = (title, text, audience) => __awaiter(void 0, void 0, void 0, function* () {
    const builder = new NotificationBuilder_1.default()
        .setTitle(title)
        .setText(text)
        .setType('ADMIN')
        .viaDatabase()
        .viaSocket()
        .viaPush();
    if (audience === 'ALL') {
        // Target all common user roles
        const users = yield user_model_1.User.find({
            role: { $in: [user_1.USER_ROLES.USER] },
        }).select('_id');
        builder.toMany(users.map(u => u._id));
    }
    else if ([user_1.USER_ROLES.USER].includes(audience)) {
        // Dynamic role targeting (restricted to BROTHER and SISTER)
        builder.toRole(audience);
    }
    else {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid audience type');
    }
    const result = yield builder.sendNow();
    const recipientCount = result.sent.database || result.sent.socket || 0;
    // Save sent record for history
    yield sentNotification_model_1.SentNotification.create({
        title,
        text,
        audience,
        recipientCount,
    });
    return { recipientCount };
});
// Get sent notification history
const getSentHistory = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const sentQuery = new QueryBuilder_1.default(sentNotification_model_1.SentNotification.find(), query)
        .search(['title', 'text'])
        .filter()
        .sort()
        .paginate();
    const data = yield sentQuery.modelQuery;
    const pagination = yield sentQuery.getPaginationInfo();
    return { pagination, data };
});
exports.NotificationService = {
    getNotificationFromDB,
    markNotificationAsReadIntoDB,
    markAllNotificationsAsRead,
    sendAdminNotification,
    getSentHistory,
};
