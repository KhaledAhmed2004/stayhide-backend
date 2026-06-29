/**
 * Email Channel - EmailBuilder Integration
 *
 * Sends email notifications using the EmailBuilder.
 * Templates must exist in EmailBuilder/templates/.
 */

import { EmailBuilder } from '../../EmailBuilder';

interface IUser {
  _id: any;
  email?: string;
  name?: string;
}

interface EmailContent {
  template: string;
  subject: string;
  theme?: string;
  variables: Record<string, any>;
}

interface EmailResult {
  sent: number;
  failed: string[];
}

/**
 * Send email notifications via EmailBuilder
 */
export const sendEmail = async (
  users: IUser[],
  content: EmailContent
): Promise<EmailResult> => {
  const result: EmailResult = { sent: 0, failed: [] };

  for (const user of users) {
    // Skip users without email
    if (!user.email) {
      continue;
    }

    try {
      // Merge user data with variables
      const variables: Record<string, any> = {
        ...content.variables,
        name: user.name || 'User',
        email: user.email,
        userId: user._id.toString(),
      };

      // Build email using EmailBuilder
      const builder = new EmailBuilder();

      // Set theme if specified
      if (content.theme) {
        builder.setTheme(content.theme);
      }

      // Try to use template, fall back to manual if template doesn't exist
      try {
        builder.useTemplate(content.template, variables);
      } catch (templateError) {
        // Template doesn't exist in EmailBuilder, create simple email
        console.warn(
          `EmailBuilder template "${content.template}" not found, using fallback`
        );

        builder
          .setSubject(content.subject)
          .setVariables(variables)
          .addComponent('header', { title: content.subject })
          .addText(variables.message || variables.text || 'You have a new notification.')
          .addComponent('footer');
      }

      const { html, subject } = builder.build();

      // Send email
      await EmailBuilder.send({
        to: user.email,
        subject: content.subject || subject,
        html,
      });

      result.sent++;
    } catch (error) {
      console.error(`Email send error for user ${user._id}:`, error);
      result.failed.push(user._id.toString());
    }
  }

  return result;
};

export default sendEmail;
