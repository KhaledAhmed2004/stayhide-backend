"use strict";
/**
 * OTP Verification Email Template
 *
 * Sent when user needs to verify their identity with an OTP.
 *
 * @variables
 * - name: User's name
 * - otp: The OTP code
 * - expiresIn: Expiration time (e.g., "10 minutes")
 * - purpose: What the OTP is for (e.g., "login", "password reset")
 *
 * @example
 * ```typescript
 * const html = new EmailBuilder()
 *   .useTemplate('otp', {
 *     name: 'John',
 *     otp: '123456',
 *     expiresIn: '10 minutes',
 *     purpose: 'account verification'
 *   })
 *   .build();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpTemplate = void 0;
exports.otpTemplate = {
    subject: 'Your Verification Code: {{otp}}',
    render: (variables, theme, components) => {
        const { name = 'there', otp, expiresIn = '10 minutes', purpose = 'verification', appName = 'Our Platform', } = variables;
        // Get components from registry
        const headerComponent = components.get('header');
        const footerComponent = components.get('footer');
        const otpComponent = components.get('otp');
        const cardComponent = components.get('card');
        const headerHtml = headerComponent
            ? headerComponent({ title: 'Verification Code', subtitle: `For ${purpose}` }, theme)
            : '';
        const otpHtml = otpComponent
            ? otpComponent({ code: otp, expiresIn }, theme)
            : `<div style="text-align: center; font-size: 32px; font-weight: bold; color: ${theme.colors.primary}; letter-spacing: 8px; padding: 20px;">${otp}</div>`;
        const securityNotice = cardComponent
            ? cardComponent({
                title: '🔒 Security Notice',
                content: 'If you didn\'t request this code, please ignore this email. Someone may have entered your email address by mistake.',
                variant: 'warning',
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
  <title>Your Verification Code</title>
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
                You requested a verification code for <strong>${purpose}</strong>. Please use the code below to complete your ${purpose}:
              </p>

              ${otpHtml}

              <p style="color: ${theme.colors.textMuted}; font-size: 14px; text-align: center; margin: ${theme.spacing.md} 0;">
                Please do not share this code with anyone.
              </p>

              ${securityNotice}

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
exports.default = exports.otpTemplate;
