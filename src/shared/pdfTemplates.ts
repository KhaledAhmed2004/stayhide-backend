import PDFBuilder from '../app/builder/PDFBuilder';

// ============ INTERFACES ============

export interface InvoiceData {
  invoiceNumber: string;
  companyName: string;
  companyLogo?: string;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: string;
    total: string;
  }>;
  subtotal: string;
  tax?: string;
  discount?: string;
  total: string;
  notes?: string;
  dueDate?: Date;
}

export interface ReceiptData {
  receiptId: string;
  companyName: string;
  companyLogo?: string;
  customerName: string;
  customerEmail?: string;
  amount: string;
  paymentMethod: string;
  transactionId?: string;
  date: Date;
  items?: Array<{
    name: string;
    qty: number;
    price: string;
  }>;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  companyName?: string;
  companyLogo?: string;
  sections: Array<{
    title: string;
    content?: string;
    table?: {
      headers: string[];
      rows: (string | number)[][];
    };
  }>;
  generatedAt?: Date;
}

export interface QuotationData {
  quotationNumber: string;
  companyName: string;
  companyLogo?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    description?: string;
    qty: number;
    unitPrice: string;
    total: string;
  }>;
  subtotal: string;
  tax?: string;
  discount?: string;
  total: string;
  validUntil?: Date;
  terms?: string[];
  notes?: string;
}

export interface OrderConfirmationData {
  orderId: string;
  companyName: string;
  companyLogo?: string;
  customerName: string;
  customerEmail?: string;
  billingAddress?: string;
  shippingAddress?: string;
  items: Array<{
    name: string;
    qty: number;
    price: string;
    image?: string;
  }>;
  subtotal: string;
  shipping?: string;
  tax?: string;
  total: string;
  paymentStatus: 'paid' | 'pending' | 'failed';
  paymentMethod?: string;
  estimatedDelivery?: Date;
  trackingNumber?: string;
  orderDate: Date;
}

export interface PayslipData {
  payslipId: string;
  companyName: string;
  companyLogo?: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department?: string;
  payPeriod: string;
  payDate: Date;
  bankName?: string;
  accountNumber?: string;
  earnings: Array<{
    label: string;
    amount: string;
  }>;
  deductions: Array<{
    label: string;
    amount: string;
  }>;
  grossEarnings: string;
  totalDeductions: string;
  netPay: string;
}

export interface CertificateData {
  certificateId: string;
  recipientName: string;
  title: string;
  description: string;
  issuedBy: string;
  issuerTitle?: string;
  issuerSignature?: string;
  companyLogo?: string;
  date: Date;
  badgeImage?: string;
}

export interface FormField {
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'signature' | 'section';
  label: string;
  value?: string | boolean;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface FormData {
  title: string;
  subtitle?: string;
  companyName?: string;
  companyLogo?: string;
  fields: FormField[];
  submittedAt?: Date;
  referenceId?: string;
}

// ============ INVOICE TEMPLATE ============

export const invoiceTemplate = (data: InvoiceData): PDFBuilder => {
  const builder = new PDFBuilder()
    .setTheme('corporate')
    .setTitle(`Invoice #${data.invoiceNumber}`)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName,
      subtitle: `Invoice #${data.invoiceNumber}`,
      showDate: true,
      style: { gradient: 'linear-gradient(135deg, #1E40AF, #3B82F6)' },
    })
    .addSpacer(20)
    .addText({ content: 'Bill To:', style: 'subheading' })
    .addText({ content: data.customerName, style: 'body' });

  if (data.customerEmail) {
    builder.addText({
      content: data.customerEmail,
      style: 'caption',
      color: '#64748B',
    });
  }

  if (data.customerAddress) {
    builder.addText({
      content: data.customerAddress,
      style: 'caption',
      color: '#64748B',
    });
  }

  if (data.dueDate) {
    builder.addText({
      content: `Due Date: ${data.dueDate.toLocaleDateString()}`,
      style: 'body',
      color: '#DC2626',
      margin: { top: 10 },
    });
  }

  builder
    .addSpacer(20)
    .addTable({
      headers: ['Item', 'Qty', 'Unit Price', 'Total'],
      rows: data.items.map(i => [i.name, i.qty, i.unitPrice, i.total]),
      striped: true,
      headerStyle: { background: '#1E40AF', color: 'white' },
    })
    .addDivider({ thickness: 2, color: '#1E40AF' })
    .addText({
      content: `Subtotal: ${data.subtotal}`,
      align: 'right',
      style: 'body',
    });

  if (data.tax) {
    builder.addText({
      content: `Tax: ${data.tax}`,
      align: 'right',
      style: 'body',
    });
  }

  if (data.discount) {
    builder.addText({
      content: `Discount: -${data.discount}`,
      align: 'right',
      style: 'body',
      color: '#059669',
    });
  }

  builder
    .addText({
      content: `Total: ${data.total}`,
      align: 'right',
      style: 'heading',
      color: '#059669',
      fontSize: 20,
    })
    .addSpacer(30)
    .addText({
      content: data.notes || 'Thank you for your business!',
      align: 'center',
      style: 'caption',
    })
    .setFooter({
      showPageNumbers: true,
      text: `© ${new Date().getFullYear()} ${data.companyName}`,
    });

  return builder;
};

