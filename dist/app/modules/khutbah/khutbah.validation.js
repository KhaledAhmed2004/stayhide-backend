"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KhutbaValidation = void 0;
const zod_1 = require("zod");
const createKhutbaZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required'),
        mosqueName: zod_1.z.string().min(1, 'Mosque name is required'),
        imam: zod_1.z.string().min(1, 'Imam name is required'),
        date: zod_1.z.string({ required_error: 'Date is required' }).datetime(),
        description: zod_1.z.string().optional(),
        audio: zod_1.z.string({ required_error: 'Audio file is required' }),
        thumbnail: zod_1.z.string({ required_error: 'Thumbnail image is required' }),
        durationInSeconds: zod_1.z.preprocess((val) => (val ? Number(val) : val), zod_1.z.number().optional()),
    }),
});
const updateKhutbaZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        mosqueName: zod_1.z.string().optional(),
        imam: zod_1.z.string().optional(),
        date: zod_1.z.string().datetime().optional(),
        description: zod_1.z.string().optional(),
        audio: zod_1.z.string().optional(),
        thumbnail: zod_1.z.string().optional(),
        durationInSeconds: zod_1.z.preprocess((val) => (val ? Number(val) : val), zod_1.z.number().optional()),
    }),
});
exports.KhutbaValidation = {
    createKhutbaZodSchema,
    updateKhutbaZodSchema,
};
