"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningContentValidation = void 0;
const zod_1 = require("zod");
const createLearningContentZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({
            required_error: 'Title is required',
        }),
        description: zod_1.z.string({
            required_error: 'Description is required',
        }),
        category: zod_1.z.string({
            required_error: 'Category is required',
        }),
        video: zod_1.z.string({
            required_error: 'Video file is required',
        }),
        durationInSeconds: zod_1.z.preprocess((val) => (val ? Number(val) : val), zod_1.z.number().optional()),
    }),
});
const updateLearningContentZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        category: zod_1.z.string().optional(),
        video: zod_1.z.string().optional(),
        durationInSeconds: zod_1.z.preprocess((val) => (val ? Number(val) : val), zod_1.z.number().optional()),
    }),
});
const addCommentZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        comment: zod_1.z.string({
            required_error: 'Comment is required',
        }),
        parentCommentId: zod_1.z.string().optional(),
    }),
});
exports.LearningContentValidation = {
    createLearningContentZodSchema,
    updateLearningContentZodSchema,
    addCommentZodSchema,
};