// ============ RECEIPT TEMPLATE ============

export const receiptTemplate = (data: ReceiptData): PDFBuilder => {
  const builder = new PDFBuilder()
    .setTheme('minimal')
    .setPageSize('A4')
    .setTitle(`Receipt #${data.receiptId}`)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName,
      subtitle: 'Payment Receipt',
      showDate: true,
    })
    .addText({
      content: '✓ Payment Successful',
      style: 'badge',
      color: '#059669',
      backgroundColor: '#D1FAE5',
      align: 'center',
    })
    .addSpacer(20);

  // If items provided, show itemized receipt
  if (data.items && data.items.length > 0) {
    builder.addTable({
      headers: ['Item', 'Qty', 'Price'],
      rows: data.items.map(i => [i.name, i.qty, i.price]),
      striped: true,
    });
    builder.addDivider();
  }

  builder
    .addTable({
      headers: ['Description', 'Details'],
      rows: [
        ['Receipt No', data.receiptId],
        ['Customer', data.customerName],
        ['Amount', data.amount],
        ['Payment Method', data.paymentMethod],
        ['Transaction ID', data.transactionId || 'N/A'],
        ['Date', data.date.toLocaleDateString()],
      ],
    })
    .addSpacer(30)
    .addText({
      content: 'Thank you for your payment!',
      align: 'center',
      style: 'body',
    })
    .setFooter({ text: 'This is a computer generated receipt' });

  return builder;
};

// ============ BANGLA RECEIPT TEMPLATE ============

export const banglaReceiptTemplate = (data: ReceiptData): PDFBuilder => {
  return new PDFBuilder()
    .setTheme('modern')
    .setFont('bangla')
    .setTitle(`রসিদ #${data.receiptId}`)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName,
      subtitle: 'পেমেন্ট রসিদ',
      showDate: true,
    })
    .addText({
      content: '✓ পেমেন্ট সফল',
      style: 'badge',
      color: '#059669',
      backgroundColor: '#D1FAE5',
      align: 'center',
    })
    .addSpacer(20)
    .addTable({
      headers: ['বিবরণ', 'তথ্য'],
      rows: [
        ['রসিদ নং', data.receiptId],
        ['গ্রাহক', data.customerName],
        ['পরিমাণ', data.amount],
        ['পেমেন্ট পদ্ধতি', data.paymentMethod],
        ['ট্রানজেকশন আইডি', data.transactionId || 'প্রযোজ্য নয়'],
        ['তারিখ', data.date.toLocaleDateString('bn-BD')],
      ],
      striped: true,
    })
    .addSpacer(20)
    .addText({
      content: 'আপনার পেমেন্টের জন্য ধন্যবাদ!',
      align: 'center',
      style: 'body',
    })
    .setFooter({ text: 'এটি একটি কম্পিউটার জেনারেটেড রসিদ' });
};

