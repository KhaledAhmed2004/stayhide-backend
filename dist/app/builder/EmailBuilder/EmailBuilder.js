"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailBuilder = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = __importDefault(require("../../../config"));
const default_1 = require("./themes/default");
const dark_1 = require("./themes/dark");
const templates = __importStar(require("./templates"));
const components = __importStar(require("./components"));
// ==================== REGISTRIES ====================
// Theme registry - stores all available themes
const themeRegistry = new Map([
    ['default', default_1.defaultTheme],
    ['dark', dark_1.darkTheme],
]);
// Template registry - stores all available templates
const templateRegistry = new Map();
// Component registry - stores all available components
const componentRegistry = new Map();
// Initialize built-in templates
Object.entries(templates).forEach(([name, template]) => {
    if (typeof template === 'object' && 'subject' in template && 'render' in template) {
        templateRegistry.set(name, template);
    }
});
// Initialize built-in components
Object.entries(components).forEach(([name, component]) => {
    if (typeof component === 'function') {
        componentRegistry.set(name, component);
    }
});
// ==================== EMAIL BUILDER CLASS ====================
class EmailBuilder {
    // ==================== STATIC METHODS ====================
    /**
     * Register a custom theme
     */
    static registerTheme(name, theme) {
        themeRegistry.set(name, theme);
    }
    /**
     * Register a custom template
     */
    static registerTemplate(name, template) {
        templateRegistry.set(name, template);
    }
    /**
     * Register a custom component
     */
    static registerComponent(name, component) {
        componentRegistry.set(name, component);
    }
    /**
     * Get a registered theme
     */
    static getTheme(name) {
        return themeRegistry.get(name);
    }
    /**
     * Get a registered template
     */
    static getTemplate(name) {
        return templateRegistry.get(name);
    }
    /**
     * Get a registered component
     */
    static getComponent(name) {
        return componentRegistry.get(name);
    }
    /**
     * List all registered themes
     */
    static listThemes() {
        return Array.from(themeRegistry.keys());
    }
    /**
     * List all registered templates
     */
    static listTemplates() {
        return Array.from(templateRegistry.keys());
    }
    /**
     * List all registered components
     */
    static listComponents() {
        return Array.from(componentRegistry.keys());
    }
    /**
     * Send an email directly
     */
    static send(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const transporter = nodemailer_1.default.createTransport({
                host: config_1.default.email.host,
                port: Number(config_1.default.email.port),
                secure: false,
                auth: {
                    user: config_1.default.email.user,
                    pass: config_1.default.email.pass,
                },
            });
            const mailOptions = {
                from: `"${config_1.default.email.from || 'App'}" <${config_1.default.email.user}>`,
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
            yield transporter.sendMail(mailOptions);
        });
    }
    // ==================== INSTANCE METHODS ====================
    constructor(options) {
        this.theme = default_1.defaultTheme;
        this.html = '';
        this.subject = '';
        this.variables = {};
        this.attachments = [];
        this.sections = [];
        if (options === null || options === void 0 ? void 0 : options.theme) {
            this.setTheme(options.theme);
        }
        if (options === null || options === void 0 ? void 0 : options.variables) {
            this.variables = options.variables;
        }
    }
    /**
     * Set the theme for the email
     */
    setTheme(theme) {
        if (typeof theme === 'string') {
            const registeredTheme = themeRegistry.get(theme);
            if (!registeredTheme) {
                throw new Error(`Theme "${theme}" not found. Available themes: ${Array.from(themeRegistry.keys()).join(', ')}`);
            }
            this.theme = registeredTheme;
        }
        else {
            this.theme = theme;
        }
        return this;
    }
    /**
     * Set variables for template interpolation
     */
    setVariables(variables) {
        this.variables = Object.assign(Object.assign({}, this.variables), variables);
        return this;
    }
    /**
     * Use a pre-built template
     */
    useTemplate(templateName, variables) {
        const template = templateRegistry.get(templateName);
        if (!template) {
            throw new Error(`Template "${templateName}" not found. Available templates: ${Array.from(templateRegistry.keys()).join(', ')}`);
        }
        if (variables) {
            this.variables = Object.assign(Object.assign({}, this.variables), variables);
        }
        this.subject = this.interpolate(template.subject, this.variables);
        this.html = template.render(this.variables, this.theme, componentRegistry);
        return this;
    }
    /**
     * Set custom subject
     */
    setSubject(subject) {
        this.subject = this.interpolate(subject, this.variables);
        return this;
    }
    /**
     * Add a component to the email
     */
    addComponent(componentName, props) {
        const component = componentRegistry.get(componentName);
        if (!component) {
            throw new Error(`Component "${componentName}" not found. Available components: ${Array.from(componentRegistry.keys()).join(', ')}`);
        }
        const mergedProps = Object.assign(Object.assign({}, this.variables), props);
        this.sections.push(component(mergedProps, this.theme));
        return this;
    }
    /**
     * Add raw HTML section
     */
    addHtml(html) {
        this.sections.push(this.interpolate(html, this.variables));
        return this;
    }
    /**
     * Add text paragraph
     */
    addText(text, style) {
        const styles = Object.assign({ color: this.theme.colors.text, fontFamily: this.theme.fonts.primary, fontSize: '16px', lineHeight: '1.6', margin: `${this.theme.spacing.md} 0` }, style);
        const styleString = Object.entries(styles)
            .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
            .join('; ');
        this.sections.push(`<p style="${styleString}">${this.interpolate(text, this.variables)}</p>`);
        return this;
    }
    /**
     * Add a heading
     */
    addHeading(text, level = 2) {
        const sizes = { 1: '28px', 2: '24px', 3: '20px', 4: '18px' };
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
    addSpacer(height = '20px') {
        this.sections.push(`<div style="height: ${height};"></div>`);
        return this;
    }
    /**
     * Add a divider line
     */
    addDivider() {
        this.sections.push(`<hr style="border: none; border-top: 1px solid ${this.theme.colors.border}; margin: ${this.theme.spacing.lg} 0;" />`);
        return this;
    }
    /**
     * Add an image
     */
    addImage(src, alt = '', width = '100%') {
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
    addAttachment(attachment) {
        this.attachments.push(attachment);
        return this;
    }
    /**
     * Add PDF attachment from PDFBuilder
     */
    attachPDF(pdfBuffer_1) {
        return __awaiter(this, arguments, void 0, function* (pdfBuffer, filename = 'document.pdf') {
            this.attachments.push({
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf',
            });
            return this;
        });
    }
    /**
     * Build the final HTML email
     */
    build() {
        let finalHtml;
        if (this.html) {
            // Template was used
            finalHtml = this.html;
        }
        else if (this.sections.length > 0) {
            // Build from sections
            finalHtml = this.wrapInLayout(this.sections.join('\n'));
        }
        else {
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
    send(to, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { html, subject, attachments } = this.build();
            yield EmailBuilder.send(Object.assign({ to,
                subject,
                html,
                attachments }, options));
        });
    }
    // ==================== PRIVATE HELPERS ====================
    /**
     * Interpolate variables in a string using {{variable}} syntax
     */
    interpolate(template, variables) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] !== undefined ? String(variables[key]) : match;
        });
    }
    /**
     * Convert camelCase to kebab-case
     */
    camelToKebab(str) {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }
    /**
     * Wrap content in responsive email layout
     */
    wrapInLayout(content) {
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
exports.EmailBuilder = EmailBuilder;
exports.default = EmailBuilder;
