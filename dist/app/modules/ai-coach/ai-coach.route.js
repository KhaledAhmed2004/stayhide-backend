"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCoachRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const middlewares_1 = require("../../middlewares");
const ai_coach_controller_1 = require("./ai-coach.controller");
const ai_coach_validation_1 = require("./ai-coach.validation");
const router = express_1.default.Router();
router.use((0, middlewares_1.auth)(user_1.USER_ROLES.USER));
router.get('/sessions', ai_coach_controller_1.AiCoachController.getAllSessions);
router.get('/sessions/:sessionId', ai_coach_controller_1.AiCoachController.getSessionById);
router.post('/message', (0, middlewares_1.validateRequest)(ai_coach_validation_1.AiCoachValidation.sendMessageZodSchema), ai_coach_controller_1.AiCoachController.sendMessage);
exports.AiCoachRoutes = router;
