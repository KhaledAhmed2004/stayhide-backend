"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationValidation = void 0;
const zod_1 = require("zod");
const createMedicationZodSchema = zod_1.z
    .object({
    body: zod_1.z.object({
        name: zod_1.z.string({
            required_error: 'Medication name is required',
        }),
        dosage: zod_1.z.object({
            amount: zod_1.z.number().positive('Dosage amount must be positive'),
            unit: zod_1.z.string().min(1, 'Dosage unit is required'),
        }),
        type: zod_1.z.enum([
            'TABLET',
            'CAPSULE',
            'SYRUP',
            'INJECTION',
            'DROPS',
            'INHALER',
            'CREAM',
            'OINTMENT',
            'OTHER',
        ]),
        notes: zod_1.z.string().optional(),
        startDate: zod_1.z.string().transform((val) => new Date(val)),
        endDate: zod_1.z
            .string()
            .transform((val) => new Date(val))
            .optional()
            .nullable(),
        isOngoing: zod_1.z.boolean(),
        frequency: zod_1.z.object({
            frequencyType: zod_1.z.enum([
                'DAILY',
                'WEEKLY',
                'MONTHLY',
                'CUSTOM',
                'AS_NEEDED',
                'HOURLY',
            ]),
            interval: zod_1.z.number().positive().optional(),
            intervalUnit: zod_1.z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH']).optional(),
            daysOfWeek: zod_1.z
                .array(zod_1.z.number().min(0).max(6))
                .optional(),
        }),
        dosingTimes: zod_1.z.array(zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')),
        reminder: zod_1.z.object({
            enabled: zod_1.z.boolean().default(true),
            minutesBefore: zod_1.z.number().min(0).max(1440).default(5),
        }).default({ enabled: true, minutesBefore: 5 }),
        inventory: zod_1.z
            .object({
            totalQuantity: zod_1.z.number().min(0),
            remainingQuantity: zod_1.z.number().min(0),
            quantityPerDose: zod_1.z.number().positive(),
        })
            .optional(),
    }),
})
    .superRefine((data, ctx) => {
    // 1. Duration validation
    if (data.body.isOngoing && data.body.endDate) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'endDate must be null if isOngoing is true',
            path: ['body', 'endDate'],
        });
    }
    if (!data.body.isOngoing && !data.body.endDate) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'endDate is required if isOngoing is false',
            path: ['body', 'endDate'],
        });
    }
    // 2. Frequency validation
    const { frequencyType, daysOfWeek, interval, intervalUnit } = data.body.frequency;
    if (frequencyType === 'WEEKLY' && (!daysOfWeek || daysOfWeek.length === 0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'daysOfWeek is required for WEEKLY frequency',
            path: ['body', 'frequency', 'daysOfWeek'],
        });
    }
    if (frequencyType === 'DAILY' && daysOfWeek && daysOfWeek.length > 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'daysOfWeek is forbidden for DAILY frequency',
            path: ['body', 'frequency', 'daysOfWeek'],
        });
    }
    if (frequencyType === 'CUSTOM' && (!interval || !intervalUnit)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'interval and intervalUnit are required for CUSTOM frequency',
            path: ['body', 'frequency'],
        });
    }
    if (frequencyType === 'HOURLY' && (!interval || intervalUnit !== 'HOUR')) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'interval is required and intervalUnit must be HOUR for HOURLY frequency',
            path: ['body', 'frequency'],
        });
    }
    // 3. Inventory validation
    if (data.body.inventory) {
        if (data.body.inventory.remainingQuantity > data.body.inventory.totalQuantity) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'remainingQuantity cannot exceed totalQuantity',
                path: ['body', 'inventory', 'remainingQuantity'],
            });
        }
    }
});
const updateMedicationZodSchema = zod_1.z
    .object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        dosage: zod_1.z
            .object({
            amount: zod_1.z.number().positive(),
            unit: zod_1.z.string().min(1),
        })
            .optional(),
        type: zod_1.z
            .enum([
            'TABLET',
            'CAPSULE',
            'SYRUP',
            'INJECTION',
            'DROPS',
            'INHALER',
            'CREAM',
            'OINTMENT',
            'OTHER',
        ])
            .optional(),
        notes: zod_1.z.string().optional(),
        startDate: zod_1.z.string().transform((val) => new Date(val)).optional(),
        endDate: zod_1.z
            .string()
            .transform((val) => new Date(val))
            .optional()
            .nullable(),
        isOngoing: zod_1.z.boolean().optional(),
        frequency: zod_1.z
            .object({
            frequencyType: zod_1.z.enum([
                'DAILY',
                'WEEKLY',
                'MONTHLY',
                'CUSTOM',
                'AS_NEEDED',
                'HOURLY',
            ]),
            interval: zod_1.z.number().positive().optional(),
            intervalUnit: zod_1.z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH']).optional(),
            daysOfWeek: zod_1.z.array(zod_1.z.number().min(0).max(6)).optional(),
        })
            .optional(),
        dosingTimes: zod_1.z
            .array(zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/))
            .optional(),
        reminder: zod_1.z
            .object({
            enabled: zod_1.z.boolean(),
            minutesBefore: zod_1.z.number().min(0).max(1440),
        })
            .optional(),
        inventory: zod_1.z
            .object({
            totalQuantity: zod_1.z.number().min(0).optional(),
            remainingQuantity: zod_1.z.number().min(0).optional(),
            quantityPerDose: zod_1.z.number().positive().optional(),
        })
            .optional(),
    }),
});
const logMedicationZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        medicationId: zod_1.z.string({
            required_error: 'Medication ID is required',
        }),
        dateString: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
        scheduledTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
        status: zod_1.z.enum(['TAKEN', 'SKIPPED', 'MISSED']),
        takenAt: zod_1.z.string().transform((val) => new Date(val)).optional(),
    }),
});
const refillInventoryZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        quantity: zod_1.z.number().positive('Refill quantity must be a positive number'),
    }),
});
exports.MedicationValidation = {
    createMedicationZodSchema,
    updateMedicationZodSchema,
    logMedicationZodSchema,
    refillInventoryZodSchema,
};
