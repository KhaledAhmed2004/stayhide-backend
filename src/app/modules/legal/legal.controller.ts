import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { LegalService } from './legal.service';

const createLegalPage = catchAsync(async (req: Request, res: Response) => {
  const result = await LegalService.createLegalPage(req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Legal page created successfully',
    data: result,
  });
});

const getAll = catchAsync(async (req: Request, res: Response) => {
  const result = await LegalService.getAll();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Legal pages retrieved successfully',
    data: result,
  });
});

const getBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await LegalService.getBySlug(req.params.slug);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Legal page retrieved successfully',
    data: result,
  });
});

const updateBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await LegalService.updateBySlug(req.params.slug, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Legal page updated successfully',
    data: result,
  });
});

const deleteBySlug = catchAsync(async (req: Request, res: Response) => {
  await LegalService.deleteBySlug(req.params.slug);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Legal page deleted successfully',
  });
});

export const LegalController = {
  createLegalPage,
  getAll,
  getBySlug,
  updateBySlug,
  deleteBySlug,
};
