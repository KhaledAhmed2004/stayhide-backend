import { z } from 'zod';

const createDietLogZodSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS']),
    name: z.string().min(1, 'Name is required'),
    note: z.string().optional(),
  }),
});

const updateDietLogZodSchema = z.object({
  body: z.object({
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS']).optional(),
    name: z.string().min(1, 'Name is required').optional(),
    note: z.string().optional(),
  }),
});

export const DietLogValidation = {
  createDietLogZodSchema,
  updateDietLogZodSchema,
};
