"use strict";
/**
 * OTP Display Component
 *
 * A styled OTP/verification code display.
 *
 * @example
 * ```typescript
 * builder.addComponent('otp', {
 *   code: '123456',
 *   label: 'Your verification code is:',
 *   expiresIn: '10 minutes'
 * });
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.otp = void 0;
const otp = (props, theme) => {
    const { code, label = 'Your verification code is:', expiresIn, } = props;
    // Split code into individual characters for styling
    const codeChars = code.split('');
    const expiresHtml = expiresIn ? `
    <p style="
      margin: ${theme.spacing.md} 0 0 0;
      color: ${theme.colors.textMuted};
      font-size: 14px;
    ">
      This code will expire in <strong>${expiresIn}</strong>
    </p>
  ` : '';
    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding: ${theme.spacing.lg} 0;">
          <p style="
            margin: 0 0 ${theme.spacing.md} 0;
            color: ${theme.colors.text};
            font-family: ${theme.fonts.primary};
            font-size: 16px;
          ">${label}</p>

          <div style="
            display: inline-block;
            background-color: ${theme.colors.background};
            border: 2px dashed ${theme.colors.primary};
            border-radius: ${theme.borderRadius};
            padding: ${theme.spacing.md} ${theme.spacing.lg};
          ">
            ${codeChars.map(char => `
              <span style="
                display: inline-block;
                width: 40px;
                height: 50px;
                line-height: 50px;
                margin: 0 4px;
                background-color: ${theme.colors.surface};
                border: 1px solid ${theme.colors.border};
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 28px;
                font-weight: bold;
                color: ${theme.colors.primary};
                text-align: center;
              ">${char}</span>
            `).join('')}
          </div>

          ${expiresHtml}
        </td>
      </tr>
    </table>
  `.trim();
};
exports.otp = otp;
exports.default = exports.otp;