// ============ REPORT TEMPLATE ============

export const reportTemplate = (data: ReportData): PDFBuilder => {
  const builder = new PDFBuilder()
    .setTheme('corporate')
    .setTitle(data.title)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName || data.title,
      subtitle: data.subtitle,
      showDate: true,
    });

  data.sections.forEach((section, index) => {
    if (index > 0) {
      builder.addSpacer(20);
    }

    builder.addText({
      content: section.title,
      style: 'heading',
    });

    if (section.content) {
      builder.addText({
        content: section.content,
        style: 'body',
      });
    }

    if (section.table) {
      builder.addTable({
        headers: section.table.headers,
        rows: section.table.rows,
        striped: true,
      });
    }
  });

  builder.setFooter({
    showPageNumbers: true,
    text: `Generated on ${(data.generatedAt || new Date()).toLocaleDateString()}`,
  });

  return builder;
};

// ============ SIMPLE DOCUMENT TEMPLATE ============

export const simpleDocument = (
  title: string,
  content: string,
  options?: {
    theme?: 'modern' | 'classic' | 'minimal' | 'corporate';
    showDate?: boolean;
  }
): PDFBuilder => {
  return new PDFBuilder()
    .setTheme(options?.theme || 'minimal')
    .setTitle(title)
    .setHeader({
      title: title,
      showDate: options?.showDate ?? true,
    })
    .addText({ content, style: 'body' });
};

// ============ QUOTATION TEMPLATE ============

export const quotationTemplate = (data: QuotationData): PDFBuilder => {
  const builder = new PDFBuilder()
    .setTheme('corporate')
    .setTitle(`Quotation #${data.quotationNumber}`)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName,
      subtitle: `Quotation #${data.quotationNumber}`,
      showDate: true,
      style: { gradient: 'linear-gradient(135deg, #7C3AED, #A855F7)' },
    })
    .addSpacer(15);

  // Company details (left) and Customer details (right) via HTML
  builder.addHTML(`
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <div style="width: 45%;">
        <h4 style="color: #7C3AED; margin-bottom: 8px;">From:</h4>
        <p style="margin: 2px 0; font-weight: bold;">${data.companyName}</p>
        ${data.companyAddress ? `<p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.companyAddress}</p>` : ''}
        ${data.companyPhone ? `<p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.companyPhone}</p>` : ''}
        ${data.companyEmail ? `<p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.companyEmail}</p>` : ''}
      </div>
      <div style="width: 45%;">
        <h4 style="color: #7C3AED; margin-bottom: 8px;">To:</h4>
        <p style="margin: 2px 0; font-weight: bold;">${data.customerName}</p>
        ${data.customerAddress ? `<p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.customerAddress}</p>` : ''}
        ${data.customerPhone ? `<p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.customerPhone}</p>` : ''}
        ${data.customerEmail ? `<p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.customerEmail}</p>` : ''}
      </div>
    </div>
  `);

  if (data.validUntil) {
    builder.addText({
      content: `Valid Until: ${data.validUntil.toLocaleDateString()}`,
      style: 'body',
      color: '#DC2626',
    });
  }

  builder
    .addSpacer(15)
    .addTable({
      headers: ['Item', 'Description', 'Qty', 'Unit Price', 'Total'],
      rows: data.items.map(i => [i.name, i.description || '-', i.qty, i.unitPrice, i.total]),
      striped: true,
      headerStyle: { background: '#7C3AED', color: 'white' },
    })
    .addDivider({ thickness: 2, color: '#7C3AED' })
    .addText({
      content: `Subtotal: ${data.subtotal}`,
      align: 'right',
      style: 'body',
    });

  if (data.tax) {
    builder.addText({ content: `Tax: ${data.tax}`, align: 'right', style: 'body' });
  }
  if (data.discount) {
    builder.addText({ content: `Discount: -${data.discount}`, align: 'right', style: 'body', color: '#059669' });
  }

  builder.addText({
    content: `Total: ${data.total}`,
    align: 'right',
    style: 'heading',
    color: '#7C3AED',
    fontSize: 20,
  });

  if (data.terms && data.terms.length > 0) {
    builder.addSpacer(20).addText({ content: 'Terms & Conditions:', style: 'subheading' });
    data.terms.forEach((term, i) => {
      builder.addText({ content: `${i + 1}. ${term}`, style: 'caption', color: '#64748B' });
    });
  }

  if (data.notes) {
    builder.addSpacer(15).addText({ content: `Note: ${data.notes}`, style: 'caption', color: '#64748B' });
  }

  builder.setFooter({
    showPageNumbers: true,
    text: `${data.companyName} | This quotation is valid until ${data.validUntil?.toLocaleDateString() || 'further notice'}`,
  });

  return builder;
};

