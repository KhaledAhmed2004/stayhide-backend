"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskQuestionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const fileHandler_1 = require("../../middlewares/fileHandler");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const ask_question_controller_1 = require("./ask-question.controller");
const ask_question_validation_1 = require("./ask-question.validation");
const router = express_1.default.Router();
// User routes
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, fileHandler_1.fileHandler)([{ name: 'image', maxCount: 1 }]), (0, validateRequest_1.default)(ask_question_validation_1.AskQuestionValidation.submitQuestionZodSchema), ask_question_controller_1.AskQuestionController.submitQuestion);
// IMPORTANT: /my-questions MUST remain above any GET /:questionId route.
// Express matches routes in registration order — a dynamic segment like /:questionId
// would capture the literal string "my-questions" as a param value if registered first.
// If you add GET /:questionId in the future, register it BELOW this route.
router.get('/my-questions', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), ask_question_controller_1.AskQuestionController.getMyQuestions);
// Admin routes
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), ask_question_controller_1.AskQuestionController.getAllQuestions);
router.get('/metrics', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), ask_question_controller_1.AskQuestionController.getQuestionMetrics);
router.patch('/:questionId/answer', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(ask_question_validation_1.AskQuestionValidation.answerQuestionZodSchema), ask_question_controller_1.AskQuestionController.answerQuestion);
exports.AskQuestionRoutes = router;
