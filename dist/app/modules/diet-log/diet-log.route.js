"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DietLogRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const middlewares_1 = require("../../middlewares");
const diet_log_controller_1 = require("./diet-log.controller");
const diet_log_validation_1 = require("./diet-log.validation");
const router = express_1.default.Router();
router.use((0, middlewares_1.auth)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN));
router.post('/', (0, middlewares_1.validateRequest)(diet_log_validation_1.DietLogValidation.createDietLogZodSchema), diet_log_controller_1.DietLogController.createLog);
router.get('/insights', diet_log_controller_1.DietLogController.getInsights);
router.get('/', diet_log_controller_1.DietLogController.getLogs);
router.put('/:dietLogId', (0, middlewares_1.validateRequest)(diet_log_validation_1.DietLogValidation.updateDietLogZodSchema), diet_log_controller_1.DietLogController.updateLog);
router.delete('/:dietLogId', diet_log_controller_1.DietLogController.deleteLog);
exports.DietLogRoutes = router;
