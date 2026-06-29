"use strict";
/**
 * Password Reset Email Template
 *
 * Sent when a user requests to reset their password.
 *
 * @variables
 * - name: User's name
 * - resetUrl: Password reset link
 * - otp: OTP code (alternative to resetUrl)
 * - expiresIn: Link/code expiration time
 *
 * @example
 * ```typescript
 * const html = new EmailBuilder()
 *   .useTemplate('resetPassword', {
 *     name: 'John',
 *     resetUrl: 'https://example.com/reset?token=abc123',
 *     expiresIn: '1 hour'
 *   })
 *   .build();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = void 0;
exports.resetPassword = {
    subject: 'Reset Your Password',
    render: (variables, theme, components) => {
        const { name = 'there', resetUrl, otp, expiresIn = '1 hour', appName = 'Our Platform', } = variables;
        // Get components from registry
        const buttonComponent = components.get('button');
        const headerComponent = components.get('header');
        const footerComponent = components.get('footer');
        const cardComponent = components.get('card');
        const otpComponent = components.get('otp');
        const headerHtml = headerComponent
            ? headerComponent({ title: 'Password Reset', subtitle: 'We received a request to reset your password' }, theme)
            : '';
        let resetMethodHtml = '';
        if (otp && otpComponent) {
            resetMethodHtml = `
        <p style="color: ${theme.colors.text}; font-size: 16px; text-align: center; margin: ${theme.spacing.md} 0;">
          Use this code to reset your password:
        </p>
        ${otpComponent({ code: otp, expiresIn }, theme)}
      `;
        }
        else if (resetUrl && buttonComponent) {
            resetMethodHtml = `
        <p style="color: ${theme.colors.text}; font-size: 16px; text-align: center; margin: ${theme.spacing.md} 0;">
          Click the button below to reset your password:
        </p>
        ${buttonComponent({ text: 'Reset My Password', href: resetUrl, variant: 'primary' }, theme)}
        <p style="color: ${theme.colors.textMuted}; font-size: 13px; text-align: center; margin: ${theme.spacing.md} 0;">
          Or copy and paste this link: <br>
          <a href="${resetUrl}" style="color: ${theme.colors.primary}; word-break: break-all;">${resetUrl}</a>
        </p>
      `;
        }
        const securityTips = cardComponent
            ? cardComponent({
                title: '🛡️ Security Tips',
                content: `
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Choose a strong, unique password</li>
              <li>Don't reuse passwords from other sites</li>
              <li>Consider using a password manager</li>
            </ul>
          `,
                variant: 'highlight',
            }, theme)
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
  <title>Reset Your Password</title>
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

              <p style="color: ${theme.colors.text}; font-size: 16px; line-height: 1.6; margin: ${theme.spacing.md} 0;">
                We received a request to reset the password for your <strong>${appName}</strong> account.
              </p>

              <div style="margin: ${theme.spacing.lg} 0;">
                ${resetMethodHtml}
              </div>

              <p style="color: ${theme.colors.textMuted}; font-size: 14px; margin: ${theme.spacing.md} 0;">
                This ${otp ? 'code' : 'link'} will expire in <strong>${expiresIn}</strong>.
              </p>

              ${securityTips}

              <div style="margin: ${theme.spacing.lg} 0; padding: ${theme.spacing.md}; background-color: #FFF3CD; border-radius: ${theme.borderRadius};">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ Didn't request this?</strong><br>
                  If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
              </div>

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
exports.default = exports.resetPassword;
