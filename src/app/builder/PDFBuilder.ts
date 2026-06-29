import puppeteer, { Browser, PaperFormat } from 'puppeteer';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';
import {
  themes,
  fontFamilies,
  fontImports,
  ThemeType,
  FontType,
  ThemeColors,
} from './themes';

// ============ INTERFACES ============

export interface ColorConfig {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  error?: string;
  success?: string;
}

export interface FontConfig {
  family?: string;
  size?: {
    heading?: number;
    subheading?: number;
    body?: number;
    caption?: number;
  };
}

export interface HeaderConfig {
  logo?: string;
  title?: string;
  subtitle?: string;
  showDate?: boolean;
  dateFormat?: string;
  style?: {
    background?: string;
    color?: string;
    gradient?: string;
    padding?: number;
  };
}

export interface FooterConfig {
  showPageNumbers?: boolean;
  text?: string;
  style?: {
    background?: string;
    color?: string;
    borderTop?: string;
  };
}

export interface TableConfig {
  headers: string[];
  rows: (string | number)[][];
  striped?: boolean;
  headerStyle?: {
    background?: string;
    color?: string;
    fontWeight?: string;
  };
  cellStyle?: {
    padding?: number;
    borderColor?: string;
    fontSize?: number;
  };
  stripeColor?: string;
}

export interface TextConfig {
  content: string;
  style?: 'heading' | 'subheading' | 'body' | 'caption' | 'badge';
  align?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  italic?: boolean;
  underline?: boolean;
  margin?: { top?: number; bottom?: number };
}

export interface DividerConfig {
  color?: string;
  thickness?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  margin?: number;
}

export interface ImageConfig {
  src: string;
  width?: number;
  height?: number;
  align?: 'left' | 'center' | 'right';
  caption?: string;
}

export interface QRCodeConfig {
  data: string;
  size?: number;
  position?: 'left' | 'center' | 'right';
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  label?: string;
  _generatedDataUrl?: string; // Internal use
}

export interface BarcodeConfig {
  data: string;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39' | 'ITF14' | 'MSI';
  width?: number;
  height?: number;
  displayValue?: boolean;
  position?: 'left' | 'center' | 'right';
  fontSize?: number;
  lineColor?: string;
  background?: string;
  label?: string;
  _generatedDataUrl?: string; // Internal use
}

interface ContentItem {
  type: 'text' | 'table' | 'divider' | 'spacer' | 'image' | 'html' | 'qrcode' | 'barcode';
  data: any;
}

interface PDFBuilderConfig {
  title?: string;
  theme?: ThemeType;
  colors: ColorConfig;
  fonts: FontConfig;
  fontType: FontType;
  header?: HeaderConfig;
  footer?: FooterConfig;
  content: ContentItem[];
  customStyles?: string;
  pageSize: PaperFormat;
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
}

// ============ MAIN CLASS ============

class PDFBuilder {
  private config: PDFBuilderConfig;
  private static browser: Browser | null = null;

  constructor() {
    this.config = {
      content: [],
      colors: {},
      fonts: {},
      fontType: 'default',
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    };
  }

  // ===== THEME & GLOBAL STYLES =====

  setTheme(theme: ThemeType): this {
    this.config.theme = theme;
    const themeConfig = themes[theme];
    if (themeConfig) {
      this.config.colors = { ...themeConfig.colors };
      this.config.fonts = { family: themeConfig.fonts.family };
    }
    return this;
  }

  setColors(colors: ColorConfig): this {
    this.config.colors = { ...this.config.colors, ...colors };
    return this;
  }

  setFont(font: FontConfig | FontType): this {
    if (typeof font === 'string') {
      this.config.fontType = font;
      this.config.fonts.family = fontFamilies[font] || fontFamilies.default;
    } else {
      this.config.fonts = { ...this.config.fonts, ...font };
    }
    return this;
  }

  setCustomStyles(css: string): this {
    this.config.customStyles = css;
    return this;
  }

  setPageSize(size: PaperFormat): this {
    this.config.pageSize = size;
    return this;
  }

  setOrientation(orientation: 'portrait' | 'landscape'): this {
    this.config.orientation = orientation;
    return this;
  }

  setMargins(margins: Partial<PDFBuilderConfig['margins']>): this {
    this.config.margins = { ...this.config.margins, ...margins };
    return this;
  }

  // ===== HEADER & FOOTER =====

  setTitle(title: string): this {
    this.config.title = title;
    return this;
  }

  setHeader(header: HeaderConfig): this {
    this.config.header = header;
    return this;
  }

