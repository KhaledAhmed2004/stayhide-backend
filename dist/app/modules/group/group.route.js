"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const group_controller_1 = require("./group.controller");
const group_validation_1 = require("./group.validation");
const fileHandler_1 = require("../../middlewares/fileHandler");
const router = express_1.default.Router();
const normalizeAttachments = (req, res, next) => {
    try {
        let uploaded = [];
        if (req.body.attachments) {
            if (typeof req.body.attachments === 'string') {
                uploaded = [req.body.attachments];
            }
            else if (Array.isArray(req.body.attachments)) {
                uploaded = req.body.attachments;
            }
        }
        let existing = [];
        if (req.body.existingAttachments) {
            if (typeof req.body.existingAttachments === 'string') {
                try {
                    existing = JSON.parse(req.body.existingAttachments);
                }
                catch (err) {
                    existing = [req.body.existingAttachments];
                }
            }
            else if (Array.isArray(req.body.existingAttachments)) {
                existing = req.body.existingAttachments;
            }
        }
        const hasExisting = req.body.existingAttachments !== undefined;
        const hasUploaded = req.body.attachments !== undefined;
        const merged = [...existing, ...uploaded];
        if (hasExisting || hasUploaded || merged.length > 0) {
            req.body.attachments = merged;
        }
        // Clean up temporary helper field
        delete req.body.existingAttachments;
        next();
    }
    catch (error) {
        next(error);
    }
};
// Admin routes
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(group_validation_1.GroupValidation.createGroupZodSchema), group_controller_1.GroupController.createGroup);
router.patch('/:groupId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(group_validation_1.GroupValidation.updateGroupZodSchema), group_controller_1.GroupController.updateGroup);
router.delete('/:groupId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.deleteGroup);
// User routes
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.getAllGroups);
router.get('/:groupId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.getSingleGroup);
router.post('/:groupId/join', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.joinGroup);
router.post('/:groupId/leave', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.leaveGroup);
router.delete('/:groupId/members/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.kickMember);
router.get('/:groupId/posts', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.getGroupFeed);
router.post('/:groupId/posts', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), (0, fileHandler_1.fileHandler)([{ name: 'attachments', maxCount: 5 }]), normalizeAttachments, (0, validateRequest_1.default)(group_validation_1.GroupValidation.createPostZodSchema), group_controller_1.GroupController.createPost);
router.post('/posts/:postId/like', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.toggleLike);
router.post('/posts/:postId/comments', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(group_validation_1.GroupValidation.addCommentZodSchema), group_controller_1.GroupController.addComment);
router.get('/posts/:postId/comments', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.getPostComments);
router.patch('/posts/:postId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), (0, fileHandler_1.fileHandler)([{ name: 'attachments', maxCount: 5 }]), normalizeAttachments, (0, validateRequest_1.default)(group_validation_1.GroupValidation.updatePostZodSchema), group_controller_1.GroupController.updatePost);
router.delete('/posts/:postId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.deletePost);
router.patch('/comments/:commentId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(group_validation_1.GroupValidation.updateCommentZodSchema), group_controller_1.GroupController.updateComment);
router.delete('/comments/:commentId', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.deleteComment);
router.patch('/posts/:postId/pin', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), group_controller_1.GroupController.togglePinPost);
exports.GroupRoutes = router;
