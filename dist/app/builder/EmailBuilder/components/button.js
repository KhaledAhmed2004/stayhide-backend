"use strict";
/**
 * Button Component
 *
 * A styled call-to-action button for emails.
 *
 * @example
 * ```typescript
 * builder.addComponent('button', {
 *   text: 'Click Here',
 *   href: 'https://example.com',
 *   variant: 'primary', // 'primary' | 'secondary' | 'outline'
 *   fullWidth: false,
 *   align: 'center' // 'left' | 'center' | 'right'
 * });
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.button = void 0;
const button = (props, theme) => {
    const { text, href, variant = 'primary', fullWidth = false, align = 'center', } = props;
    // Variant styles
    const variants = {
        primary: {
            backgroundColor: theme.colors.primary,
            color: '#FFFFFF',
            border: 'none',
        },
        secondary: {
            backgroundColor: theme.colors.secondary,
            color: '#FFFFFF',
            border: 'none',
        },
        outline: {
            backgroundColor: 'transparent',
            color: theme.colors.primary,
            border: `2px solid ${theme.colors.primary}`,
        },
    };
    const style = variants[variant];
    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="${align}" style="padding: ${theme.spacing.md} 0;">
          <a href="${href}" target="_blank" style="
            display: inline-block;
            ${fullWidth ? 'width: 100%; text-align: center;' : ''}
            padding: 14px 28px;
            background-color: ${style.backgroundColor};
            color: ${style.color};
            ${style.border !== 'none' ? `border: ${style.border};` : ''}
            border-radius: ${theme.borderRadius};
            font-family: ${theme.fonts.primary};
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            box-sizing: border-box;
          ">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
};
exports.button = button;
exports.default = exports.button;
