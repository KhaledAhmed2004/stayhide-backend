"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningContentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const fileHandler_1 = require("../../middlewares/fileHandler");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const learning_content_controller_1 = require("./learning-content.controller");
const learning_content_validation_1 = require("./learning-content.validation");
const router = express_1.default.Router();
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), learning_content_controller_1.LearningContentController.getAllLearningContents);
router.get('/:contentId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), learning_content_controller_1.LearningContentController.getSingleLearningContent);
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, fileHandler_1.fileHandler)([{ name: 'video', maxCount: 1, subfolder: 'learning-contents/videos' }], { maxFileSizeMB: 500 }), (0, validateRequest_1.default)(learning_content_validation_1.LearningContentValidation.createLearningContentZodSchema), learning_content_controller_1.LearningContentController.createLearningContent);
router.patch('/:contentId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, fileHandler_1.fileHandler)([{ name: 'video', maxCount: 1, subfolder: 'learning-contents/videos' }], { maxFileSizeMB: 500 }), (0, validateRequest_1.default)(learning_content_validation_1.LearningContentValidation.updateLearningContentZodSchema), learning_content_controller_1.LearningContentController.updateLearningContent);
router.delete('/:contentId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), learning_content_controller_1.LearningContentController.deleteLearningContent);
// Likes
router.post('/:contentId/like', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), learning_content_controller_1.LearningContentController.toggleLike);
// Comments
router.post('/:contentId/comments', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(learning_content_validation_1.LearningContentValidation.addCommentZodSchema), learning_content_controller_1.LearningContentController.addComment);
router.get('/:contentId/comments', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), learning_content_controller_1.LearningContentController.getComments);
router.delete('/comments/:commentId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), learning_content_controller_1.LearningContentController.deleteComment);
exports.LearningContentRoutes = router;
