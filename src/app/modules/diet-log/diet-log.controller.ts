import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { DietLogService } from './diet-log.service';
import { JwtPayload } from 'jsonwebtoken';

const createLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const result = await DietLogService.createLog(userId, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Diet log created successfully',
    data: result,
  });
});

const getLogs = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const date = req.query.date as string;

  let result;

  if (date) {
    result = await DietLogService.getLogsByDate(userId, date);
  } else {
    let startDate = req.query.startDate as string;
    let endDate = req.query.endDate as string;
    
    if (!startDate || !endDate) {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      if (!endDate) {
        endDate = today.toISOString().split('T')[0];
      }
      if (!startDate) {
        startDate = sevenDaysAgo.toISOString().split('T')[0];
      }
    }
    result = await DietLogService.getHistory(userId, startDate, endDate);
  }

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Diet logs retrieved successfully',
    data: result,
  });
});

const updateLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const logId = req.params.dietLogId;
  const result = await DietLogService.updateLog(userId, logId, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Diet log updated successfully',
    data: result,
  });
});

const deleteLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const logId = req.params.dietLogId;
  const result = await DietLogService.deleteLog(userId, logId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Diet log deleted successfully',
    data: result,
  });
});

const getInsights = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const result = await DietLogService.generateInsights(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Diet insights generated successfully',
    data: result,
  });
});

export const DietLogController = {
  createLog,
  getLogs,
  updateLog,
  deleteLog,
  getInsights,
};
