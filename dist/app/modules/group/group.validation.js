"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const createGroupZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Group name is required' }),
        description: zod_1.z.string({ required_error: 'Description is required' }),
        userType: zod_1.z.enum([user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER], { required_error: 'User type is required' }),
        category: zod_1.z.string({ required_error: 'Category name is required' }),
        coverImage: zod_1.z.string().optional(),
    }),
});
const createPostZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string({ required_error: 'Post content is required' }),
        attachments: zod_1.z.array(zod_1.z.string()).max(5, 'Maximum 5 attachments allowed').optional(),
    }),
});
const addCommentZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        comment: zod_1.z.string({ required_error: 'Comment is required' }),
        parentCommentId: zod_1.z.string().optional(),
    }),
});
const updatePostZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string().optional(),
        attachments: zod_1.z.array(zod_1.z.string()).max(5, 'Maximum 5 attachments allowed').optional(),
    }),
});
const updateCommentZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        comment: zod_1.z.string({ required_error: 'Comment is required' }),
    }),
});
const updateGroupZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        userType: zod_1.z.enum([user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER]).optional(),
        category: zod_1.z.string().optional(),
        coverImage: zod_1.z.string().optional(),
    }),
});
exports.GroupValidation = {
    createGroupZodSchema,
    updateGroupZodSchema,
    createPostZodSchema,
    addCommentZodSchema,
    updatePostZodSchema,
    updateCommentZodSchema,
};