// ============ ORDER CONFIRMATION TEMPLATE ============

export const orderConfirmationTemplate = (data: OrderConfirmationData): PDFBuilder => {
  const statusColors = {
    paid: { bg: '#D1FAE5', text: '#059669', label: 'Paid' },
    pending: { bg: '#FEF3C7', text: '#D97706', label: 'Pending' },
    failed: { bg: '#FEE2E2', text: '#DC2626', label: 'Failed' },
  };
  const status = statusColors[data.paymentStatus];

  const builder = new PDFBuilder()
    .setTheme('modern')
    .setTitle(`Order #${data.orderId}`)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName,
      subtitle: 'Order Confirmation',
      showDate: true,
      style: { gradient: 'linear-gradient(135deg, #059669, #10B981)' },
    })
    .addText({
      content: `Order #${data.orderId}`,
      style: 'heading',
      align: 'center',
    })
    .addText({
      content: status.label,
      style: 'badge',
      color: status.text,
      backgroundColor: status.bg,
      align: 'center',
    })
    .addSpacer(20);

  // Customer & Order Info
  builder.addHTML(`
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <div style="width: 45%;">
        <h4 style="color: #059669; margin-bottom: 8px;">Customer Details</h4>
        <p style="margin: 2px 0; font-weight: bold;">${data.customerName}</p>
        ${data.customerEmail ? `<p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.customerEmail}</p>` : ''}
      </div>
      <div style="width: 45%;">
        <h4 style="color: #059669; margin-bottom: 8px;">Order Info</h4>
        <p style="margin: 2px 0; font-size: 12px;"><strong>Date:</strong> ${data.orderDate.toLocaleDateString()}</p>
        ${data.paymentMethod ? `<p style="margin: 2px 0; font-size: 12px;"><strong>Payment:</strong> ${data.paymentMethod}</p>` : ''}
        ${data.trackingNumber ? `<p style="margin: 2px 0; font-size: 12px;"><strong>Tracking:</strong> ${data.trackingNumber}</p>` : ''}
      </div>
    </div>
  `);

  if (data.shippingAddress || data.billingAddress) {
    builder.addHTML(`
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        ${data.billingAddress ? `
          <div style="width: 45%;">
            <h4 style="color: #059669; margin-bottom: 8px;">Billing Address</h4>
            <p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.billingAddress}</p>
          </div>
        ` : ''}
        ${data.shippingAddress ? `
          <div style="width: 45%;">
            <h4 style="color: #059669; margin-bottom: 8px;">Shipping Address</h4>
            <p style="margin: 2px 0; color: #64748B; font-size: 12px;">${data.shippingAddress}</p>
          </div>
        ` : ''}
      </div>
    `);
  }

  builder
    .addTable({
      headers: ['Item', 'Qty', 'Price'],
      rows: data.items.map(i => [i.name, i.qty, i.price]),
      striped: true,
      headerStyle: { background: '#059669', color: 'white' },
    })
    .addDivider()
    .addText({ content: `Subtotal: ${data.subtotal}`, align: 'right', style: 'body' });

  if (data.shipping) {
    builder.addText({ content: `Shipping: ${data.shipping}`, align: 'right', style: 'body' });
  }
  if (data.tax) {
    builder.addText({ content: `Tax: ${data.tax}`, align: 'right', style: 'body' });
  }

  builder.addText({
    content: `Total: ${data.total}`,
    align: 'right',
    style: 'heading',
    color: '#059669',
    fontSize: 20,
  });

  if (data.estimatedDelivery) {
    builder.addSpacer(20).addText({
      content: `Estimated Delivery: ${data.estimatedDelivery.toLocaleDateString()}`,
      align: 'center',
      style: 'body',
      color: '#059669',
    });
  }

  builder.setFooter({
    showPageNumbers: true,
    text: `Thank you for shopping with ${data.companyName}!`,
  });

  return builder;
};

