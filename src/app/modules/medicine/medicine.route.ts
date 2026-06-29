import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { MedicationController } from './medicine.controller';
import { MedicationValidation } from './medicine.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(MedicationValidation.createMedicationZodSchema),
  MedicationController.createMedication,
);

router.get(
  '/',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getAllMedicines,
);

router.get(
  '/today',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getTodaySchedule,
);

router.get(
  '/history',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getHistory,
);

router.get(
  '/stats',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getStats,
);

router.post(
  '/logs',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(MedicationValidation.logMedicationZodSchema),
  MedicationController.upsertLog,
);

router.post(
  '/cron/mark-missed',
  auth(USER_ROLES.ADMIN),
  MedicationController.markMissedDoses,
);

router.get(
  '/:medicineId/logs',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getLogsForMedication,
);

router.get(
  '/:medicineId',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getSingleMedicine,
);

router.patch(
  '/:medicineId',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(MedicationValidation.updateMedicationZodSchema),
  MedicationController.updateMedication,
);

router.patch(
  '/:medicineId/archive',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.archiveMedication,
);

router.patch(
  '/:medicineId/refill',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(MedicationValidation.refillInventoryZodSchema),
  MedicationController.refillInventory,
);

export const MedicationRoutes = router;
