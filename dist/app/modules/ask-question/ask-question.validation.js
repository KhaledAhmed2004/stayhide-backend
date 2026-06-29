"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskQuestionValidation = void 0;
const zod_1 = require("zod");
const submitQuestionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        question: zod_1.z
            .string({ required_error: 'Question is required' })
            .trim()
            .min(1, 'Question cannot be empty')
            .max(2000, 'Question cannot exceed 2000 characters'),
        image: zod_1.z.string().optional(),
    }),
});
const answerQuestionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        answer: zod_1.z.string().min(1, 'Answer is required'),
    }),
});
exports.AskQuestionValidation = {
    submitQuestionZodSchema,
    answerQuestionZodSchema,
};
