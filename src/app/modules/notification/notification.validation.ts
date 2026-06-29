import { z } from 'zod';
import { USER_ROLES } from '../../../enums/user';

const sendNotification = z.object({
  body: z
    .object({
      title: z
        .string({ required_error: 'Title is required' })
        .min(1)
        .max(200),
      text: z
        .string({ required_error: 'Message is required' })
        .min(1)
        .max(5000),
      audience: z.enum([USER_ROLES.USER], {
        required_error: 'Audience is required',
      }),
    }),
});

export const NotificationValidation = { sendNotification };
