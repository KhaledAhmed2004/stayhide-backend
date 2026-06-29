"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const group_service_1 = require("./group.service");
const createGroup = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield group_service_1.GroupService.createGroupIntoDB(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Group created successfully',
        data: result,
    });
}));
const getSingleGroup = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { groupId } = req.params;
    const user = req.user;
    const result = yield group_service_1.GroupService.getSingleGroupFromDB(groupId, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Group fetched successfully',
        data: result,
    });
}));
const updateGroup = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { groupId } = req.params;
    const result = yield group_service_1.GroupService.updateGroupInDB(groupId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Group updated successfully',
        data: result,
    });
}));
const deleteGroup = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { groupId } = req.params;
    yield group_service_1.GroupService.deleteGroupFromDB(groupId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Group deleted successfully',
    });
}));
const getAllGroups = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield group_service_1.GroupService.getAllGroupsFromDB(req.query, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Groups fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const joinGroup = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { groupId } = req.params;
    const result = yield group_service_1.GroupService.joinGroupInDB(groupId, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Joined group successfully',
        data: result,
    });
}));
const leaveGroup = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { groupId } = req.params;
    const result = yield group_service_1.GroupService.leaveGroupInDB(groupId, user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Left group successfully',
        data: result,
    });
}));
const createPost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { groupId } = req.params;
    const result = yield group_service_1.GroupService.createPostInDB(groupId, user.id, user.role, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Post created successfully',
        data: result,
    });
}));
const getGroupFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { groupId } = req.params;
    const user = req.user;
    const result = yield group_service_1.GroupService.getGroupFeedFromDB(groupId, req.query, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Group feed fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const toggleLike = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { postId } = req.params;
    const result = yield group_service_1.GroupService.toggleLikeInDB(postId, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.liked ? 'Post liked' : 'Post unliked',
        data: result,
    });
}));
const addComment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { postId } = req.params;
    const result = yield group_service_1.GroupService.addCommentInDB(postId, user.id, user.role, req.body.comment, req.body.parentCommentId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Comment added successfully',
        data: result,
    });
}));
const deletePost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { postId } = req.params;
    yield group_service_1.GroupService.deletePostInDB(postId, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Post deleted successfully',
    });
}));
const deleteComment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { commentId } = req.params;
    yield group_service_1.GroupService.deleteCommentInDB(commentId, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Comment deleted successfully',
    });
}));
const updatePost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { postId } = req.params;
    const result = yield group_service_1.GroupService.updatePostInDB(postId, user.id, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Post updated successfully',
        data: result,
    });
}));
const updateComment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { commentId } = req.params;
    const result = yield group_service_1.GroupService.updateCommentInDB(commentId, user.id, req.body.comment);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Comment updated successfully',
        data: result,
    });
}));
const getPostComments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { postId } = req.params;
    const result = yield group_service_1.GroupService.getPostCommentsFromDB(postId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Comments fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const kickMember = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { groupId, userId } = req.params;
    const user = req.user;
    const result = yield group_service_1.GroupService.kickMemberFromDB(groupId, userId, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Member kicked successfully',
        data: result,
    });
}));
const togglePinPost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { postId } = req.params;
    const user = req.user;
    const result = yield group_service_1.GroupService.togglePinPostInDB(postId, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: (result === null || result === void 0 ? void 0 : result.isPinned) ? 'Post pinned' : 'Post unpinned',
        data: result,
    });
}));
exports.GroupController = {
    createGroup,
    getSingleGroup,
    updateGroup,
    deleteGroup,
    getAllGroups,
    joinGroup,
    leaveGroup,
    createPost,
    getGroupFeed,
    toggleLike,
    addComment,
    deletePost,
    deleteComment,
    updatePost,
    updateComment,
    getPostComments,
    kickMember,
    togglePinPost,
};
