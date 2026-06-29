import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { NotificationController } from './notification.controller';
import { NotificationValidation } from './notification.validation';

const router = express.Router();

// ==================== NOTIFICATIONS (unified for all roles) ====================

// Fetch notifications + unread count
router.get(
  '/me',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  NotificationController.getNotificationFromDB
);

// Mark all notifications as read (fixed path BEFORE param path)
router.patch(
  '/read-all',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  NotificationController.readAllNotifications
);

// Mark a notification as read
router.patch(
  '/:notificationId/read',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  NotificationController.readNotification
);

// ==================== ADMIN BROADCAST TOOLS ====================

// Sent notification history
router.get(
  '/broadcasts',
  auth(USER_ROLES.ADMIN),
  NotificationController.getSentHistory,
);

// Send notification to students
router.post(
  '/broadcasts',
  auth(USER_ROLES.ADMIN),
  validateRequest(NotificationValidation.sendNotification),
  NotificationController.sendNotification,
);

export const NotificationRoutes = router;
