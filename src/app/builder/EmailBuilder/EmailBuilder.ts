/**
 * EmailBuilder - Chainable Email Builder for creating beautiful, responsive emails
 *
 * Features:
 * - Chainable API for fluent email composition
 * - Pre-built templates (welcome, OTP, reset password, invoice, etc.)
 * - Reusable components (button, header, footer, card, table)
 * - Theme support (default, dark, custom)
 * - Variable interpolation with {{variable}} syntax
 * - PDFBuilder integration for attachments
 * - Responsive design out of the box
 *
 * @example
 * ```typescript
 * const html = await new EmailBuilder()
 *   .setTheme('default')
 *   .useTemplate('welcome', { name: 'John', otp: '123456' })
 *   .build();
 *
 * await EmailBuilder.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   html
 * });
 * ```
 */

import nodemailer from 'nodemailer';
import config from '../../../config';
import { defaultTheme } from './themes/default';
import { darkTheme } from './themes/dark';
import * as templates from './templates';
import * as components from './components';

// ==================== INTERFACES ====================

export interface IEmailTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: {
    primary: string;
    heading: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: string;
  logo?: {
    url: string;
    width: string;
    height: string;
    alt: string;
  };
  social?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  company?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

export interface IEmailComponent {
  (props: Record<string, any>, theme: IEmailTheme): string;
}

export interface IEmailTemplate {
  subject: string;
  render: (variables: Record<string, any>, theme: IEmailTheme, components: typeof componentRegistry) => string;
}

export interface ISendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: IEmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface IEmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface IEmailBuilderOptions {
  theme?: string | IEmailTheme;
  variables?: Record<string, any>;
}

// ==================== REGISTRIES ====================

// Theme registry - stores all available themes
const themeRegistry: Map<string, IEmailTheme> = new Map([
  ['default', defaultTheme],
  ['dark', darkTheme],
]);

// Template registry - stores all available templates
const templateRegistry: Map<string, IEmailTemplate> = new Map();

// Component registry - stores all available components
const componentRegistry: Map<string, IEmailComponent> = new Map();

// Initialize built-in templates
Object.entries(templates).forEach(([name, template]) => {
  if (typeof template === 'object' && 'subject' in template && 'render' in template) {
    templateRegistry.set(name, template as IEmailTemplate);
  }
});

// Initialize built-in components
Object.entries(components).forEach(([name, component]) => {
  if (typeof component === 'function') {
    componentRegistry.set(name, component as IEmailComponent);
  }
});

// ==================== EMAIL BUILDER CLASS ====================

export class EmailBuilder {
  private theme: IEmailTheme = defaultTheme;
  private html: string = '';
  private subject: string = '';
  private variables: Record<string, any> = {};
  private attachments: IEmailAttachment[] = [];
  private sections: string[] = [];

  // ==================== STATIC METHODS ====================

  /**
   * Register a custom theme
   */
  static registerTheme(name: string, theme: IEmailTheme): void {
    themeRegistry.set(name, theme);
  }

  /**
   * Register a custom template
   */
  static registerTemplate(name: string, template: IEmailTemplate): void {
    templateRegistry.set(name, template);
  }

  /**
   * Register a custom component
   */
  static registerComponent(name: string, component: IEmailComponent): void {
    componentRegistry.set(name, component);
  }

  /**
   * Get a registered theme
   */
  static getTheme(name: string): IEmailTheme | undefined {
    return themeRegistry.get(name);
  }

  /**
   * Get a registered template
   */
  static getTemplate(name: string): IEmailTemplate | undefined {
    return templateRegistry.get(name);
  }

  /**
   * Get a registered component
   */
  static getComponent(name: string): IEmailComponent | undefined {
    return componentRegistry.get(name);
  }

  /**
   * List all registered themes
   */
  static listThemes(): string[] {
    return Array.from(themeRegistry.keys());
  }