// ============ PAYSLIP TEMPLATE ============

export const payslipTemplate = (data: PayslipData): PDFBuilder => {
  const builder = new PDFBuilder()
    .setTheme('corporate')
    .setTitle(`Payslip - ${data.payPeriod}`)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName,
      subtitle: 'Salary Slip',
      showDate: false,
      style: { gradient: 'linear-gradient(135deg, #1E40AF, #3B82F6)' },
    })
    .addText({
      content: `Pay Period: ${data.payPeriod}`,
      align: 'center',
      style: 'subheading',
    })
    .addSpacer(15);

  // Employee Details
  builder.addHTML(`
    <div style="background: #F1F5F9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between;">
        <div>
          <p style="margin: 4px 0;"><strong>Employee Name:</strong> ${data.employeeName}</p>
          <p style="margin: 4px 0;"><strong>Employee ID:</strong> ${data.employeeId}</p>
          <p style="margin: 4px 0;"><strong>Designation:</strong> ${data.designation}</p>
          ${data.department ? `<p style="margin: 4px 0;"><strong>Department:</strong> ${data.department}</p>` : ''}
        </div>
        <div>
          <p style="margin: 4px 0;"><strong>Pay Date:</strong> ${data.payDate.toLocaleDateString()}</p>
          ${data.bankName ? `<p style="margin: 4px 0;"><strong>Bank:</strong> ${data.bankName}</p>` : ''}
          ${data.accountNumber ? `<p style="margin: 4px 0;"><strong>Account:</strong> ****${data.accountNumber.slice(-4)}</p>` : ''}
        </div>
      </div>
    </div>
  `);

  // Earnings & Deductions side by side
  builder.addHTML(`
    <div style="display: flex; justify-content: space-between; gap: 20px;">
      <div style="width: 48%;">
        <h4 style="color: #059669; border-bottom: 2px solid #059669; padding-bottom: 5px;">Earnings</h4>
        <table style="width: 100%; font-size: 13px;">
          ${data.earnings.map(e => `<tr><td>${e.label}</td><td style="text-align: right;">${e.amount}</td></tr>`).join('')}
          <tr style="font-weight: bold; border-top: 1px solid #E2E8F0;">
            <td>Gross Earnings</td>
            <td style="text-align: right; color: #059669;">${data.grossEarnings}</td>
          </tr>
        </table>
      </div>
      <div style="width: 48%;">
        <h4 style="color: #DC2626; border-bottom: 2px solid #DC2626; padding-bottom: 5px;">Deductions</h4>
        <table style="width: 100%; font-size: 13px;">
          ${data.deductions.map(d => `<tr><td>${d.label}</td><td style="text-align: right;">${d.amount}</td></tr>`).join('')}
          <tr style="font-weight: bold; border-top: 1px solid #E2E8F0;">
            <td>Total Deductions</td>
            <td style="text-align: right; color: #DC2626;">${data.totalDeductions}</td>
          </tr>
        </table>
      </div>
    </div>
  `);

  builder
    .addSpacer(20)
    .addDivider({ thickness: 2, color: '#1E40AF' })
    .addHTML(`
      <div style="background: #1E40AF; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-top: 10px;">
        <p style="margin: 0; font-size: 14px;">Net Pay</p>
        <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold;">${data.netPay}</p>
      </div>
    `)
    .addSpacer(30)
    .addText({
      content: 'This is a computer generated payslip and does not require a signature.',
      align: 'center',
      style: 'caption',
      color: '#64748B',
    })
    .setFooter({
      text: `${data.companyName} | Payslip ID: ${data.payslipId}`,
    });

  return builder;
};

