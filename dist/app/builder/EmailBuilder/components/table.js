"use strict";
/**
 * Table Component
 *
 * A styled table for displaying data (order items, invoices, etc.)
 *
 * @example
 * ```typescript
 * builder.addComponent('table', {
 *   headers: ['Item', 'Qty', 'Price'],
 *   rows: [
 *     ['Product A', '2', '$50.00'],
 *     ['Product B', '1', '$25.00'],
 *   ],
 *   footer: ['Total', '', '$75.00'],
 *   striped: true,
 *   bordered: true
 * });
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.table = void 0;
const table = (props, theme) => {
    const { headers, rows, footer, striped = true, bordered = true, compact = false, } = props;
    const cellPadding = compact ? theme.spacing.sm : theme.spacing.md;
    const borderStyle = bordered ? `1px solid ${theme.colors.border}` : 'none';
    // Header row
    const headerHtml = headers ? `
    <tr>
      ${headers.map(header => `
        <th style="
          padding: ${cellPadding};
          background-color: ${theme.colors.primary};
          color: #FFFFFF;
          font-weight: bold;
          text-align: left;
          border: ${borderStyle};
        ">${header}</th>
      `).join('')}
    </tr>
  ` : '';
    // Data rows
    const rowsHtml = rows.map((row, index) => `
    <tr>
      ${row.map(cell => `
        <td style="
          padding: ${cellPadding};
          background-color: ${striped && index % 2 === 1 ? '#F9F9F9' : theme.colors.surface};
          color: ${theme.colors.text};
          border: ${borderStyle};
        ">${cell}</td>
      `).join('')}
    </tr>
  `).join('');
    // Footer row (for totals, etc.)
    const footerHtml = footer ? `
    <tr>
      ${footer.map(cell => `
        <td style="
          padding: ${cellPadding};
          background-color: ${theme.colors.background};
          color: ${theme.colors.text};
          font-weight: bold;
          border: ${borderStyle};
          border-top: 2px solid ${theme.colors.primary};
        ">${cell}</td>
      `).join('')}
    </tr>
  ` : '';
    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: ${theme.spacing.md} 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="
            font-family: ${theme.fonts.primary};
            font-size: 14px;
            border-collapse: collapse;
            border-radius: ${theme.borderRadius};
            overflow: hidden;
          ">
            ${headerHtml}
            ${rowsHtml}
            ${footerHtml}
          </table>
        </td>
      </tr>
    </table>
  `.trim();
};
exports.table = table;
exports.default = exports.table;
