import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { MessageService } from './message.service';
import { JwtPayload } from 'jsonwebtoken';

// POST /api/v1/messages
// Requirements: 5.1 — send wired to HTTP route
const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { chatId, text, type, attachments } = req.body;

  const message = await MessageService.send(chatId, user.id as string, {
    text,
    type,
    attachments,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Message sent successfully',
    data: message,
  });
});

// GET /api/v1/messages/chat/:chatId
// Requirements: 6.1 — getHistory wired to HTTP route
const getChatMessages = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const chatId = req.params.chatId;
  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;

  const result = await MessageService.getHistory(
    chatId,
    user.id as string,
    cursor,
    limit,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat messages retrieved successfully',
    data: result.messages,
    meta: result.pagination as unknown as Record<string, unknown>,
  });
});

// POST /api/v1/messages/chat/:chatId/read
// Requirements: 7.1 — markRead wired to HTTP route
const markChatRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const chatId = req.params.chatId;

  const result = await MessageService.markRead(chatId, user.id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat messages marked as read',
    data: result,
  });
});

export const MessageController = { sendMessage, getChatMessages, markChatRead };
