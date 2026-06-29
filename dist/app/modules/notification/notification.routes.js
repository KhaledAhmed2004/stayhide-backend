"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const notification_controller_1 = require("./notification.controller");
const notification_validation_1 = require("./notification.validation");
const router = express_1.default.Router();
// ==================== NOTIFICATIONS (unified for all roles) ====================
// Fetch notifications + unread count
router.get('/me', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), notification_controller_1.NotificationController.getNotificationFromDB);
// Mark all notifications as read (fixed path BEFORE param path)
router.patch('/read-all', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), notification_controller_1.NotificationController.readAllNotifications);
// Mark a notification as read
router.patch('/:notificationId/read', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), notification_controller_1.NotificationController.readNotification);
// ==================== ADMIN BROADCAST TOOLS ====================
// Sent notification history
router.get('/broadcasts', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), notification_controller_1.NotificationController.getSentHistory);
// Send notification to students
router.post('/broadcasts', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(notification_validation_1.NotificationValidation.sendNotification), notification_controller_1.NotificationController.sendNotification);
exports.NotificationRoutes = router;
