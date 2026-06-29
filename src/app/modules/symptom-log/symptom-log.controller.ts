import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { SymptomLogService } from './symptom-log.service';
import { JwtPayload } from 'jsonwebtoken';

const upsertSymptomLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const date = req.params.date;
  const payload = req.body;

  const result = await SymptomLogService.upsertTodayLogToDB(userId, date, payload);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Symptom log saved successfully',
    data: result,
  });
});

const getSymptomLog = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const date = req.params.date;

  const result = await SymptomLogService.getLogByDateFromDB(userId, date);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Symptom log retrieved successfully',
    data: result,
  });
});

const getTrends = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

  const result = await SymptomLogService.getTrendsFromDB(userId, days);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Symptom trends retrieved successfully.',
    data: {
      summary: result.summary,
      logs: result.data,
    },
    meta: result.meta,
  });
});

const getDailySummary = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).id;
  const date = req.params.date;

  const result = await SymptomLogService.generateDailySummary(userId, date);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Daily symptom summary retrieved successfully.',
    data: result,
  });
});

export const SymptomLogController = {
  upsertSymptomLog,
  getSymptomLog,
  getTrends,
  getDailySummary,
};
