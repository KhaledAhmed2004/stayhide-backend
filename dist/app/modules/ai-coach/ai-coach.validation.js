"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCoachValidation = void 0;
const zod_1 = require("zod");
const sendMessageZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        message: zod_1.z.string({
            required_error: 'Message is required',
        }),
        sessionId: zod_1.z.string().optional(),
    }),
});
exports.AiCoachValidation = {
    sendMessageZodSchema,
};
