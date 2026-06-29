"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const sendNotification = zod_1.z.object({
    body: zod_1.z
        .object({
        title: zod_1.z
            .string({ required_error: 'Title is required' })
            .min(1)
            .max(200),
        text: zod_1.z
            .string({ required_error: 'Message is required' })
            .min(1)
            .max(5000),
        audience: zod_1.z.enum([user_1.USER_ROLES.USER], {
            required_error: 'Audience is required',
        }),
    }),
});
exports.NotificationValidation = { sendNotification };
