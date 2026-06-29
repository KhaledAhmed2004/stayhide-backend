import express, { NextFunction, Request, Response } from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { MessageController } from './message.controller';
import { getMultipleFilesPath } from '../../../shared/getFilePath';
import fileUploadHandler from '../../middlewares/fileUploadHandler';
import { JwtPayload } from 'jsonwebtoken';

const router = express.Router();

// ============ SEND & RETRIEVE MESSAGES ============

// Send a message with optional file attachments
router.post(
  '/',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  fileUploadHandler(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure these are always arrays
      const images: string[] = getMultipleFilesPath(req.files, 'image') ?? [];
      const media: string[] = getMultipleFilesPath(req.files, 'media') ?? [];
      const docs: string[] = getMultipleFilesPath(req.files, 'doc') ?? [];

      let type: 'text' | 'image' | 'media' | 'doc' | 'mixed' = 'text';

      if (images.length && (req.body.text || media.length || docs.length)) {
        type = 'mixed';
      } else if (
        media.length &&
        (req.body.text || images.length || docs.length)
      ) {
        type = 'mixed';
      } else if (
        docs.length &&
        (req.body.text || images.length || media.length)
      ) {
        type = 'mixed';
      } else if (images.length) {
        type = 'image';
      } else if (media.length) {
        type = 'media';
      } else if (docs.length) {
        type = 'doc';
      } else if (req.body.text) {
        type = 'text';
      }

      const attachments = [
        ...images.map(u => ({ type: 'image', url: u, name: String(u).split('/').pop() })),
        ...media.map(u => {
          const lower = String(u).toLowerCase();
          const isVideo = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
          return { type: isVideo ? 'video' : 'audio', url: u, name: String(u).split('/').pop() };
        }),
        ...docs.map(u => ({ type: 'file', url: u, name: String(u).split('/').pop() })),
      ];

      req.body = {
        ...req.body,
        sender: (req?.user as JwtPayload).id,
        attachments,
        type,
      };

      next();
    } catch (error) {
      return res.status(500).json({ message: 'Invalid File Format' });
    }
  },
  MessageController.sendMessage
);

// ============ CHAT-LEVEL OPERATIONS ============

// Get all messages in a chat (alias route for frontend compatibility)
router.get(
  '/chat/:chatId',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MessageController.getChatMessages
);

// Mark all messages in a chat as read
router.post(
  '/chat/:chatId/read',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MessageController.markChatRead
);

export const MessageRoutes = router;
