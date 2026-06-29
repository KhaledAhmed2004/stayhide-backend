"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.divider = void 0;
const divider = (props, theme) => {
    const { spacing = 'md', style = 'solid', color, } = props;
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
exports.divider = divider;
exports.default = exports.divider;
