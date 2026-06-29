"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymptomLogRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const middlewares_1 = require("../../middlewares");
const symptom_log_controller_1 = require("./symptom-log.controller");
const symptom_log_validation_1 = require("./symptom-log.validation");
const router = express_1.default.Router();
// Apply auth to all routes
router.use((0, middlewares_1.auth)(user_1.USER_ROLES.USER));
router.get('/trends', (0, middlewares_1.validateRequest)(symptom_log_validation_1.SymptomLogValidation.getTrendsZodSchema), symptom_log_controller_1.SymptomLogController.getTrends);
router.get('/summary/:date', (0, middlewares_1.validateRequest)(symptom_log_validation_1.SymptomLogValidation.getSymptomLogZodSchema), symptom_log_controller_1.SymptomLogController.getDailySummary);
router.get('/:date', (0, middlewares_1.validateRequest)(symptom_log_validation_1.SymptomLogValidation.getSymptomLogZodSchema), symptom_log_controller_1.SymptomLogController.getSymptomLog);
router.put('/:date', (0, middlewares_1.validateRequest)(symptom_log_validation_1.SymptomLogValidation.upsertSymptomLogZodSchema), symptom_log_controller_1.SymptomLogController.upsertSymptomLog);
exports.SymptomLogRoutes = router;
