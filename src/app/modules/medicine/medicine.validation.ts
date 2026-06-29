import { z } from 'zod';

const createMedicationZodSchema = z
  .object({
    body: z.object({
      name: z.string({
        required_error: 'Medication name is required',
      }),
      dosage: z.object({
        amount: z.number().positive('Dosage amount must be positive'),
        unit: z.string().min(1, 'Dosage unit is required'),
      }),
      type: z.enum([
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
      notes: z.string().optional(),
      startDate: z.string().transform((val) => new Date(val)),
      endDate: z
        .string()
        .transform((val) => new Date(val))
        .optional()
        .nullable(),
      isOngoing: z.boolean(),
      frequency: z.object({
        frequencyType: z.enum([
          'DAILY',
          'WEEKLY',
          'MONTHLY',
          'CUSTOM',
          'AS_NEEDED',
          'HOURLY',
        ]),
        interval: z.number().positive().optional(),
        intervalUnit: z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH']).optional(),
        daysOfWeek: z
          .array(z.number().min(0).max(6))
          .optional(),
      }),
      dosingTimes: z.array(
        z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
      ),
      reminder: z.object({
        enabled: z.boolean().default(true),
        minutesBefore: z.number().min(0).max(1440).default(5),
      }).default({ enabled: true, minutesBefore: 5 }),
      inventory: z
        .object({
          totalQuantity: z.number().min(0),
          remainingQuantity: z.number().min(0),
          quantityPerDose: z.number().positive(),
        })
        .optional(),
    }),
  })
  .superRefine((data, ctx) => {
    // 1. Duration validation
    if (data.body.isOngoing && data.body.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate must be null if isOngoing is true',
        path: ['body', 'endDate'],
      });
    }
    if (!data.body.isOngoing && !data.body.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate is required if isOngoing is false',
        path: ['body', 'endDate'],
      });
    }

    // 2. Frequency validation
    const { frequencyType, daysOfWeek, interval, intervalUnit } = data.body.frequency;
    
    if (frequencyType === 'WEEKLY' && (!daysOfWeek || daysOfWeek.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'daysOfWeek is required for WEEKLY frequency',
        path: ['body', 'frequency', 'daysOfWeek'],
      });
    }
    
    if (frequencyType === 'DAILY' && daysOfWeek && daysOfWeek.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'daysOfWeek is forbidden for DAILY frequency',
        path: ['body', 'frequency', 'daysOfWeek'],
      });
    }

    if (frequencyType === 'CUSTOM' && (!interval || !intervalUnit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'interval and intervalUnit are required for CUSTOM frequency',
        path: ['body', 'frequency'],
      });
    }

    if (frequencyType === 'HOURLY' && (!interval || intervalUnit !== 'HOUR')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'interval is required and intervalUnit must be HOUR for HOURLY frequency',
        path: ['body', 'frequency'],
      });
    }

    // 3. Inventory validation
    if (data.body.inventory) {
      if (data.body.inventory.remainingQuantity > data.body.inventory.totalQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'remainingQuantity cannot exceed totalQuantity',
          path: ['body', 'inventory', 'remainingQuantity'],
        });
      }
    }
  });

const updateMedicationZodSchema = z
  .object({
    body: z.object({
      name: z.string().optional(),
      dosage: z
        .object({
          amount: z.number().positive(),
          unit: z.string().min(1),
        })
        .optional(),
      type: z
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
      notes: z.string().optional(),
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z
        .string()
        .transform((val) => new Date(val))
        .optional()
        .nullable(),
      isOngoing: z.boolean().optional(),
      frequency: z
        .object({
          frequencyType: z.enum([
            'DAILY',
            'WEEKLY',
            'MONTHLY',
            'CUSTOM',
            'AS_NEEDED',
            'HOURLY',
          ]),
          interval: z.number().positive().optional(),
          intervalUnit: z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH']).optional(),
          daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        })
        .optional(),
      dosingTimes: z
        .array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/))
        .optional(),
      reminder: z
        .object({
          enabled: z.boolean(),
          minutesBefore: z.number().min(0).max(1440),
        })
        .optional(),
      inventory: z
        .object({
          totalQuantity: z.number().min(0).optional(),
          remainingQuantity: z.number().min(0).optional(),
          quantityPerDose: z.number().positive().optional(),
        })
        .optional(),
    }),
  });

const logMedicationZodSchema = z.object({
  body: z.object({
    medicationId: z.string({
      required_error: 'Medication ID is required',
    }),
    dateString: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    scheduledTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    status: z.enum(['TAKEN', 'SKIPPED', 'MISSED']),
    takenAt: z.string().transform((val) => new Date(val)).optional(),
  }),
});

const refillInventoryZodSchema = z.object({
  body: z.object({
    quantity: z.number().positive('Refill quantity must be a positive number'),
  }),
});

export const MedicationValidation = {
  createMedicationZodSchema,
  updateMedicationZodSchema,
  logMedicationZodSchema,
  refillInventoryZodSchema,
};
