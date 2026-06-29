import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { LegalController } from './legal.controller';
import { LegalValidation } from './legal.validation';

const router = express.Router();

// Get all legal pages
router.get('/', LegalController.getAll);

// Get a legal page by slug
router.get('/:slug', LegalController.getBySlug);

// Create a new legal page
router.post(
  '/',
  auth(USER_ROLES.ADMIN),
  validateRequest(LegalValidation.createLegalPage),
  LegalController.createLegalPage,
);

// Update a legal page by slug
router.patch(
  '/:slug',
  auth(USER_ROLES.ADMIN),
  validateRequest(LegalValidation.updateLegalPage),
  LegalController.updateBySlug,
);

// Delete a legal page by slug
router.delete(
  '/:slug',
  auth(USER_ROLES.ADMIN),
  validateRequest(LegalValidation.deleteLegalPage),
  LegalController.deleteBySlug,
);

export const LegalRoutes = router;
