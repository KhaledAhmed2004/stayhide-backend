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
exports.LearningContentController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const learning_content_service_1 = require("./learning-content.service");
const createLearningContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = Object.assign({}, req.body);
    if (payload.video) {
        payload.videoUrl = payload.video;
        delete payload.video;
    }
    const result = yield learning_content_service_1.LearningContentService.createLearningContentIntoDB(payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Learning content created successfully',
        data: {
            id: result === null || result === void 0 ? void 0 : result._id,
            createdAt: result === null || result === void 0 ? void 0 : result.createdAt,
        },
    });
}));
const getAllLearningContents = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield learning_content_service_1.LearningContentService.getAllLearningContentsFromDB(req.query, user === null || user === void 0 ? void 0 : user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Learning contents fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const getSingleLearningContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { contentId } = req.params;
    const result = yield learning_content_service_1.LearningContentService.getSingleLearningContentFromDB(contentId, user === null || user === void 0 ? void 0 : user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Learning content fetched successfully',
        data: result,
    });
}));
const updateLearningContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { contentId } = req.params;
    const payload = Object.assign({}, req.body);
    if (payload.video) {
        payload.videoUrl = payload.video;
        delete payload.video;
    }
    const result = yield learning_content_service_1.LearningContentService.updateLearningContentInDB(contentId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Learning content updated successfully',
        data: {
            id: result === null || result === void 0 ? void 0 : result._id,
            updatedAt: result === null || result === void 0 ? void 0 : result.updatedAt,
        },
    });
}));
const deleteLearningContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { contentId } = req.params;
    yield learning_content_service_1.LearningContentService.deleteLearningContentFromDB(contentId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Learning content deleted successfully',
    });
}));
const toggleLike = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { contentId } = req.params;
    const result = yield learning_content_service_1.LearningContentService.toggleLikeInDB(contentId, user.id);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: result.liked ? 'Content liked' : 'Content unliked',
        data: result,
    });
}));
const addComment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { contentId } = req.params;
    const result = yield learning_content_service_1.LearningContentService.addCommentInDB(contentId, user.id, req.body.comment, req.body.parentCommentId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Comment added successfully',
        data: result,
    });
}));
const getComments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { contentId } = req.params;
    const result = yield learning_content_service_1.LearningContentService.getCommentsFromDB(contentId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Comments fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const deleteComment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { commentId } = req.params;
    yield learning_content_service_1.LearningContentService.deleteCommentInDB(commentId, user.id, user.role);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Comment deleted successfully',
    });
}));
exports.LearningContentController = {
    createLearningContent,
    getAllLearningContents,
    getSingleLearningContent,
    updateLearningContent,
    deleteLearningContent,
    toggleLike,
    addComment,
    getComments,
    deleteComment,
};
