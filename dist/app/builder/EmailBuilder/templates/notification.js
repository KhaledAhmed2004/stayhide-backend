"use strict";
/**
 * General Notification Email Template
 *
 * A flexible template for various notifications.
 *
 * @variables
 * - name: User's name
 * - title: Notification title
 * - message: Main notification message
 * - actionText: CTA button text (optional)
 * - actionUrl: CTA button URL (optional)
 * - type: 'info' | 'success' | 'warning' | 'error'
 *
 * @example
 * ```typescript
 * const html = new EmailBuilder()
 *   .useTemplate('notification', {
 *     name: 'John',
 *     title: 'Your order has shipped!',
 *     message: 'Your order #12345 is on its way.',
 *     actionText: 'Track Order',
 *     actionUrl: 'https://example.com/track/12345',
 *     type: 'success'
 *   })
 *   .build();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notification = void 0;
exports.notification = {
    subject: '{{title}}',
    render: (variables, theme, components) => {
        const { name = 'there', title, message, actionText, actionUrl, type = 'info', appName = 'Our Platform', } = variables;
        // Get components from registry
        const headerComponent = components.get('header');
        const footerComponent = components.get('footer');
        const buttonComponent = components.get('button');
        const cardComponent = components.get('card');
        // Type-based styling
        const typeConfig = {
            info: { icon: 'ℹ️', variant: 'highlight' },
            success: { icon: '✅', variant: 'success' },
            warning: { icon: '⚠️', variant: 'warning' },
            error: { icon: '❌', variant: 'error' },
        };
        const config = typeConfig[type] || typeConfig.info;
        const headerHtml = headerComponent
            ? headerComponent({ title: `${config.icon} ${title}`, showLogo: true }, theme)
            : '';
        const messageCard = cardComponent
            ? cardComponent({ content: message, variant: config.variant }, theme)
            : `<p style="color: ${theme.colors.text}; font-size: 16px; line-height: 1.6;">${message}</p>`;
        const actionButton = actionText && actionUrl && buttonComponent
            ? buttonComponent({ text: actionText, href: actionUrl, variant: 'primary' }, theme)
            : '';
        const footerHtml = footerComponent
            ? footerComponent({ showSocial: false, showCompanyInfo: true }, theme)
            : '';
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.colors.background}; font-family: ${theme.fonts.primary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${theme.colors.background};">
    <tr>
      <td align="center" style="padding: ${theme.spacing.lg};">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: ${theme.colors.surface}; border-radius: ${theme.borderRadius}; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: ${theme.spacing.xl};">
              ${headerHtml}

              <p style="color: ${theme.colors.text}; font-size: 16px; line-height: 1.6; margin: ${theme.spacing.lg} 0;">
                Hi <strong>${name}</strong>,
              </p>

              ${messageCard}

              ${actionButton ? `
              <div style="text-align: center; margin: ${theme.spacing.lg} 0;">
                ${actionButton}
              </div>
              ` : ''}

              <p style="color: ${theme.colors.text}; font-size: 16px; margin: ${theme.spacing.lg} 0 0 0;">
                Best regards,<br>
                <strong>The ${appName} Team</strong>
              </p>

              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
    },
};
exports.default = exports.notification;
