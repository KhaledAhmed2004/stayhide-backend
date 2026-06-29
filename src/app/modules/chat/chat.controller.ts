import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { ChatService } from './chat.service';
import { JwtPayload } from 'jsonwebtoken';

// Used API: POST /api/v1/chats/:otherUserId
const createChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const otherUserId = req.params.otherUserId;

  const chat = await ChatService.createOrGet(user.id as string, otherUserId);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Chat created or retrieved successfully',
    data: chat,
  });
});

// Used API: GET /api/v1/chats
const getChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const searchTerm = req.query.searchTerm as string | undefined;

  const chatList = await ChatService.getList(user.id as string, searchTerm);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat list retrieved successfully',
    data: chatList,
  });
});

export const ChatController = {
  createChat,
  getChat,
};
