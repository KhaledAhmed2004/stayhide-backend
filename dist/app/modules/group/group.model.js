"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostComment = exports.PostLike = exports.GroupPost = exports.GroupMember = exports.Group = void 0;
const mongoose_1 = require("mongoose");
const user_1 = require("../../../enums/user");
// 1. Group Schema
const GroupSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    userType: { type: String, enum: [user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER], required: true },
    category: { type: String, required: true, index: true },
    memberCount: { type: Number, default: 0 },
    coverImage: { type: String, default: '' },
}, { timestamps: true });
// 2. Group Member Schema
const GroupMemberSchema = new mongoose_1.Schema({
    groupId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
}, { timestamps: false });
// 3. Group Post Schema
const GroupPostSchema = new mongoose_1.Schema({
    groupId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: { type: [String], default: [] },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
}, { timestamps: true });
// 4. Post Like Schema
const PostLikeSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'GroupPost', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: false });
// 5. Post Comment Schema
const PostCommentSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'GroupPost', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true },
    parentCommentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'PostComment',
        default: null,
    },
}, { timestamps: true });
// Compound indexes for efficiency
GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostCommentSchema.index({ postId: 1, createdAt: 1 });
PostCommentSchema.index({ parentCommentId: 1 });
GroupPostSchema.index({ userId: 1 });
GroupPostSchema.index({ isPinned: -1, createdAt: -1 });
GroupPostSchema.index({ createdAt: -1 });
exports.Group = (0, mongoose_1.model)('Group', GroupSchema);
exports.GroupMember = (0, mongoose_1.model)('GroupMember', GroupMemberSchema);
exports.GroupPost = (0, mongoose_1.model)('GroupPost', GroupPostSchema);
exports.PostLike = (0, mongoose_1.model)('PostLike', PostLikeSchema);
exports.PostComment = (0, mongoose_1.model)('PostComment', PostCommentSchema);
