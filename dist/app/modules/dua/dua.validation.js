"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuaValidation = void 0;
const zod_1 = require("zod");
const createDuaZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required'),
        waqt: zod_1.z.enum(['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'], {
            required_error: 'Waqt is required',
        }),
        details: zod_1.z.string().min(1, 'Details are required'),
        audio: zod_1.z.string({ required_error: 'Audio file is required' }),
    }),
});
const updateDuaZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        waqt: zod_1.z.enum(['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha']).optional(),
        details: zod_1.z.string().optional(),
        audio: zod_1.z.string().optional(),
    }),
});
exports.DuaValidation = {
    createDuaZodSchema,
    updateDuaZodSchema,
};
