"use strict";
/**
 * Invoice Email Template
 *
 * Sent after a successful payment/purchase.
 *
 * @variables
 * - name: Customer's name
 * - invoiceNumber: Invoice/order number
 * - date: Invoice date
 * - items: Array of { name, quantity, price }
 * - subtotal: Subtotal amount
 * - tax: Tax amount
 * - total: Total amount
 * - paymentMethod: Payment method used
 * - downloadUrl: PDF invoice download link
 *
 * @example
 * ```typescript
 * const html = new EmailBuilder()
 *   .useTemplate('invoice', {
 *     name: 'John',
 *     invoiceNumber: 'INV-2024-001',
 *     date: 'Jan 15, 2024',
 *     items: [
 *       { name: 'Product A', quantity: 2, price: '$50.00' },
 *       { name: 'Service B', quantity: 1, price: '$100.00' }
 *     ],
 *     subtotal: '$200.00',
 *     tax: '$20.00',
 *     total: '$220.00'
 *   })
 *   .build();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoice = void 0;
exports.invoice = {
    subject: 'Invoice #{{invoiceNumber}} - Payment Received',
    render: (variables, theme, components) => {
        const { name = 'Customer', invoiceNumber = 'N/A', date = new Date().toLocaleDateString(), items = [], subtotal, tax, discount, total, paymentMethod, downloadUrl, appName = 'Our Platform', } = variables;
        // Get components from registry
        const headerComponent = components.get('header');
        const footerComponent = components.get('footer');
        const buttonComponent = components.get('button');
        const tableComponent = components.get('table');
        const cardComponent = components.get('card');
        const headerHtml = headerComponent
            ? headerComponent({ title: 'Payment Receipt', subtitle: `Invoice #${invoiceNumber}` }, theme)
            : '';
        // Build items table
        const tableHeaders = ['Item', 'Qty', 'Price'];
        const tableRows = items.map((item) => [
            item.name,
            String(item.quantity),
            item.price,
        ]);
        // Build footer rows for totals
        const totalRows = [];
        if (subtotal)
            totalRows.push(['Subtotal', '', subtotal]);
        if (discount)
            totalRows.push(['Discount', '', `-${discount}`]);
        if (tax)
            totalRows.push(['Tax', '', tax]);
        const itemsTableHtml = tableComponent
            ? tableComponent({ headers: tableHeaders, rows: tableRows, striped: true }, theme)
            : '';
        // Total summary card
        const totalSummary = cardComponent
            ? cardComponent({
                title: '💰 Total Amount',
                content: `<div style="font-size: 28px; font-weight: bold; color: ${theme.colors.primary};">${total}</div>`,
                variant: 'success',
            }, theme)
            : `<div style="text-align: center; padding: 20px; font-size: 28px; font-weight: bold; color: ${theme.colors.primary};">${total}</div>`;
        const downloadButton = downloadUrl && buttonComponent
            ? buttonComponent({ text: '📄 Download Invoice PDF', href: downloadUrl, variant: 'outline' }, theme)
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
  <title>Invoice #${invoiceNumber}</title>
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
                Thank you for your purchase! Your payment has been successfully processed.
              </p>

              <!-- Invoice Details -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: ${theme.spacing.lg} 0;">
                <tr>
                  <td style="padding: ${theme.spacing.md}; background-color: ${theme.colors.background}; border-radius: ${theme.borderRadius};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="color: ${theme.colors.textMuted}; font-size: 14px;">
                          <strong>Invoice Number:</strong> ${invoiceNumber}<br>
                          <strong>Date:</strong> ${date}
                          ${paymentMethod ? `<br><strong>Payment Method:</strong> ${paymentMethod}` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items Table -->
              <h3 style="color: ${theme.colors.text}; font-size: 18px; margin: ${theme.spacing.lg} 0 ${theme.spacing.md} 0;">
                Order Details
              </h3>
              ${itemsTableHtml}

              <!-- Totals -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: ${theme.spacing.md} 0;">
                <tr>
                  <td width="60%"></td>
                  <td width="40%">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
                      ${subtotal ? `
                      <tr>
                        <td style="padding: 8px 0; color: ${theme.colors.text};">Subtotal</td>
                        <td style="padding: 8px 0; text-align: right; color: ${theme.colors.text};">${subtotal}</td>
                      </tr>
                      ` : ''}
                      ${discount ? `
                      <tr>
                        <td style="padding: 8px 0; color: ${theme.colors.success};">Discount</td>
                        <td style="padding: 8px 0; text-align: right; color: ${theme.colors.success};">-${discount}</td>
                      </tr>
                      ` : ''}
                      ${tax ? `
                      <tr>
                        <td style="padding: 8px 0; color: ${theme.colors.text};">Tax</td>
                        <td style="padding: 8px 0; text-align: right; color: ${theme.colors.text};">${tax}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 0; border-top: 2px solid ${theme.colors.primary}; color: ${theme.colors.text}; font-weight: bold; font-size: 16px;">Total</td>
                        <td style="padding: 12px 0; border-top: 2px solid ${theme.colors.primary}; text-align: right; color: ${theme.colors.primary}; font-weight: bold; font-size: 16px;">${total}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${downloadButton ? `
              <div style="text-align: center; margin: ${theme.spacing.lg} 0;">
                ${downloadButton}
              </div>
              ` : ''}

              <p style="color: ${theme.colors.textMuted}; font-size: 14px; margin: ${theme.spacing.lg} 0;">
                If you have any questions about this invoice, please contact our support team.
              </p>

              <p style="color: ${theme.colors.text}; font-size: 16px; margin: ${theme.spacing.lg} 0 0 0;">
                Thank you for your business!<br>
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
exports.default = exports.invoice;
