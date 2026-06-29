"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymptomLogValidation = void 0;
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
dayjs_1.default.extend(customParseFormat_1.default);
const dateParamSchema = zod_1.z
    .string({ required_error: 'Date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, must be YYYY-MM-DD')
    .refine((date) => (0, dayjs_1.default)(date, 'YYYY-MM-DD', true).isValid(), {
    message: 'Invalid calendar date',
})
    .refine((date) => {
    // Must not be in the future (compared to today's local date)
    const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
    return date <= today;
}, { message: 'Cannot log symptoms for future dates' })
    .refine((date) => {
    // Must not be older than 90 days
    const ninetyDaysAgo = (0, dayjs_1.default)().subtract(90, 'day').format('YYYY-MM-DD');
    return date >= ninetyDaysAgo;
}, { message: 'Cannot log symptoms older than 90 days' });
const upsertSymptomLogZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        date: dateParamSchema,
    }),
    body: zod_1.z
        .object({
        hotFlashes: zod_1.z
            .object({
            count: zod_1.z.number().min(0).optional(),
            severity: zod_1.z.number().min(1).max(5).optional(),
        })
            .optional(),
        nightSweats: zod_1.z
            .object({
            severity: zod_1.z.number().min(1).max(5).optional(),
        })
            .optional(),
        mood: zod_1.z
            .object({
            value: zod_1.z.enum(['excellent', 'good', 'neutral', 'bad', 'very_bad']),
        })
            .optional(),
        sleep: zod_1.z
            .object({
            hours: zod_1.z.number().min(0).max(24).optional(),
            quality: zod_1.z.number().min(1).max(5).optional(),
        })
            .optional(),
        brainFog: zod_1.z
            .object({
            severity: zod_1.z.number().min(1).max(5).optional(),
        })
            .optional(),
        jointPain: zod_1.z
            .object({
            severity: zod_1.z.number().min(1).max(5).optional(),
        })
            .optional(),
        fatigue: zod_1.z
            .object({
            severity: zod_1.z.number().min(1).max(5).optional(),
        })
            .optional(),
        anxiety: zod_1.z
            .object({
            severity: zod_1.z.number().min(1).max(5).optional(),
        })
            .optional(),
        additionalNotes: zod_1.z.string().max(1000).optional(),
    })
        .strict(),
});
const getSymptomLogZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        date: dateParamSchema,
    }),
});
const getTrendsZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        days: zod_1.z
            .string()
            .refine((val) => ['7', '14', '30'].includes(val), {
            message: 'Days must be 7, 14, or 30',
        })
            .optional(),
    }),
});
exports.SymptomLogValidation = {
    upsertSymptomLogZodSchema,
    getSymptomLogZodSchema,
    getTrendsZodSchema,
};
