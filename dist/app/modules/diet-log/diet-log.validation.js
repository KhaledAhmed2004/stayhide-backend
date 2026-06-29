"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DietLogValidation = void 0;
const zod_1 = require("zod");
const createDietLogZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
        mealType: zod_1.z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS']),
        name: zod_1.z.string().min(1, 'Name is required'),
        note: zod_1.z.string().optional(),
    }),
});
const updateDietLogZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        mealType: zod_1.z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS']).optional(),
        name: zod_1.z.string().min(1, 'Name is required').optional(),
        note: zod_1.z.string().optional(),
    }),
});
exports.DietLogValidation = {
    createDietLogZodSchema,
    updateDietLogZodSchema,
};
