import { z } from 'zod';

const sendMessageZodSchema = z.object({
  body: z.object({
    message: z.string({
      required_error: 'Message is required',
    }),
    sessionId: z.string().optional(),
  }),
});

export const AiCoachValidation = {
  sendMessageZodSchema,
};
