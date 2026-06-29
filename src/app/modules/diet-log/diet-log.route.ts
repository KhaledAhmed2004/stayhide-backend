import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import { auth, validateRequest } from '../../middlewares';
import { DietLogController } from './diet-log.controller';
import { DietLogValidation } from './diet-log.validation';

const router = express.Router();

router.use(auth(USER_ROLES.USER, USER_ROLES.ADMIN));

router.post(
  '/',
  validateRequest(DietLogValidation.createDietLogZodSchema),
  DietLogController.createLog,
);

router.get('/insights', DietLogController.getInsights);

router.get('/', DietLogController.getLogs);

router.put(
  '/:dietLogId',
  validateRequest(DietLogValidation.updateDietLogZodSchema),
  DietLogController.updateLog,
);

router.delete('/:dietLogId', DietLogController.deleteLog);

export const DietLogRoutes = router;