// ============ CERTIFICATE TEMPLATE ============

export const certificateTemplate = (data: CertificateData): PDFBuilder => {
  return new PDFBuilder()
    .setTheme('classic')
    .setPageSize('A4')
    .setOrientation('landscape')
    .setTitle(data.title)
    .addHTML(`
      <div style="
        border: 15px double #B8860B;
        padding: 40px;
        margin: 20px;
        min-height: 400px;
        background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
        text-align: center;
        position: relative;
      ">
        ${data.companyLogo ? `<img src="${data.companyLogo}" style="height: 60px; margin-bottom: 10px;" />` : ''}

        <h1 style="
          font-family: 'Georgia', serif;
          font-size: 42px;
          color: #B8860B;
          margin: 10px 0;
          letter-spacing: 3px;
        ">CERTIFICATE</h1>

        <p style="font-size: 18px; color: #666; margin: 5px 0;">OF ${data.title.toUpperCase()}</p>

        <p style="font-size: 16px; color: #333; margin-top: 30px;">This is to certify that</p>

        <h2 style="
          font-family: 'Georgia', serif;
          font-size: 36px;
          color: #1E3A5F;
          margin: 15px 0;
          border-bottom: 2px solid #B8860B;
          display: inline-block;
          padding-bottom: 5px;
        ">${data.recipientName}</h2>

        <p style="font-size: 16px; color: #333; max-width: 600px; margin: 20px auto; line-height: 1.6;">
          ${data.description}
        </p>

        ${data.badgeImage ? `<img src="${data.badgeImage}" style="height: 80px; margin: 15px 0;" />` : ''}

        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding: 0 50px;">
          <div style="text-align: center;">
            <p style="font-size: 14px; color: #666;">${data.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <div style="border-top: 1px solid #333; width: 150px; margin-top: 5px;"></div>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">Date</p>
          </div>

          <div style="text-align: center;">
            ${data.issuerSignature ? `<img src="${data.issuerSignature}" style="height: 40px;" />` : '<div style="height: 40px;"></div>'}
            <div style="border-top: 1px solid #333; width: 150px; margin-top: 5px;"></div>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">${data.issuedBy}</p>
            ${data.issuerTitle ? `<p style="font-size: 10px; color: #999;">${data.issuerTitle}</p>` : ''}
          </div>
        </div>

        <p style="
          position: absolute;
          bottom: 10px;
          right: 20px;
          font-size: 10px;
          color: #999;
        ">Certificate ID: ${data.certificateId}</p>
      </div>
    `);
};

// ============ DYNAMIC FORM TEMPLATE ============