  /**
   * List all registered templates
   */
  static listTemplates(): string[] {
    return Array.from(templateRegistry.keys());
  }

  /**
   * List all registered components
   */
  static listComponents(): string[] {
    return Array.from(componentRegistry.keys());
  }

  /**
   * Send an email directly
   */
  static async send(options: ISendEmailOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: Number(config.email.port),
      secure: false,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${config.email.from || 'App'}" <${config.email.user}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
    };

    if (options.attachments) {
      mailOptions.attachments = options.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        encoding: att.encoding,
      }));
    }

    if (options.cc) {
      mailOptions.cc = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc;
    }

    if (options.bcc) {
      mailOptions.bcc = Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc;
    }

    if (options.replyTo) {
      mailOptions.replyTo = options.replyTo;
    }

    await transporter.sendMail(mailOptions);
  }

  // ==================== INSTANCE METHODS ====================

  constructor(options?: IEmailBuilderOptions) {
    if (options?.theme) {
      this.setTheme(options.theme);
    }
    if (options?.variables) {
      this.variables = options.variables;
    }
  }

  /**
   * Set the theme for the email
   */
  setTheme(theme: string | IEmailTheme): this {
    if (typeof theme === 'string') {
      const registeredTheme = themeRegistry.get(theme);
      if (!registeredTheme) {
        throw new Error(`Theme "${theme}" not found. Available themes: ${Array.from(themeRegistry.keys()).join(', ')}`);
      }
      this.theme = registeredTheme;
    } else {
      this.theme = theme;
    }
    return this;
  }

  /**
   * Set variables for template interpolation
   */
  setVariables(variables: Record<string, any>): this {
    this.variables = { ...this.variables, ...variables };
    return this;
  }

  /**
   * Use a pre-built template
   */
  useTemplate(templateName: string, variables?: Record<string, any>): this {
    const template = templateRegistry.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found. Available templates: ${Array.from(templateRegistry.keys()).join(', ')}`);
    }

    if (variables) {
      this.variables = { ...this.variables, ...variables };
    }

    this.subject = this.interpolate(template.subject, this.variables);
    this.html = template.render(this.variables, this.theme, componentRegistry);
    return this;
  }

  /**
   * Set custom subject
   */
  setSubject(subject: string): this {
    this.subject = this.interpolate(subject, this.variables);
    return this;
  }

  /**
   * Add a component to the email
   */
  addComponent(componentName: string, props?: Record<string, any>): this {
    const component = componentRegistry.get(componentName);
    if (!component) {
      throw new Error(`Component "${componentName}" not found. Available components: ${Array.from(componentRegistry.keys()).join(', ')}`);
    }

    const mergedProps = { ...this.variables, ...props };
    this.sections.push(component(mergedProps, this.theme));
    return this;
  }

  /**
   * Add raw HTML section
   */
  addHtml(html: string): this {
    this.sections.push(this.interpolate(html, this.variables));
    return this;
  }

  /**
   * Add text paragraph
   */
  addText(text: string, style?: Partial<CSSStyleDeclaration>): this {
    const styles = {
      color: this.theme.colors.text,
      fontFamily: this.theme.fonts.primary,
      fontSize: '16px',
      lineHeight: '1.6',
      margin: `${this.theme.spacing.md} 0`,
      ...style,
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ');

    this.sections.push(`<p style="${styleString}">${this.interpolate(text, this.variables)}</p>`);
    return this;
  }

  /**
   * Add a heading
   */
  addHeading(text: string, level: 1 | 2 | 3 | 4 = 2): this {
    const sizes: Record<number, string> = { 1: '28px', 2: '24px', 3: '20px', 4: '18px' };
    const styles = {
      color: this.theme.colors.text,
      fontFamily: this.theme.fonts.heading,
      fontSize: sizes[level],
      fontWeight: 'bold',
      margin: `${this.theme.spacing.lg} 0 ${this.theme.spacing.sm} 0`,
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ');

    this.sections.push(`<h${level} style="${styleString}">${this.interpolate(text, this.variables)}</h${level}>`);
    return this;
  }

  /**
   * Add a spacer/divider
   */
  addSpacer(height: string = '20px'): this {
    this.sections.push(`<div style="height: ${height};"></div>`);
    return this;
  }

  /**
   * Add a divider line
   */
  addDivider(): this {
    this.sections.push(`<hr style="border: none; border-top: 1px solid ${this.theme.colors.border}; margin: ${this.theme.spacing.lg} 0;" />`);
    return this;
  }

  /**
   * Add an image
   */
  addImage(src: string, alt: string = '', width: string = '100%'): this {
    this.sections.push(`
      <div style="text-align: center; margin: ${this.theme.spacing.md} 0;">
        <img src="${src}" alt="${alt}" style="max-width: ${width}; height: auto; border-radius: ${this.theme.borderRadius};" />
      </div>
    `);
    return this;
  }

  /**
   * Add an attachment
   */
  addAttachment(attachment: IEmailAttachment): this {
    this.attachments.push(attachment);
    return this;
  }

  /**
   * Add PDF attachment from PDFBuilder
   */
  async attachPDF(pdfBuffer: Buffer, filename: string = 'document.pdf'): Promise<this> {
    this.attachments.push({
      filename,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
    return this;
  }

  /**
   * Build the final HTML email
   */
  build(): { html: string; subject: string; attachments: IEmailAttachment[] } {
    let finalHtml: string;

    if (this.html) {
      // Template was used
      finalHtml = this.html;
    } else if (this.sections.length > 0) {
      // Build from sections
      finalHtml = this.wrapInLayout(this.sections.join('\n'));
    } else {
      throw new Error('No content to build. Use useTemplate() or add components/sections.');
    }

    return {
      html: finalHtml,
      subject: this.subject,
      attachments: this.attachments,
    };
  }

  /**
   * Build and send the email
   */
  async send(to: string | string[], options?: { cc?: string | string[]; bcc?: string | string[]; replyTo?: string }): Promise<void> {
    const { html, subject, attachments } = this.build();

    await EmailBuilder.send({
      to,
      subject,
      html,
      attachments,
      ...options,
    });
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Interpolate variables in a string using {{variable}} syntax
   */
  private interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Wrap content in responsive email layout
   */
  private wrapInLayout(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${this.subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 10px !important; }
      .mobile-padding { padding: 15px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${this.theme.colors.background}; font-family: ${this.theme.fonts.primary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${this.theme.colors.background};">
    <tr>
      <td align="center" style="padding: ${this.theme.spacing.lg};">
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: ${this.theme.colors.surface}; border-radius: ${this.theme.borderRadius}; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td class="mobile-padding" style="padding: ${this.theme.spacing.xl};">
              ${this.theme.logo ? `
              <div style="text-align: center; margin-bottom: ${this.theme.spacing.lg};">
                <img src="${this.theme.logo.url}" alt="${this.theme.logo.alt}" width="${this.theme.logo.width}" height="${this.theme.logo.height}" style="max-width: 100%; height: auto;" />
              </div>
              ` : ''}
              ${content}
              ${this.theme.company ? `
              <div style="margin-top: ${this.theme.spacing.xl}; padding-top: ${this.theme.spacing.lg}; border-top: 1px solid ${this.theme.colors.border}; text-align: center; color: ${this.theme.colors.textMuted}; font-size: 12px;">
                <p style="margin: 0;">${this.theme.company.name}</p>
                ${this.theme.company.address ? `<p style="margin: 5px 0 0 0;">${this.theme.company.address}</p>` : ''}
                ${this.theme.company.email ? `<p style="margin: 5px 0 0 0;">${this.theme.company.email}</p>` : ''}
              </div>
              ` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

export default EmailBuilder;