  setFooter(footer: FooterConfig): this {
    this.config.footer = footer;
    return this;
  }

  // ===== CONTENT METHODS =====

  addText(text: string | TextConfig): this {
    const data: TextConfig =
      typeof text === 'string' ? { content: text } : text;
    this.config.content.push({ type: 'text', data });
    return this;
  }

  addTable(table: TableConfig): this {
    this.config.content.push({ type: 'table', data: table });
    return this;
  }

  addImage(image: ImageConfig): this {
    this.config.content.push({ type: 'image', data: image });
    return this;
  }

  addDivider(config?: DividerConfig): this {
    this.config.content.push({
      type: 'divider',
      data: config || {},
    });
    return this;
  }

  addSpacer(height: number = 20): this {
    this.config.content.push({ type: 'spacer', data: { height } });
    return this;
  }

  addHTML(html: string): this {
    this.config.content.push({ type: 'html', data: { html } });
    return this;
  }

  addQRCode(config: QRCodeConfig): this {
    this.config.content.push({ type: 'qrcode', data: config });
    return this;
  }

  addBarcode(config: BarcodeConfig): this {
    this.config.content.push({ type: 'barcode', data: config });
    return this;
  }

  // ===== OUTPUT METHODS =====

  async toBuffer(): Promise<Buffer> {
    const browser = await PDFBuilder.getBrowser();
    const page = await browser.newPage();

    try {
      // Pre-generate QR codes and barcodes
      await this.processQRCodesAndBarcodes();

      const html = this.buildHTML();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: this.config.pageSize,
        landscape: this.config.orientation === 'landscape',
        margin: {
          top: `${this.config.margins.top}px`,
          right: `${this.config.margins.right}px`,
          bottom: `${this.config.margins.bottom}px`,
          left: `${this.config.margins.left}px`,
        },
        printBackground: true,
        displayHeaderFooter: !!this.config.footer?.showPageNumbers,
        footerTemplate: this.config.footer?.showPageNumbers
          ? `<div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
              <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>`
          : undefined,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  async toFile(path: string): Promise<void> {
    const fs = await import('fs/promises');
    const buffer = await this.toBuffer();
    await fs.writeFile(path, buffer);
  }

  async toBase64(): Promise<string> {
    const buffer = await this.toBuffer();
    return buffer.toString('base64');
  }

  // ===== STATIC METHODS =====

  private static async getBrowser(): Promise<Browser> {
    if (!PDFBuilder.browser) {
      PDFBuilder.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
      } as any);
    }
    return PDFBuilder.browser;
  }

  static async closeBrowser(): Promise<void> {
    if (PDFBuilder.browser) {
      await PDFBuilder.browser.close();
      PDFBuilder.browser = null;
    }
  }

  // ===== PRIVATE METHODS =====

  private getColors(): ThemeColors {
    const defaultColors: ThemeColors = {
      primary: '#3B82F6',
      secondary: '#64748B',
      accent: '#10B981',
      background: '#F8FAFC',
      text: '#1E293B',
      success: '#059669',
      error: '#DC2626',
    };

    return {
      ...defaultColors,
      ...this.config.colors,
    } as ThemeColors;
  }

  private buildHTML(): string {
    const colors = this.getColors();
    const fontFamily =
      this.config.fonts.family || fontFamilies[this.config.fontType];
    const fontImport = fontImports[this.config.fontType] || '';
    const themeStyles = this.config.theme
      ? themes[this.config.theme]?.styles || ''
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.config.title || 'Document'}</title>
  <style>
    ${fontImport}

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: ${fontFamily};
      color: ${colors.text};
      line-height: 1.6;
      padding: 20px;
    }

    /* Typography */
    .heading {
      font-size: ${this.config.fonts.size?.heading || 24}px;
      font-weight: bold;
      margin-bottom: 16px;
      color: ${colors.primary};
    }

    .subheading {
      font-size: ${this.config.fonts.size?.subheading || 18}px;
      font-weight: 600;
      margin-bottom: 12px;
      color: ${colors.secondary};
    }

    .body-text {
      font-size: ${this.config.fonts.size?.body || 14}px;
      margin-bottom: 8px;
    }

    .caption {
      font-size: ${this.config.fonts.size?.caption || 12}px;
      color: ${colors.secondary};
      margin-bottom: 4px;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    /* Header */
    .header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${colors.primary};
    }

    .header-title {
      font-size: 28px;
      font-weight: bold;
      color: ${colors.primary};
    }

    .header-subtitle {
      font-size: 16px;
      color: ${colors.secondary};
    }

    .header-date {
      font-size: 12px;
      color: ${colors.secondary};
      margin-top: 8px;
    }

    .header-logo {
      max-height: 60px;
      margin-bottom: 10px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #E5E7EB;
    }

    th {
      background: ${colors.primary};
      color: white;
      font-weight: 600;
    }

    tr.striped:nth-child(even) {
      background: ${colors.background};
    }

    /* Divider */
    .divider {
      border: none;
      border-top: 1px solid #E5E7EB;
      margin: 20px 0;
    }

    /* Spacer */
    .spacer {
      display: block;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 12px;
      color: ${colors.secondary};
    }

    /* Alignment */
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }

    /* Theme specific styles */
    ${themeStyles}

    /* Custom styles */
    ${this.config.customStyles || ''}
  </style>
