import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { MedicationService } from './medicine.service';
import { IRequest } from '../../interfaces/common';

const createMedication = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.createMedication(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Medication created successfully',
    data: result,
  });
});

const getAllMedicines = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.getAllMedicines(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medicines retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getSingleMedicine = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.getSingleMedicine(userId, req.params.medicineId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication retrieved successfully',
    data: result,
  });
});

const updateMedication = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.updateMedication(userId, req.params.medicineId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication updated successfully',
    data: result,
  });
});

const archiveMedication = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.archiveMedication(userId, req.params.medicineId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication archived successfully',
    data: result,
  });
});

const getTodaySchedule = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const dateString = req.query.date as string;
  const currentTimeStr = req.query.currentTime as string; // HH:MM
  
  if (!dateString || !currentTimeStr) {
    throw new Error('date and currentTime query parameters are required');
  }

  const result = await MedicationService.getTodaySchedule(userId, dateString, currentTimeStr);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Today schedule retrieved successfully',
    data: result,
  });
});

const upsertLog = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.upsertLog(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication log updated successfully',
    data: result,
  });
});

const getHistory = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
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

  const result = await MedicationService.getHistory(userId, startDate, endDate);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication history retrieved successfully',
    data: result,
  });
});

const getStats = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.getStats(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication stats retrieved successfully',
    data: result,
  });
});

const getLogsForMedication = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.getLogsForMedication(userId, req.params.medicineId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication logs retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const refillInventory = catchAsync(async (req: IRequest, res) => {
  const userId = req.user!.id;
  const result = await MedicationService.refillInventory(userId, req.params.medicineId, req.body.quantity);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Medication inventory refilled successfully',
    data: result,
  });
});

const markMissedDoses = catchAsync(async (req: IRequest, res) => {
  let dateString = req.body.dateString as string;
  
  if (!dateString) {
    // Default to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateString = yesterday.toISOString().split('T')[0];
  }

  const result = await MedicationService.markMissedDoses(dateString);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Missed doses marked successfully',
    data: result,
  });
});

export const MedicationController = {
  createMedication,
  getAllMedicines,
  getSingleMedicine,
  updateMedication,
  archiveMedication,
  getTodaySchedule,
  upsertLog,
  getHistory,
  getStats,
  getLogsForMedication,
  refillInventory,
  markMissedDoses,
};
