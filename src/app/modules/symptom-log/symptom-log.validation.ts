import { z } from 'zod';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const dateParamSchema = z
  .string({ required_error: 'Date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, must be YYYY-MM-DD')
  .refine((date) => dayjs(date, 'YYYY-MM-DD', true).isValid(), {
    message: 'Invalid calendar date',
  })
  .refine(
    (date) => {
      // Must not be in the future (compared to today's local date)
      const today = dayjs().format('YYYY-MM-DD');
      return date <= today;
    },
    { message: 'Cannot log symptoms for future dates' }
  )
  .refine(
    (date) => {
      // Must not be older than 90 days
      const ninetyDaysAgo = dayjs().subtract(90, 'day').format('YYYY-MM-DD');
      return date >= ninetyDaysAgo;
    },
    { message: 'Cannot log symptoms older than 90 days' }
  );

const upsertSymptomLogZodSchema = z.object({
  params: z.object({
    date: dateParamSchema,
  }),
  body: z
    .object({
      hotFlashes: z
        .object({
          count: z.number().min(0).optional(),
          severity: z.number().min(1).max(5).optional(),
        })
        .optional(),
      nightSweats: z
        .object({
          severity: z.number().min(1).max(5).optional(),
        })
        .optional(),
      mood: z
        .object({
          value: z.enum(['excellent', 'good', 'neutral', 'bad', 'very_bad']),
        })
        .optional(),
      sleep: z
        .object({
          hours: z.number().min(0).max(24).optional(),
          quality: z.number().min(1).max(5).optional(),
        })
        .optional(),
      brainFog: z
        .object({
          severity: z.number().min(1).max(5).optional(),
        })
        .optional(),
      jointPain: z
        .object({
          severity: z.number().min(1).max(5).optional(),
        })
        .optional(),
      fatigue: z
        .object({
          severity: z.number().min(1).max(5).optional(),
        })
        .optional(),
      anxiety: z
        .object({
          severity: z.number().min(1).max(5).optional(),
        })
        .optional(),
      additionalNotes: z.string().max(1000).optional(),
    })
    .strict(),
});

const getSymptomLogZodSchema = z.object({
  params: z.object({
    date: dateParamSchema,
  }),
});

const getTrendsZodSchema = z.object({
  query: z.object({
    days: z
      .string()
      .refine((val) => ['7', '14', '30'].includes(val), {
        message: 'Days must be 7, 14, or 30',
      })
      .optional(),
  }),
});



export const SymptomLogValidation = {
  upsertSymptomLogZodSchema,
  getSymptomLogZodSchema,
  getTrendsZodSchema,
};
