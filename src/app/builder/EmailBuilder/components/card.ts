/**
 * Card Component
 *
 * A styled card/box for highlighting content.
 *
 * @example
 * ```typescript
 * builder.addComponent('card', {
 *   title: 'Order Summary',
 *   content: 'Your order #12345 has been confirmed.',
 *   variant: 'default', // 'default' | 'success' | 'warning' | 'error' | 'highlight'
 *   icon: '📦'
 * });
 * ```
 */

import { IEmailTheme } from '../EmailBuilder';

interface CardProps {
  title?: string;
  content: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'highlight';
  icon?: string;
}

export const card = (props: CardProps, theme: IEmailTheme): string => {
  const {
    title,
    content,
    variant = 'default',
    icon,
  } = props;

  // Variant styles
  const variants = {
    default: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      titleColor: theme.colors.text,
    },
    success: {
      backgroundColor: '#E8F5E9',
      borderColor: theme.colors.success,
      titleColor: theme.colors.success,
    },
    warning: {
      backgroundColor: '#FFF8E1',
      borderColor: theme.colors.warning,
      titleColor: '#F57C00',
    },
    error: {
      backgroundColor: '#FFEBEE',
      borderColor: theme.colors.error,
      titleColor: theme.colors.error,
    },
    highlight: {
      backgroundColor: '#E3F2FD',
      borderColor: theme.colors.primary,
      titleColor: theme.colors.primary,
    },
  };

  const style = variants[variant];

  const iconHtml = icon ? `
    <span style="font-size: 24px; margin-right: ${theme.spacing.sm};">${icon}</span>
  ` : '';

  const titleHtml = title ? `
    <div style="
      display: flex;
      align-items: center;
      margin-bottom: ${theme.spacing.sm};
      color: ${style.titleColor};
      font-size: 18px;
      font-weight: bold;
    ">
      ${iconHtml}
      ${title}
    </div>
  ` : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: ${theme.spacing.md} 0;">
          <div style="
            background-color: ${style.backgroundColor};
            border: 1px solid ${style.borderColor};
            border-left: 4px solid ${style.borderColor};
            border-radius: ${theme.borderRadius};
            padding: ${theme.spacing.lg};
            font-family: ${theme.fonts.primary};
          ">
            ${titleHtml}
            <div style="color: ${theme.colors.text}; font-size: 15px; line-height: 1.6;">
              ${content}
            </div>
          </div>
        </td>
      </tr>
    </table>
  `.trim();
};

export default card;
