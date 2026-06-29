import express from 'express';
import auth from '../../middlewares/auth';
import { ChatController } from './chat.controller';
import { USER_ROLES } from '../../../enums/user';
const router = express.Router();

// Create or get a chat with another user
router.post(
  '/:otherUserId',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  ChatController.createChat,
);

// Get all chats for the logged-in user
router.get(
  '/',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  ChatController.getChat,
);

export const ChatRoutes = router;
