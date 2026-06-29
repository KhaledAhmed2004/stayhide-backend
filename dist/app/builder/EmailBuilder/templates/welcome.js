"use strict";
/**
 * Welcome Email Template
 *
 * Sent when a new user creates an account.
 *
 * @variables
 * - name: User's name
 * - email: User's email
 * - verificationUrl: Email verification link (optional)
 * - otp: OTP code for verification (optional)
 *
 * @example
 * ```typescript
 * const html = new EmailBuilder()
 *   .useTemplate('welcome', {
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     verificationUrl: 'https://example.com/verify?token=abc123'
 *   })
 *   .build();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcome = void 0;
exports.welcome = {
    subject: 'Welcome to {{appName}}! 🎉',
    render: (variables, theme, components) => {
        const { name = 'there', email, verificationUrl, otp, appName = 'Our Platform', } = variables;
        // Get components from registry
        const buttonComponent = components.get('button');
        const headerComponent = components.get('header');
        const footerComponent = components.get('footer');
        const cardComponent = components.get('card');
        const otpComponent = components.get('otp');
        // Build sections
        const headerHtml = headerComponent
            ? headerComponent({ title: `Welcome, ${name}!`, subtitle: 'We\'re excited to have you on board' }, theme)
            : '';
        let verificationHtml = '';
        if (otp && otpComponent) {
            verificationHtml = otpComponent({ code: otp, expiresIn: '10 minutes' }, theme);
        }
        else if (verificationUrl && buttonComponent) {
            verificationHtml = buttonComponent({ text: 'Verify My Email', href: verificationUrl, variant: 'primary' }, theme);
        }
        const featuresHtml = cardComponent
            ? cardComponent({
                title: '🚀 What\'s Next?',
                content: `
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Complete your profile</li>
              <li>Explore our features</li>
              <li>Connect with the community</li>
            </ul>
          `,
                variant: 'highlight',
            }, theme)
            : '';
        const footerHtml = footerComponent
            ? footerComponent({ showSocial: true, showCompanyInfo: true }, theme)
            : '';
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${appName}</title>
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
                Thank you for creating an account with <strong>${appName}</strong>! We're thrilled to have you join our community.
              </p>

              ${email ? `
              <p style="color: ${theme.colors.textMuted}; font-size: 14px; margin: ${theme.spacing.md} 0;">
                Your account has been created with: <strong>${email}</strong>
              </p>
              ` : ''}

              ${verificationHtml ? `
              <div style="margin: ${theme.spacing.lg} 0; text-align: center;">
                <p style="color: ${theme.colors.text}; font-size: 16px; margin-bottom: ${theme.spacing.md};">
                  Please verify your email to get started:
                </p>
                ${verificationHtml}
              </div>
              ` : ''}

              ${featuresHtml}

              <p style="color: ${theme.colors.text}; font-size: 16px; line-height: 1.6; margin: ${theme.spacing.lg} 0;">
                If you have any questions, feel free to reply to this email or contact our support team. We're here to help!
              </p>

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
exports.default = exports.welcome;
