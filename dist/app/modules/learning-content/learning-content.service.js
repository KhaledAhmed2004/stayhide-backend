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
exports.LearningContentService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const learning_content_model_1 = require("./learning-content.model");
const user_model_1 = require("../user/user.model");
const user_1 = require("../../../enums/user");
const NotificationBuilder_1 = __importDefault(require("../../builder/NotificationBuilder/NotificationBuilder"));
const syncLikesCount = (contentId) => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield learning_content_model_1.LearningContentLike.countDocuments({ contentId });
    yield learning_content_model_1.LearningContent.findByIdAndUpdate(contentId, { likesCount: count });
});
const syncCommentsCount = (contentId) => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield learning_content_model_1.LearningContentComment.countDocuments({ contentId });
    yield learning_content_model_1.LearningContent.findByIdAndUpdate(contentId, { commentsCount: count });
});
const createLearningContentIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield learning_content_model_1.LearningContent.create(payload);
    // Broadcast to all users about new content
    new NotificationBuilder_1.default()
        .toRole(user_1.USER_ROLES.BROTHER)
        .setTitle('New Learning Content')
        .setText(`New content published: ${payload.title}`)
        .setType('NEW_CONTENT')
        .setResource('LearningContent', result._id.toString())
        .viaAll()
        .send()
        .catch(err => console.error('Notification Error:', err));
    new NotificationBuilder_1.default()
        .toRole(user_1.USER_ROLES.SISTER)
        .setTitle('New Learning Content')
        .setText(`New content published: ${payload.title}`)
        .setType('NEW_CONTENT')
        .setResource('LearningContent', result._id.toString())
        .viaAll()
        .send()
        .catch(err => console.error('Notification Error:', err));
    return result;
});
const getAllLearningContentsFromDB = (query, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const contentQuery = new QueryBuilder_1.default(learning_content_model_1.LearningContent.find(), query)
        .search(['title', 'category'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield contentQuery.modelQuery;
    const pagination = yield contentQuery.getPaginationInfo();
    // Add isLiked flag for current user
    let contentWithLikeStatus;
    if (userId) {
        const contentIds = data.map((c) => c._id);
        const userLikes = yield learning_content_model_1.LearningContentLike.find({
            contentId: { $in: contentIds },
            userId: userId,
        });
        const likedContentIds = new Set(userLikes.map(l => l.contentId.toString()));
        contentWithLikeStatus = data.map((c) => (Object.assign(Object.assign({}, c.toObject()), { isLiked: likedContentIds.has(c._id.toString()) })));
    }
    else {
        contentWithLikeStatus = data.map((c) => c.toObject());
    }
    return { data: contentWithLikeStatus, pagination };
});
const getSingleLearningContentFromDB = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield learning_content_model_1.LearningContent.findById(id);
    if (!content) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Learning content not found');
    }
    let isLiked = false;
    if (userId) {
        const like = yield learning_content_model_1.LearningContentLike.findOne({ contentId: id, userId });
        isLiked = !!like;
    }
    return Object.assign(Object.assign({}, content.toObject()), { isLiked });
});
const updateLearningContentInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield learning_content_model_1.LearningContent.findByIdAndUpdate(id, payload, { new: true });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Learning content not found');
    }
    return result;
});
const deleteLearningContentFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield learning_content_model_1.LearningContent.findByIdAndDelete(id);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Learning content not found');
    }
    // Cleanup likes and comments
    yield learning_content_model_1.LearningContentLike.deleteMany({ contentId: id });
    yield learning_content_model_1.LearningContentComment.deleteMany({ contentId: id });
    return result;
});
const toggleLikeInDB = (contentId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield learning_content_model_1.LearningContent.findById(contentId);
    if (!content)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Learning content not found');
    const removed = yield learning_content_model_1.LearningContentLike.findOneAndDelete({ contentId, userId });
    if (removed) {
        yield syncLikesCount(contentId);
        return { liked: false };
    }
    try {
        yield learning_content_model_1.LearningContentLike.create({ contentId, userId });
        yield syncLikesCount(contentId);
        // Note: LearningContent usually doesn't have a single "owner" like a group post (it's admin-uploaded), 
        // but if it did, we'd notify them here.
        return { liked: true };
    }
    catch (err) {
        if (err.code === 11000) {
            return { liked: true };
        }
        throw err;
    }
});
const addCommentInDB = (contentId, userId, comment, parentCommentId) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield learning_content_model_1.LearningContent.findById(contentId);
    if (!content)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Learning content not found');
    if (parentCommentId) {
        const parent = yield learning_content_model_1.LearningContentComment.findById(parentCommentId);
        if (!parent)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Parent comment not found');
        if (parent.contentId.toString() !== contentId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Parent comment belongs to another content');
        }
        if (parent.parentCommentId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Cannot reply to a nested comment');
        }
    }
    const result = yield learning_content_model_1.LearningContentComment.create({
        contentId,
        userId,
        comment,
        parentCommentId: parentCommentId || null,
    });
    yield syncCommentsCount(contentId);
    // Notify parent comment owner (if reply)
    if (parentCommentId) {
        learning_content_model_1.LearningContentComment.findById(parentCommentId).then(parent => {
            if (parent && parent.userId.toString() !== userId) {
                new NotificationBuilder_1.default()
                    .to(parent.userId.toString())
                    .setTitle('New Reply')
                    .setText('Someone replied to your comment.')
                    .setType('COMMENT_REPLIED')
                    .setResource('LearningContent', contentId)
                    .viaAll()
                    .send()
                    .catch(err => console.error('Notification Error:', err));
            }
        });
    }
    return result;
});
const getCommentsFromDB = (contentId, query) => __awaiter(void 0, void 0, void 0, function* () {
    // Pre-filter: exclude comments by deleted users
    const deletedUserIds = yield user_model_1.User.find({ status: user_1.USER_STATUS.DELETED }).distinct('_id');
    const baseFilter = { contentId };
    if (deletedUserIds.length > 0) {
        baseFilter.userId = { $nin: deletedUserIds };
    }
    const commentQuery = new QueryBuilder_1.default(learning_content_model_1.LearningContentComment.find(baseFilter).populate('userId', 'name profileImage'), query)
        .sort()
        .paginate()
        .fields();
    const data = yield commentQuery.modelQuery;
    const pagination = yield commentQuery.getPaginationInfo();
    return { data, pagination };
});
const deleteCommentInDB = (commentId, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    const comment = yield learning_content_model_1.LearningContentComment.findById(commentId);
    if (!comment)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Comment not found');
    // Check if owner or admin
    const isOwner = comment.userId.toString() === userId;
    const isAdmin = userRole === 'SUPER_ADMIN'; // Adjust based on your role enum
    if (!isOwner && !isAdmin) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not authorized to delete this comment');
    }
    // Cascade delete: if top-level comment, delete its children too
    if (!comment.parentCommentId) {
        yield learning_content_model_1.LearningContentComment.deleteMany({ parentCommentId: commentId });
    }
    yield learning_content_model_1.LearningContentComment.findByIdAndDelete(commentId);
    yield syncCommentsCount(comment.contentId.toString());
});
exports.LearningContentService = {
    createLearningContentIntoDB,
    getAllLearningContentsFromDB,
    getSingleLearningContentFromDB,
    updateLearningContentInDB,
    deleteLearningContentFromDB,
    toggleLikeInDB,
    addCommentInDB,
    getCommentsFromDB,
    deleteCommentInDB,
};
