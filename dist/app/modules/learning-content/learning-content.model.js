"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningContentComment = exports.LearningContentLike = exports.LearningContent = void 0;
const mongoose_1 = require("mongoose");
const learningContentSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    videoUrl: { type: String, required: true },
    category: { type: String, required: true, index: true },
    durationInSeconds: { type: Number },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
}, { timestamps: true });
const learningContentLikeSchema = new mongoose_1.Schema({
    contentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LearningContent', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
const learningContentCommentSchema = new mongoose_1.Schema({
    contentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LearningContent', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true },
    parentCommentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'LearningContentComment',
        default: null,
    },
}, { timestamps: true });
// Indexes
learningContentLikeSchema.index({ contentId: 1, userId: 1 }, { unique: true });
learningContentCommentSchema.index({ contentId: 1, createdAt: 1 });
learningContentCommentSchema.index({ parentCommentId: 1 });
exports.LearningContent = (0, mongoose_1.model)('LearningContent', learningContentSchema);
exports.LearningContentLike = (0, mongoose_1.model)('LearningContentLike', learningContentLikeSchema);
exports.LearningContentComment = (0, mongoose_1.model)('LearningContentComment', learningContentCommentSchema);
