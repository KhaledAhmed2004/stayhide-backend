"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
const user_1 = require("../../../enums/user");
const middlewares_1 = require("../../middlewares");
const user_controller_1 = require("./user.controller");
const user_validation_1 = require("./user.validation");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.post('/', (0, middlewares_1.idempotency)('registration'), (0, middlewares_1.fileHandler)([{ name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' }], { maxFileSizeMB: 100 }), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.createUserZodSchema), (0, middlewares_1.verifyCaptcha)(), user_controller_1.UserController.createUser);
router.get('/me', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), user_controller_1.UserController.getUserProfile);
router.patch('/me', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.fileHandler)([
    { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
]), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.updateUserZodSchema), user_controller_1.UserController.updateProfile);
router.patch('/me/preferences', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.updateUserPreferencesZodSchema), user_controller_1.UserController.updatePreferences);
// Request account self-deletion (soft-delete with 30-day recovery window).
// Restore happens through POST /auth/restore-account.
router.delete('/me', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.idempotency)('account-delete'), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.deleteAccountZodSchema), user_controller_1.UserController.requestAccountDeletion);
// Email-change: 2-step OTP flow. Step 1 — request: validates current
// password, stores pending newEmail + 6-digit OTP, sends OTP to NEW
// address and a heads-up to the OLD address.
router.post('/me/email-change/request', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.idempotency)('email-change-request'), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.requestEmailChangeZodSchema), user_controller_1.UserController.requestEmailChange);
// Email-change: Step 2 — confirm. Verifies the OTP, commits the new
// email, bumps tokenVersion (every JWT under the old email becomes
// invalid), and clears the refresh cookie.
router.post('/me/email-change/confirm', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.idempotency)('email-change-confirm'), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.confirmEmailChangeZodSchema), user_controller_1.UserController.confirmEmailChange);
// GDPR data export — returns everything the system stores about the
// requesting user as a JSON envelope.
router.post('/me/data-export', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.idempotency)('data-export'), user_controller_1.UserController.exportMyData);
// Sessions — list every device this user has logged in from. Returns
// metadata only; never the raw FCM/APNs token.
router.get('/me/sessions', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), user_controller_1.UserController.listMySessions);
// Revoke EVERY session (logout-all-devices). Bumps tokenVersion so
// every issued JWT becomes invalid. Fixed path — must be declared
// before `:tokenId` so Express doesn't match `revoke-all` as an id.
router.post('/me/sessions/revoke-all', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.idempotency)('sessions-revoke-all'), user_controller_1.UserController.revokeAllMySessions);
// Revoke ONE specific session by its subdoc id. Only removes that
// device from push delivery; the JWT remains valid until natural
// expiry (short-lived).
router.delete('/me/sessions/:tokenId', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.revokeSessionZodSchema), user_controller_1.UserController.revokeMySession);
router.get('/', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.getAllUserRolesZodSchema), user_controller_1.UserController.getAllUserRoles);
router.get('/metrics', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.getUserMetrics);
router.get('/:userId', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.getUserById);
router.patch('/:userId', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN), (0, middlewares_1.validateRequest)(user_validation_1.UserValidation.adminUpdateUserZodSchema), user_controller_1.UserController.adminUpdateUser);
router.delete('/:userId', (0, middlewares_1.auth)(user_1.USER_ROLES.ADMIN), user_controller_1.UserController.deleteUser);
exports.UserRoutes = router;