</head>
<body>
  ${this.renderHeader()}
  ${this.renderContent()}
  ${this.renderFooter()}
</body>
</html>`;
  }

  private renderHeader(): string {
    if (!this.config.header) return '';

    const { logo, title, subtitle, showDate, style } = this.config.header;
    const headerStyle = style
      ? `style="
          ${style.background ? `background: ${style.background};` : ''}
          ${style.gradient ? `background: ${style.gradient};` : ''}
          ${style.color ? `color: ${style.color};` : ''}
          ${style.padding ? `padding: ${style.padding}px;` : ''}
        "`
      : '';

    return `
      <div class="header" ${headerStyle}>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            ${title ? `<div class="header-title">${title}</div>` : ''}
            ${subtitle ? `<div class="header-subtitle">${subtitle}</div>` : ''}
            ${showDate ? `<div class="header-date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
          </div>
          ${logo ? `<img src="${logo}" class="header-logo" alt="Logo">` : ''}
        </div>
      </div>
    `;
  }

  private renderContent(): string {
    return this.config.content
      .map(item => {
        switch (item.type) {
          case 'text':
            return this.renderText(item.data);
          case 'table':
            return this.renderTable(item.data);
          case 'divider':
            return this.renderDivider(item.data);
          case 'spacer':
            return this.renderSpacer(item.data);
          case 'image':
            return this.renderImage(item.data);
          case 'html':
            return item.data.html;
          case 'qrcode':
            return this.renderQRCode(item.data);
          case 'barcode':
            return this.renderBarcode(item.data);
          default:
            return '';
        }
      })
      .join('\n');
  }

  private renderText(config: TextConfig): string {
    const {
      content,
      style = 'body',
      align = 'left',
      color,
      backgroundColor,
      fontSize,
      fontWeight,
      italic,
      underline,
      margin,
    } = config;

    const classMap: Record<string, string> = {
      heading: 'heading',
      subheading: 'subheading',
      body: 'body-text',
      caption: 'caption',
      badge: 'badge',
    };

    const inlineStyles = [
      color ? `color: ${color}` : '',
      backgroundColor ? `background-color: ${backgroundColor}` : '',
      fontSize ? `font-size: ${fontSize}px` : '',
      fontWeight ? `font-weight: ${fontWeight}` : '',
      italic ? 'font-style: italic' : '',
      underline ? 'text-decoration: underline' : '',
      margin?.top ? `margin-top: ${margin.top}px` : '',
      margin?.bottom ? `margin-bottom: ${margin.bottom}px` : '',
    ]
      .filter(Boolean)
      .join('; ');

    return `<div class="${classMap[style]} text-${align}" style="${inlineStyles}">${content}</div>`;
  }

  private renderTable(config: TableConfig): string {
    const {
      headers,
      rows,
      striped = false,
      headerStyle,
      cellStyle,
      stripeColor,
    } = config;

    const thStyle = headerStyle
      ? `style="
          ${headerStyle.background ? `background: ${headerStyle.background};` : ''}
          ${headerStyle.color ? `color: ${headerStyle.color};` : ''}
          ${headerStyle.fontWeight ? `font-weight: ${headerStyle.fontWeight};` : ''}
        "`
      : '';

    const tdStyle = cellStyle
      ? `style="
          ${cellStyle.padding ? `padding: ${cellStyle.padding}px;` : ''}
          ${cellStyle.borderColor ? `border-color: ${cellStyle.borderColor};` : ''}
          ${cellStyle.fontSize ? `font-size: ${cellStyle.fontSize}px;` : ''}
        "`
      : '';

    const headerRow = headers
      .map(h => `<th ${thStyle}>${h}</th>`)
      .join('');

    const bodyRows = rows
      .map(
        (row, i) =>
          `<tr class="${striped ? 'striped' : ''}" ${stripeColor && i % 2 === 1 ? `style="background: ${stripeColor}"` : ''}>
            ${row.map(cell => `<td ${tdStyle}>${cell}</td>`).join('')}
          </tr>`
      )
      .join('');

    return `
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  }

  private renderDivider(config: DividerConfig): string {
    const { color = '#E5E7EB', thickness = 1, style = 'solid', margin = 20 } =
      config;
    return `<hr class="divider" style="border-top: ${thickness}px ${style} ${color}; margin: ${margin}px 0;">`;
  }

  private renderSpacer(config: { height: number }): string {
    return `<div class="spacer" style="height: ${config.height}px;"></div>`;
  }

  private renderImage(config: ImageConfig): string {
    const { src, width, height, align = 'left', caption } = config;
    const imgStyle = [
      width ? `width: ${width}px` : '',
      height ? `height: ${height}px` : '',
    ]
      .filter(Boolean)
      .join('; ');

    return `
      <div class="text-${align}">
        <img src="${src}" style="${imgStyle}" alt="">
        ${caption ? `<div class="caption">${caption}</div>` : ''}
      </div>
    `;
  }

  private renderFooter(): string {
    if (!this.config.footer) return '';

    const { text, style } = this.config.footer;
    const footerStyle = style
      ? `style="
          ${style.background ? `background: ${style.background};` : ''}
          ${style.color ? `color: ${style.color};` : ''}
          ${style.borderTop ? `border-top: ${style.borderTop};` : ''}
        "`
      : '';

    return text
      ? `<div class="footer" ${footerStyle}>${text}</div>`
      : '';
  }

  // ===== QR CODE & BARCODE METHODS =====

  private async processQRCodesAndBarcodes(): Promise<void> {
    for (let i = 0; i < this.config.content.length; i++) {
      const item = this.config.content[i];

      if (item.type === 'qrcode') {
        const dataUrl = await this.generateQRCode(item.data);
        item.data._generatedDataUrl = dataUrl;
      } else if (item.type === 'barcode') {
        const dataUrl = this.generateBarcode(item.data);
        item.data._generatedDataUrl = dataUrl;
      }
    }
  }

  private async generateQRCode(config: QRCodeConfig): Promise<string> {
    const {
      data,
      size = 150,
      margin = 2,
      darkColor = '#000000',
      lightColor = '#FFFFFF',
      errorCorrectionLevel = 'M',
    } = config;

    try {
      const dataUrl = await QRCode.toDataURL(data, {
        width: size,
        margin,
        color: {
          dark: darkColor,
          light: lightColor,
        },
        errorCorrectionLevel,
      });
      return dataUrl;
    } catch (error) {
      console.error('QR Code generation error:', error);
      return '';
    }
  }

  private generateBarcode(config: BarcodeConfig): string {
    const {
      data,
      format = 'CODE128',
      width = 2,
      height = 50,
      displayValue = true,
      fontSize = 14,
      lineColor = '#000000',
      background = '#FFFFFF',
    } = config;

    try {
      const canvas = createCanvas(300, height + (displayValue ? 30 : 10));
      JsBarcode(canvas, data, {
        format,
        width,
        height,
        displayValue,
        fontSize,
        lineColor,
        background,
        margin: 10,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Barcode generation error:', error);
      return '';
    }
  }

  private renderQRCode(config: QRCodeConfig): string {
    const { position = 'right', size = 150, label } = config;
    const dataUrl = config._generatedDataUrl || '';

    if (!dataUrl) return '';

    return `
      <div class="qrcode-container text-${position}" style="margin: 15px 0;">
        <img src="${dataUrl}" style="width: ${size}px; height: ${size}px;" alt="QR Code">
        ${label ? `<div style="font-size: 11px; color: #666; margin-top: 5px;">${label}</div>` : ''}
      </div>
    `;
  }

  private renderBarcode(config: BarcodeConfig): string {
    const { position = 'center', label } = config;
    const dataUrl = config._generatedDataUrl || '';

    if (!dataUrl) return '';

    return `
      <div class="barcode-container text-${position}" style="margin: 15px 0;">
        <img src="${dataUrl}" alt="Barcode">
        ${label ? `<div style="font-size: 11px; color: #666; margin-top: 5px;">${label}</div>` : ''}
      </div>
    `;
  }
}

export default PDFBuilder;
