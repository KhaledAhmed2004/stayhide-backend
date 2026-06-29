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
exports.GroupService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const group_model_1 = require("./group.model");
const mongoose_1 = __importDefault(require("mongoose"));
const user_1 = require("../../../enums/user");
const fileHandler_1 = require("../../middlewares/fileHandler");
const user_model_1 = require("../user/user.model");
const NotificationBuilder_1 = __importDefault(require("../../builder/NotificationBuilder/NotificationBuilder"));
const notification_model_1 = require("../notification/notification.model");
// Helper to check if user is a member of a group
const checkMembership = (groupId, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    if (userRole === user_1.USER_ROLES.SUPER_ADMIN)
        return true;
    const isMember = yield group_model_1.GroupMember.findOne({ groupId, userId });
    if (!isMember) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only members can access this resource');
    }
    return true;
});
const createGroupIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield group_model_1.Group.create(payload);
    return result;
});
const getSingleGroupFromDB = (groupId, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(groupId);
    if (!group)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Group not found');
    // Check role compatibility for non-admins
    if (userRole !== user_1.USER_ROLES.SUPER_ADMIN && group.userType !== userRole) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, `Access denied to ${group.userType} groups`);
    }
    const isMember = yield group_model_1.GroupMember.findOne({ groupId, userId });
    return Object.assign(Object.assign({}, group.toObject()), { isMember: !!isMember });
});
const updateGroupInDB = (groupId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield group_model_1.Group.findByIdAndUpdate(groupId, payload, { new: true });
    if (!result)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Group not found');
    return result;
});
const deleteGroupFromDB = (groupId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const group = yield group_model_1.Group.findById(groupId).session(session);
        if (!group)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Group not found');
        // Cascade delete: Members, Posts, Likes, Comments
        yield group_model_1.GroupMember.deleteMany({ groupId }).session(session);
        // Find all posts to delete their attachments
        const posts = yield group_model_1.GroupPost.find({ groupId }).session(session);
        for (const post of posts) {
            if (post.attachments && post.attachments.length > 0) {
                post.attachments.forEach(file => (0, fileHandler_1.deleteFile)(file).catch(() => { }));
            }
        }
        yield group_model_1.GroupPost.deleteMany({ groupId }).session(session);
        // Since likes and comments are per postId, and we just deleted the group, 
        // it's more efficient to just delete everything associated with the posts of this group.
        // However, if we want to be thorough:
        const postIds = posts.map(p => p._id);
        yield group_model_1.PostLike.deleteMany({ postId: { $in: postIds } }).session(session);
        yield group_model_1.PostComment.deleteMany({ postId: { $in: postIds } }).session(session);
        const result = yield group_model_1.Group.findByIdAndDelete(groupId).session(session);
        yield session.commitTransaction();
        return result;
    }
    catch (error) {
        yield session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
const getAllGroupsFromDB = (query, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    // Directly use the user's role to filter groups.
    // BROTHER sees BROTHER groups, SISTER sees SISTER groups.
    // SUPER_ADMIN sees ALL groups (no userType filter).
    const filter = {};
    if (userRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        filter.userType = userRole;
    }
    const groupQuery = new QueryBuilder_1.default(group_model_1.Group.find(filter), query)
        .textSearch()
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield groupQuery.modelQuery;
    const pagination = yield groupQuery.getPaginationInfo();
    let dataWithMembership = data;
    if (data && data.length > 0) {
        const groupIds = data.map((group) => group._id);
        const userMemberships = yield group_model_1.GroupMember.find({
            groupId: { $in: groupIds },
            userId: userId,
        });
        const joinedGroupIds = new Set(userMemberships.map(m => m.groupId.toString()));
        dataWithMembership = data.map((group) => (Object.assign(Object.assign({}, group.toObject()), { isMember: joinedGroupIds.has(group._id.toString()) })));
    }
    else {
        dataWithMembership = [];
    }
    return { data: dataWithMembership, pagination };
});
const joinGroupInDB = (groupId, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const group = yield group_model_1.Group.findById(groupId).session(session);
        if (!group)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Group not found');
        // Role restriction check: User's role must exactly match the group's userType
        // Bypass this check for SUPER_ADMIN
        if (userRole !== user_1.USER_ROLES.SUPER_ADMIN && group.userType !== userRole) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, `This group is only for ${group.userType}s. You are a ${userRole}.`);
        }
        const isAlreadyMember = yield group_model_1.GroupMember.findOne({ groupId, userId }).session(session);
        if (isAlreadyMember)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Already a member');
        const result = yield group_model_1.GroupMember.create([{ groupId, userId, role: 'member' }], { session });
        yield group_model_1.Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } }, { session });
        yield session.commitTransaction();
        return result[0];
    }
    catch (error) {
        yield session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
const leaveGroupInDB = (groupId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const result = yield group_model_1.GroupMember.findOneAndDelete({ groupId, userId }).session(session);
        if (!result)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You are not a member of this group');
        yield group_model_1.Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } }, { session });
        yield session.commitTransaction();
        return result;
    }
    catch (error) {
        yield session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
const createPostInDB = (groupId, userId, userRole, payload) => __awaiter(void 0, void 0, void 0, function* () {
    // SUPER_ADMIN has implicit membership in all groups
    if (userRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        const isMember = yield group_model_1.GroupMember.findOne({ groupId, userId });
        if (!isMember)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only members can post');
    }
    const result = yield group_model_1.GroupPost.create(Object.assign(Object.assign({}, payload), { groupId, userId }));
    return result;
});
const getGroupFeedFromDB = (groupId, query, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    // Security: Check if user is a member
    yield checkMembership(groupId, userId, userRole);
    const baseFilter = { groupId };
    // Pre-filter: exclude posts by deleted users
    const deletedUserIds = yield user_model_1.User.find({ status: user_1.USER_STATUS.DELETED }).distinct('_id');
    if (deletedUserIds.length > 0) {
        baseFilter.userId = { $nin: deletedUserIds };
    }
    const postQuery = new QueryBuilder_1.default(group_model_1.GroupPost.find(baseFilter).populate('userId', 'name profileImage'), query)
        .textSearch();
    if (query.sort) {
        postQuery.sort();
    }
    else {
        // Default sort: Pinned posts first, then newest
        postQuery.modelQuery = postQuery.modelQuery.sort({ isPinned: -1, createdAt: -1 });
    }
    postQuery.paginate().fields();
    const data = yield postQuery.modelQuery;
    const pagination = yield postQuery.getPaginationInfo();
    // Add isLiked flag for current user
    let postsWithLikeStatus;
    if (userId) {
        const postIds = data.map((p) => p._id);
        const userLikes = yield group_model_1.PostLike.find({
            postId: { $in: postIds },
            userId: userId,
        });
        const likedPostIds = new Set(userLikes.map(l => l.postId.toString()));
        postsWithLikeStatus = data.map((p) => (Object.assign(Object.assign({}, p.toObject()), { isLiked: likedPostIds.has(p._id.toString()) })));
    }
    else {
        postsWithLikeStatus = data.map((p) => p.toObject());
    }
    return { data: postsWithLikeStatus, pagination };
});
const toggleLikeInDB = (postId, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield group_model_1.GroupPost.findById(postId);
    if (!post)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Post not found');
    // Security: Check group membership
    yield checkMembership(post.groupId.toString(), userId, userRole);
    const removed = yield group_model_1.PostLike.findOneAndDelete({ postId, userId });
    if (removed) {
        yield group_model_1.GroupPost.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } });
        return { liked: false };
    }
    try {
        yield group_model_1.PostLike.create({ postId, userId });
        yield group_model_1.GroupPost.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });
        // Notify post owner
        if (post.userId.toString() !== userId) {
            // Notification Suppression: Check if we sent a notification for this post in the last 15 minutes
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            const recentNotification = yield notification_model_1.Notification.findOne({
                receiver: post.userId.toString(),
                type: 'POST_LIKED',
                resourceId: postId,
                createdAt: { $gte: fifteenMinutesAgo },
            });
            if (!recentNotification) {
                new NotificationBuilder_1.default()
                    .to(post.userId.toString())
                    .setTitle('New Like')
                    .setText('Someone liked your post.')
                    .setType('POST_LIKED')
                    .setResource('GroupPost', postId)
                    .viaAll()
                    .send()
                    .catch(err => console.error('Notification Error:', err));
            }
        }
        return { liked: true };
    }
    catch (err) {
        if (err.code === 11000) {
            return { liked: true };
        }
        throw err;
    }
});
const addCommentInDB = (postId, userId, userRole, comment, parentCommentId) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield group_model_1.GroupPost.findById(postId);
    if (!post)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Post not found');
    // Security: Check group membership
    yield checkMembership(post.groupId.toString(), userId, userRole);
    if (parentCommentId) {
        const parent = yield group_model_1.PostComment.findById(parentCommentId);
        if (!parent)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Parent comment not found');
        if (parent.postId.toString() !== postId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Parent comment belongs to another post');
        }
        if (parent.parentCommentId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Cannot reply to a nested comment');
        }
    }
    const result = yield group_model_1.PostComment.create({
        postId,
        userId,
        comment,
        parentCommentId: parentCommentId || null,
    });
    yield group_model_1.GroupPost.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
    // Notify post owner
    if (post.userId.toString() !== userId) {
        new NotificationBuilder_1.default()
            .to(post.userId.toString())
            .setTitle('New Comment')
            .setText('Someone commented on your post.')
            .setType('POST_COMMENTED')
            .setResource('GroupPost', postId)
            .viaAll()
            .send()
            .catch(err => console.error('Notification Error:', err));
    }
    // Notify parent comment owner (if reply)
    if (parentCommentId) {
        group_model_1.PostComment.findById(parentCommentId).then(parent => {
            if (parent && parent.userId.toString() !== userId) {
                new NotificationBuilder_1.default()
                    .to(parent.userId.toString())
                    .setTitle('New Reply')
                    .setText('Someone replied to your comment.')
                    .setType('COMMENT_REPLIED')
                    .setResource('GroupPost', postId)
                    .viaAll()
                    .send()
                    .catch(err => console.error('Notification Error:', err));
            }
        });
    }
    return result;
});
const deletePostInDB = (postId, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield group_model_1.GroupPost.findById(postId);
    if (!post)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Post not found');
    if (post.userId.toString() !== userId && userRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not authorized to delete this post');
    }
    if (post.attachments && post.attachments.length > 0) {
        post.attachments.forEach(file => (0, fileHandler_1.deleteFile)(file).catch(() => { }));
    }
    yield group_model_1.GroupPost.findByIdAndDelete(postId);
    yield group_model_1.PostComment.deleteMany({ postId });
    yield group_model_1.PostLike.deleteMany({ postId });
});
const deleteCommentInDB = (commentId, userId, userRole) => __awaiter(void 0, void 0, void 0, function* () {
    const comment = yield group_model_1.PostComment.findById(commentId);
    if (!comment)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Comment not found');
    if (comment.userId.toString() !== userId && userRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not authorized to delete this comment');
    }
    // Cascade delete: if top-level comment, delete its children too
    let deletedCount = 1;
    if (!comment.parentCommentId) {
        const children = yield group_model_1.PostComment.deleteMany({ parentCommentId: commentId });
        deletedCount += children.deletedCount;
    }
    yield group_model_1.PostComment.findByIdAndDelete(commentId);
    yield group_model_1.GroupPost.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -deletedCount } });
});
const updatePostInDB = (postId, userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield group_model_1.GroupPost.findById(postId);
    if (!post)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Post not found');
    if (post.userId.toString() !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not authorized to update this post');
    }
    // Delete orphaned attachments: files that were in the old post but not in the new payload
    if (payload.attachments !== undefined && post.attachments && post.attachments.length > 0) {
        const newAttachments = new Set(payload.attachments);
        const orphaned = post.attachments.filter(file => !newAttachments.has(file));
        orphaned.forEach(file => (0, fileHandler_1.deleteFile)(file).catch(() => { }));
    }
    const result = yield group_model_1.GroupPost.findByIdAndUpdate(postId, payload, { new: true });
    return result;
});
const updateCommentInDB = (commentId, userId, comment) => __awaiter(void 0, void 0, void 0, function* () {
    const commentDoc = yield group_model_1.PostComment.findById(commentId);
    if (!commentDoc)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Comment not found');
    if (commentDoc.userId.toString() !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Not authorized to update this comment');
    }
    const result = yield group_model_1.PostComment.findByIdAndUpdate(commentId, { comment }, { new: true });
    return result;
});
const getPostCommentsFromDB = (postId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const commentQuery = new QueryBuilder_1.default(group_model_1.PostComment.find({ postId }).populate('userId', 'name profileImage'), query)
        .sort()
        .paginate()
        .fields();
    const data = yield commentQuery.modelQuery;
    const pagination = yield commentQuery.getPaginationInfo();
    return { data, pagination };
});
const kickMemberFromDB = (groupId, userId, adminRole) => __awaiter(void 0, void 0, void 0, function* () {
    if (adminRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only Super Admin can kick members');
    }
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const result = yield group_model_1.GroupMember.findOneAndDelete({ groupId, userId }).session(session);
        if (!result)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Member not found');
        yield group_model_1.Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } }, { session });
        yield session.commitTransaction();
        return result;
    }
    catch (error) {
        yield session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
const togglePinPostInDB = (postId, adminRole) => __awaiter(void 0, void 0, void 0, function* () {
    if (adminRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only Super Admin can pin posts');
    }
    const post = yield group_model_1.GroupPost.findById(postId);
    if (!post)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Post not found');
    const result = yield group_model_1.GroupPost.findByIdAndUpdate(postId, { isPinned: !post.isPinned }, { new: true });
    return result;
});
exports.GroupService = {
    createGroupIntoDB,
    getAllGroupsFromDB,
    getSingleGroupFromDB,
    updateGroupInDB,
    deleteGroupFromDB,
    joinGroupInDB,
    leaveGroupInDB,
    createPostInDB,
    getGroupFeedFromDB,
    toggleLikeInDB,
    addCommentInDB,
    deletePostInDB,
    deleteCommentInDB,
    updatePostInDB,
    updateCommentInDB,
    getPostCommentsFromDB,
    kickMemberFromDB,
    togglePinPostInDB,
};