const renderFormField = (field: FormField): string => {
  const labelStyle = 'font-weight: 600; color: #374151; margin-bottom: 5px; display: block;';
  const fieldStyle = 'border: 1px solid #D1D5DB; border-radius: 6px; padding: 10px; background: #F9FAFB; min-height: 20px;';
  const required = field.required ? '<span style="color: #DC2626;">*</span>' : '';

  switch (field.type) {
    case 'section':
      return `
        <div style="margin: 25px 0 15px 0; border-bottom: 2px solid #3B82F6; padding-bottom: 5px;">
          <h3 style="color: #1E40AF; margin: 0; font-size: 16px;">${field.label}</h3>
        </div>
      `;

    case 'text':
    case 'date':
      return `
        <div style="margin-bottom: 15px;">
          <label style="${labelStyle}">${field.label} ${required}</label>
          <div style="${fieldStyle}">${field.value || field.placeholder || ''}</div>
        </div>
      `;

    case 'textarea':
      return `
        <div style="margin-bottom: 15px;">
          <label style="${labelStyle}">${field.label} ${required}</label>
          <div style="${fieldStyle} min-height: 60px;">${field.value || field.placeholder || ''}</div>
        </div>
      `;

    case 'select':
      return `
        <div style="margin-bottom: 15px;">
          <label style="${labelStyle}">${field.label} ${required}</label>
          <div style="${fieldStyle}">
            ${field.value || (field.options ? field.options[0] : '')}
            <span style="float: right; color: #9CA3AF;">▼</span>
          </div>
        </div>
      `;

    case 'checkbox':
      return `
        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
          <div style="
            width: 20px;
            height: 20px;
            border: 2px solid ${field.value ? '#3B82F6' : '#D1D5DB'};
            border-radius: 4px;
            background: ${field.value ? '#3B82F6' : 'white'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
          ">${field.value ? '✓' : ''}</div>
          <label style="color: #374151;">${field.label} ${required}</label>
        </div>
      `;

    case 'radio':
      return `
        <div style="margin-bottom: 15px;">
          <label style="${labelStyle}">${field.label} ${required}</label>
          <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 8px;">
            ${(field.options || []).map(opt => `
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="
                  width: 18px;
                  height: 18px;
                  border: 2px solid ${field.value === opt ? '#3B82F6' : '#D1D5DB'};
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  ${field.value === opt ? '<div style="width: 10px; height: 10px; background: #3B82F6; border-radius: 50%;"></div>' : ''}
                </div>
                <span style="color: #374151; font-size: 14px;">${opt}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

    case 'signature':
      return `
        <div style="margin-bottom: 15px;">
          <label style="${labelStyle}">${field.label} ${required}</label>
          <div style="
            border: 1px dashed #D1D5DB;
            border-radius: 6px;
            padding: 20px;
            background: #FAFAFA;
            min-height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${field.value
              ? `<img src="${field.value}" style="max-height: 60px;" />`
              : '<span style="color: #9CA3AF; font-style: italic;">Signature</span>'
            }
          </div>
        </div>
      `;

    default:
      return '';
  }
};

export const formTemplate = (data: FormData): PDFBuilder => {
  const builder = new PDFBuilder()
    .setTheme('modern')
    .setTitle(data.title)
    .setHeader({
      logo: data.companyLogo,
      title: data.companyName || data.title,
      subtitle: data.subtitle,
      showDate: true,
    });

  if (data.referenceId) {
    builder.addText({
      content: `Reference ID: ${data.referenceId}`,
      style: 'caption',
      color: '#64748B',
      align: 'right',
    });
  }

  builder.addSpacer(10);

  // Render all form fields
  const fieldsHtml = data.fields.map(field => renderFormField(field)).join('');
  builder.addHTML(`<div style="padding: 0 10px;">${fieldsHtml}</div>`);

  if (data.submittedAt) {
    builder.addSpacer(20).addText({
      content: `Submitted on: ${data.submittedAt.toLocaleString()}`,
      style: 'caption',
      color: '#64748B',
      align: 'right',
    });
  }

  builder.setFooter({
    showPageNumbers: true,
    text: data.companyName ? `${data.companyName}` : 'Generated Form',
  });

  return builder;
};

// ============ PRE-BUILT FORM TEMPLATES ============

export const jobApplicationForm = (data: {
  applicantName?: string;
  email?: string;
  phone?: string;
  position?: string;
  experience?: string;
  education?: string;
  address?: string;
  companyName?: string;
  companyLogo?: string;
}): PDFBuilder => {
  return formTemplate({
    title: 'Job Application Form',
    companyName: data.companyName,
    companyLogo: data.companyLogo,
    referenceId: `JOB-${Date.now().toString(36).toUpperCase()}`,
    fields: [
      { type: 'section', label: 'Personal Information' },
      { type: 'text', label: 'Full Name', value: data.applicantName, required: true },
      { type: 'text', label: 'Email Address', value: data.email, required: true },
      { type: 'text', label: 'Phone Number', value: data.phone, required: true },
      { type: 'textarea', label: 'Address', value: data.address },
      { type: 'section', label: 'Professional Information' },
      { type: 'text', label: 'Position Applied For', value: data.position, required: true },
      { type: 'radio', label: 'Years of Experience', options: ['0-1 years', '1-3 years', '3-5 years', '5+ years'], value: data.experience },
      { type: 'select', label: 'Highest Education', options: ['High School', 'Bachelor\'s', 'Master\'s', 'PhD'], value: data.education },
      { type: 'section', label: 'Declaration' },
      { type: 'checkbox', label: 'I certify that all information provided is accurate', value: true, required: true },
      { type: 'signature', label: 'Applicant Signature', required: true },
    ],
    submittedAt: new Date(),
  });
};

