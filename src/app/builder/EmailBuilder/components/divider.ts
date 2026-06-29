/**
 * Divider Component
 *
 * A horizontal divider/separator line.
 *
 * @example
 * ```typescript
 * builder.addComponent('divider', {
 *   spacing: 'md', // 'sm' | 'md' | 'lg'
 *   style: 'solid', // 'solid' | 'dashed' | 'dotted'
 *   color: '#E0E0E0'
 * });
 * ```
 */

import { IEmailTheme } from '../EmailBuilder';

interface DividerProps {
  spacing?: 'sm' | 'md' | 'lg';
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
}

export const divider = (props: DividerProps, theme: IEmailTheme): string => {
  const {
    spacing = 'md',
    style = 'solid',
    color,
  } = props;

  const spacingMap = {
    sm: theme.spacing.sm,
    md: theme.spacing.md,
    lg: theme.spacing.lg,
  };

  const borderColor = color || theme.colors.border;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: ${spacingMap[spacing]} 0;">
          <hr style="
            border: none;
            border-top: 1px ${style} ${borderColor};
            margin: 0;
          " />
        </td>
      </tr>
    </table>
  `.trim();
};

export default divider;
