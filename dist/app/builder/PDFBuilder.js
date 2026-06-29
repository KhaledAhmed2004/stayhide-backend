"use strict";
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
const puppeteer_1 = __importDefault(require("puppeteer"));
const qrcode_1 = __importDefault(require("qrcode"));
const jsbarcode_1 = __importDefault(require("jsbarcode"));
const canvas_1 = require("canvas");
const themes_1 = require("./themes");
// ============ MAIN CLASS ============
class PDFBuilder {
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
    setTheme(theme) {
        this.config.theme = theme;
        const themeConfig = themes_1.themes[theme];
        if (themeConfig) {
            this.config.colors = Object.assign({}, themeConfig.colors);
            this.config.fonts = { family: themeConfig.fonts.family };
        }
        return this;
    }
    setColors(colors) {
        this.config.colors = Object.assign(Object.assign({}, this.config.colors), colors);
        return this;
    }
    setFont(font) {
        if (typeof font === 'string') {
            this.config.fontType = font;
            this.config.fonts.family = themes_1.fontFamilies[font] || themes_1.fontFamilies.default;
        }
        else {
            this.config.fonts = Object.assign(Object.assign({}, this.config.fonts), font);
        }
        return this;
    }
    setCustomStyles(css) {
        this.config.customStyles = css;
        return this;
    }
    setPageSize(size) {
        this.config.pageSize = size;
        return this;
    }
    setOrientation(orientation) {
        this.config.orientation = orientation;
        return this;
    }
    setMargins(margins) {
        this.config.margins = Object.assign(Object.assign({}, this.config.margins), margins);
        return this;
    }
    // ===== HEADER & FOOTER =====
    setTitle(title) {
        this.config.title = title;
        return this;
    }
    setHeader(header) {
        this.config.header = header;
        return this;
    }
    setFooter(footer) {
        this.config.footer = footer;
        return this;
    }
    // ===== CONTENT METHODS =====
    addText(text) {
        const data = typeof text === 'string' ? { content: text } : text;
        this.config.content.push({ type: 'text', data });
        return this;
    }
    addTable(table) {
        this.config.content.push({ type: 'table', data: table });
        return this;
    }
    addImage(image) {
        this.config.content.push({ type: 'image', data: image });
        return this;
    }
    addDivider(config) {
        this.config.content.push({
            type: 'divider',
            data: config || {},
        });
        return this;
    }
    addSpacer(height = 20) {
        this.config.content.push({ type: 'spacer', data: { height } });
        return this;
    }
    addHTML(html) {
        this.config.content.push({ type: 'html', data: { html } });
        return this;
    }
    addQRCode(config) {
        this.config.content.push({ type: 'qrcode', data: config });
        return this;
    }
    addBarcode(config) {
        this.config.content.push({ type: 'barcode', data: config });
        return this;
    }
    // ===== OUTPUT METHODS =====
    toBuffer() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const browser = yield PDFBuilder.getBrowser();
            const page = yield browser.newPage();
            try {
                // Pre-generate QR codes and barcodes
                yield this.processQRCodesAndBarcodes();
                const html = this.buildHTML();
                yield page.setContent(html, { waitUntil: 'networkidle0' });
                const pdfBuffer = yield page.pdf({
                    format: this.config.pageSize,
                    landscape: this.config.orientation === 'landscape',
                    margin: {
                        top: `${this.config.margins.top}px`,
                        right: `${this.config.margins.right}px`,
                        bottom: `${this.config.margins.bottom}px`,
                        left: `${this.config.margins.left}px`,
                    },
                    printBackground: true,
                    displayHeaderFooter: !!((_a = this.config.footer) === null || _a === void 0 ? void 0 : _a.showPageNumbers),
                    footerTemplate: ((_b = this.config.footer) === null || _b === void 0 ? void 0 : _b.showPageNumbers)
                        ? `<div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
              <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>`
                        : undefined,
                });
                return Buffer.from(pdfBuffer);
            }
            finally {
                yield page.close();
            }
        });
    }
    toFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield Promise.resolve().then(() => __importStar(require('fs/promises')));
            const buffer = yield this.toBuffer();
            yield fs.writeFile(path, buffer);
        });
    }
    toBase64() {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield this.toBuffer();
            return buffer.toString('base64');
        });
    }
    // ===== STATIC METHODS =====
    static getBrowser() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!PDFBuilder.browser) {
                PDFBuilder.browser = yield puppeteer_1.default.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
                });
            }
            return PDFBuilder.browser;
        });
    }
    static closeBrowser() {
        return __awaiter(this, void 0, void 0, function* () {
            if (PDFBuilder.browser) {
                yield PDFBuilder.browser.close();
                PDFBuilder.browser = null;
            }
        });
    }
    // ===== PRIVATE METHODS =====
    getColors() {
        const defaultColors = {
            primary: '#3B82F6',
            secondary: '#64748B',
            accent: '#10B981',
            background: '#F8FAFC',
            text: '#1E293B',
            success: '#059669',
            error: '#DC2626',
        };
        return Object.assign(Object.assign({}, defaultColors), this.config.colors);
    }
    buildHTML() {
        var _a, _b, _c, _d, _e;
        const colors = this.getColors();
        const fontFamily = this.config.fonts.family || themes_1.fontFamilies[this.config.fontType];
        const fontImport = themes_1.fontImports[this.config.fontType] || '';
        const themeStyles = this.config.theme
            ? ((_a = themes_1.themes[this.config.theme]) === null || _a === void 0 ? void 0 : _a.styles) || ''
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
      font-size: ${((_b = this.config.fonts.size) === null || _b === void 0 ? void 0 : _b.heading) || 24}px;
      font-weight: bold;
      margin-bottom: 16px;
      color: ${colors.primary};
    }

    .subheading {
      font-size: ${((_c = this.config.fonts.size) === null || _c === void 0 ? void 0 : _c.subheading) || 18}px;
      font-weight: 600;
      margin-bottom: 12px;
      color: ${colors.secondary};
    }

    .body-text {
      font-size: ${((_d = this.config.fonts.size) === null || _d === void 0 ? void 0 : _d.body) || 14}px;
      margin-bottom: 8px;
    }

    .caption {
      font-size: ${((_e = this.config.fonts.size) === null || _e === void 0 ? void 0 : _e.caption) || 12}px;
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
    renderHeader() {
        if (!this.config.header)
            return '';
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
    renderContent() {
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
    renderText(config) {
        const { content, style = 'body', align = 'left', color, backgroundColor, fontSize, fontWeight, italic, underline, margin, } = config;
        const classMap = {
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
            (margin === null || margin === void 0 ? void 0 : margin.top) ? `margin-top: ${margin.top}px` : '',
            (margin === null || margin === void 0 ? void 0 : margin.bottom) ? `margin-bottom: ${margin.bottom}px` : '',
        ]
            .filter(Boolean)
            .join('; ');
        return `<div class="${classMap[style]} text-${align}" style="${inlineStyles}">${content}</div>`;
    }
    renderTable(config) {
        const { headers, rows, striped = false, headerStyle, cellStyle, stripeColor, } = config;
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
            .map((row, i) => `<tr class="${striped ? 'striped' : ''}" ${stripeColor && i % 2 === 1 ? `style="background: ${stripeColor}"` : ''}>
            ${row.map(cell => `<td ${tdStyle}>${cell}</td>`).join('')}
          </tr>`)
            .join('');
        return `
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
    }
    renderDivider(config) {
        const { color = '#E5E7EB', thickness = 1, style = 'solid', margin = 20 } = config;
        return `<hr class="divider" style="border-top: ${thickness}px ${style} ${color}; margin: ${margin}px 0;">`;
    }
    renderSpacer(config) {
        return `<div class="spacer" style="height: ${config.height}px;"></div>`;
    }
    renderImage(config) {
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
    renderFooter() {
        if (!this.config.footer)
            return '';
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
    processQRCodesAndBarcodes() {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < this.config.content.length; i++) {
                const item = this.config.content[i];
                if (item.type === 'qrcode') {
                    const dataUrl = yield this.generateQRCode(item.data);
                    item.data._generatedDataUrl = dataUrl;
                }
                else if (item.type === 'barcode') {
                    const dataUrl = this.generateBarcode(item.data);
                    item.data._generatedDataUrl = dataUrl;
                }
            }
        });
    }
    generateQRCode(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, size = 150, margin = 2, darkColor = '#000000', lightColor = '#FFFFFF', errorCorrectionLevel = 'M', } = config;
            try {
                const dataUrl = yield qrcode_1.default.toDataURL(data, {
                    width: size,
                    margin,
                    color: {
                        dark: darkColor,
                        light: lightColor,
                    },
                    errorCorrectionLevel,
                });
                return dataUrl;
            }
            catch (error) {
                console.error('QR Code generation error:', error);
                return '';
            }
        });
    }
    generateBarcode(config) {
        const { data, format = 'CODE128', width = 2, height = 50, displayValue = true, fontSize = 14, lineColor = '#000000', background = '#FFFFFF', } = config;
        try {
            const canvas = (0, canvas_1.createCanvas)(300, height + (displayValue ? 30 : 10));
            (0, jsbarcode_1.default)(canvas, data, {
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
        }
        catch (error) {
            console.error('Barcode generation error:', error);
            return '';
        }
    }
    renderQRCode(config) {
        const { position = 'right', size = 150, label } = config;
        const dataUrl = config._generatedDataUrl || '';
        if (!dataUrl)
            return '';
        return `
      <div class="qrcode-container text-${position}" style="margin: 15px 0;">
        <img src="${dataUrl}" style="width: ${size}px; height: ${size}px;" alt="QR Code">
        ${label ? `<div style="font-size: 11px; color: #666; margin-top: 5px;">${label}</div>` : ''}
      </div>
    `;
    }
    renderBarcode(config) {
        const { position = 'center', label } = config;
        const dataUrl = config._generatedDataUrl || '';
        if (!dataUrl)
            return '';
        return `
      <div class="barcode-container text-${position}" style="margin: 15px 0;">
        <img src="${dataUrl}" alt="Barcode">
        ${label ? `<div style="font-size: 11px; color: #666; margin-top: 5px;">${label}</div>` : ''}
      </div>
    `;
    }
}
PDFBuilder.browser = null;
exports.default = PDFBuilder;
