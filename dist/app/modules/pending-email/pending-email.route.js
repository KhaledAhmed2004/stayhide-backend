"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingEmailRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const pending_email_controller_1 = require("./pending-email.controller");
const pending_email_validation_1 = require("./pending-email.validation");
const router = express_1.default.Router();
// All endpoints SUPER_ADMIN only (G7 — explicit role guard).
// Fixed paths before param paths.
// `/stats` is a fixed path; declare before `:pendingEmailId`.
router.get('/stats', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), pending_email_controller_1.PendingEmailController.getPendingEmailStats);
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(pending_email_validation_1.PendingEmailValidation.listPendingEmailsZodSchema), pending_email_controller_1.PendingEmailController.listPendingEmails);
router.post('/:pendingEmailId/requeue', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(pending_email_validation_1.PendingEmailValidation.requeuePendingEmailZodSchema), pending_email_controller_1.PendingEmailController.requeuePendingEmail);
exports.PendingEmailRoutes = router;