export const registrationForm = (data: {
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  companyName?: string;
  companyLogo?: string;
}): PDFBuilder => {
  return formTemplate({
    title: 'Registration Form',
    companyName: data.companyName,
    companyLogo: data.companyLogo,
    referenceId: `REG-${Date.now().toString(36).toUpperCase()}`,
    fields: [
      { type: 'section', label: 'Personal Details' },
      { type: 'text', label: 'Full Name', value: data.fullName, required: true },
      { type: 'date', label: 'Date of Birth', value: data.dateOfBirth, required: true },
      { type: 'radio', label: 'Gender', options: ['Male', 'Female', 'Other'], value: data.gender },
      { type: 'section', label: 'Contact Information' },
      { type: 'text', label: 'Email Address', value: data.email, required: true },
      { type: 'text', label: 'Phone Number', value: data.phone, required: true },
      { type: 'textarea', label: 'Address', value: data.address },
      { type: 'section', label: 'Agreement' },
      { type: 'checkbox', label: 'I agree to the Terms and Conditions', value: true, required: true },
      { type: 'checkbox', label: 'I agree to receive promotional emails', value: false },
    ],
    submittedAt: new Date(),
  });
};

export const feedbackForm = (data: {
  customerName?: string;
  email?: string;
  rating?: string;
  feedback?: string;
  recommend?: boolean;
  companyName?: string;
  companyLogo?: string;
}): PDFBuilder => {
  return formTemplate({
    title: 'Customer Feedback Form',
    companyName: data.companyName,
    companyLogo: data.companyLogo,
    referenceId: `FB-${Date.now().toString(36).toUpperCase()}`,
    fields: [
      { type: 'section', label: 'Customer Information' },
      { type: 'text', label: 'Name', value: data.customerName },
      { type: 'text', label: 'Email', value: data.email },
      { type: 'section', label: 'Your Feedback' },
      { type: 'radio', label: 'Overall Rating', options: ['Excellent', 'Good', 'Average', 'Poor'], value: data.rating },
      { type: 'textarea', label: 'Comments / Suggestions', value: data.feedback },
      { type: 'checkbox', label: 'Would you recommend us to others?', value: data.recommend },
    ],
    submittedAt: new Date(),
  });
};

export const leaveRequestForm = (data: {
  employeeName?: string;
  employeeId?: string;
  department?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  companyName?: string;
  companyLogo?: string;
}): PDFBuilder => {
  return formTemplate({
    title: 'Leave Request Form',
    subtitle: 'Employee Leave Application',
    companyName: data.companyName,
    companyLogo: data.companyLogo,
    referenceId: `LV-${Date.now().toString(36).toUpperCase()}`,
    fields: [
      { type: 'section', label: 'Employee Information' },
      { type: 'text', label: 'Employee Name', value: data.employeeName, required: true },
      { type: 'text', label: 'Employee ID', value: data.employeeId, required: true },
      { type: 'text', label: 'Department', value: data.department },
      { type: 'section', label: 'Leave Details' },
      { type: 'select', label: 'Leave Type', options: ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity/Paternity', 'Unpaid Leave'], value: data.leaveType, required: true },
      { type: 'date', label: 'Start Date', value: data.startDate, required: true },
      { type: 'date', label: 'End Date', value: data.endDate, required: true },
      { type: 'textarea', label: 'Reason for Leave', value: data.reason, required: true },
      { type: 'section', label: 'Approval' },
      { type: 'signature', label: 'Employee Signature', required: true },
      { type: 'signature', label: 'Supervisor Signature' },
    ],
    submittedAt: new Date(),
  });
};
