import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AiCoachService } from './ai-coach.service';
import { JwtPayload } from 'jsonwebtoken';

const getAllSessions = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const result = await AiCoachService.getAllSessions(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat sessions retrieved successfully',
    data: result,
  });
});

const getSessionById = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const { sessionId } = req.params;
  const result = await AiCoachService.getSessionById(userId, sessionId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat history retrieved successfully',
    data: result,
  });
});

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const { message, sessionId } = req.body;

  const result = await AiCoachService.sendMessageToMiranda(userId, message, sessionId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Message sent successfully',
    data: result,
  });
});

export const AiCoachController = {
  getAllSessions,
  getSessionById,
  sendMessage,
};
