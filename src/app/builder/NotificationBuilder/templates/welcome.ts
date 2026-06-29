/**
 * Welcome Notification Template
 *
 * Sent when a new user registers.
 *
 * @variables
 * - name: User's name
 * - appName: Application name
 * - verificationUrl: Email verification URL (optional)
 * - otp: OTP code for verification (optional)
 */

import { INotificationTemplate } from '../NotificationBuilder';

export const welcome: INotificationTemplate = {
  name: 'welcome',

  push: {
    title: '🎉 Welcome to {{appName}}!',
    body: 'Hi {{name}}, thanks for joining us!',
    data: {
      type: 'WELCOME',
      action: 'COMPLETE_PROFILE',
    },
  },

  // No socket for welcome (user just registered)
  socket: undefined,

  email: {
    template: 'welcome',
    subject: '🎉 Welcome to {{appName}}, {{name}}!',
  },

  // No database entry for welcome (not persistent notification)
  database: undefined,
};

export default welcome;
