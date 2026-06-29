import { USER_ROLES } from '../../../enums/user';
import {
  auth,
  validateRequest,
  fileHandler,
  rateLimitMiddleware,
  idempotency,
  verifyCaptcha,
} from '../../middlewares';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';
import express from 'express';

const router = express.Router();

router.post(
  '/',
  idempotency('registration'),
  fileHandler(
    [{ name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' }],
    { maxFileSizeMB: 100 },
  ),
  validateRequest(UserValidation.createUserZodSchema),
  verifyCaptcha(),
  UserController.createUser,
);

router.get(
  '/me',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.getUserProfile,
);

router.patch(
  '/me',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  fileHandler([
    { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
  ]),
  validateRequest(UserValidation.updateUserZodSchema),
  UserController.updateProfile,
);

router.patch(
  '/me/preferences',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  validateRequest(UserValidation.updateUserPreferencesZodSchema),
  UserController.updatePreferences,
);

// Request account self-deletion (soft-delete with 30-day recovery window).
// Restore happens through POST /auth/restore-account.
router.delete(
  '/me',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  idempotency('account-delete'),
  validateRequest(UserValidation.deleteAccountZodSchema),
  UserController.requestAccountDeletion,
);

// Email-change: 2-step OTP flow. Step 1 — request: validates current
// password, stores pending newEmail + 6-digit OTP, sends OTP to NEW
// address and a heads-up to the OLD address.
router.post(
  '/me/email-change/request',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  idempotency('email-change-request'),
  validateRequest(UserValidation.requestEmailChangeZodSchema),
  UserController.requestEmailChange,
);

// Email-change: Step 2 — confirm. Verifies the OTP, commits the new
// email, bumps tokenVersion (every JWT under the old email becomes
// invalid), and clears the refresh cookie.
router.post(
  '/me/email-change/confirm',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  idempotency('email-change-confirm'),
  validateRequest(UserValidation.confirmEmailChangeZodSchema),
  UserController.confirmEmailChange,
);

// GDPR data export — returns everything the system stores about the
// requesting user as a JSON envelope.
router.post(
  '/me/data-export',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  idempotency('data-export'),
  UserController.exportMyData,
);

// Sessions — list every device this user has logged in from. Returns
// metadata only; never the raw FCM/APNs token.
router.get(
  '/me/sessions',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.listMySessions,
);

// Revoke EVERY session (logout-all-devices). Bumps tokenVersion so
// every issued JWT becomes invalid. Fixed path — must be declared
// before `:tokenId` so Express doesn't match `revoke-all` as an id.
router.post(
  '/me/sessions/revoke-all',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  idempotency('sessions-revoke-all'),
  UserController.revokeAllMySessions,
);

// Revoke ONE specific session by its subdoc id. Only removes that
// device from push delivery; the JWT remains valid until natural
// expiry (short-lived).
router.delete(
  '/me/sessions/:tokenId',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  validateRequest(UserValidation.revokeSessionZodSchema),
  UserController.revokeMySession,
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN),
  validateRequest(UserValidation.getAllUserRolesZodSchema),
  UserController.getAllUserRoles,
);

router.get('/metrics', auth(USER_ROLES.ADMIN), UserController.getUserMetrics);

router.get('/:userId', auth(USER_ROLES.ADMIN), UserController.getUserById);

router.patch(
  '/:userId',
  auth(USER_ROLES.ADMIN),
  validateRequest(UserValidation.adminUpdateUserZodSchema),
  UserController.adminUpdateUser,
);

router.delete('/:userId', auth(USER_ROLES.ADMIN), UserController.deleteUser);

export const UserRoutes = router;
