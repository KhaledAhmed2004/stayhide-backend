"use strict";
/**
 * ExportBuilder - Unified Data Export System
 *
 * A chainable builder for exporting data to multiple formats:
 * - Excel (.xlsx)
 * - CSV
 * - JSON
 * - PDF (using PDFBuilder)
 *
 * Features:
 * - Nested field support (e.g., 'user.name')
 * - Custom transforms per column
 * - Date formatting
 * - Theme support for Excel/PDF
 * - Express response helper
 * - Streaming for large datasets
 *
 * @example
 * ```typescript
 * const buffer = await new ExportBuilder(users)
 *   .format('excel')
 *   .columns(['name', 'email', 'createdAt'])
 *   .headers({ name: 'Full Name', email: 'Email' })
 *   .dateFormat('DD/MM/YYYY')
 *   .toBuffer();
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
const ExcelJS = __importStar(require("exceljs"));
const PDFBuilder_1 = __importDefault(require("./PDFBuilder"));
const stream_1 = require("stream");
const date_fns_1 = require("date-fns");
const excelThemes = {
    default: {
        headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
        headerFont: { bold: true, color: { argb: 'FFFFFFFF' } },
        headerAlignment: { vertical: 'middle', horizontal: 'center' },
        borderStyle: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        stripeFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
    },
    striped: {
        headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
        headerFont: { bold: true, color: { argb: 'FFFFFFFF' } },
        headerAlignment: { vertical: 'middle', horizontal: 'center' },
        borderStyle: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        stripeFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
    },
    bordered: {
        headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } },
        headerFont: { bold: true, color: { argb: 'FFFFFFFF' } },
        headerAlignment: { vertical: 'middle', horizontal: 'center' },
        borderStyle: { style: 'medium', color: { argb: 'FF1F2937' } },
        stripeFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
    },
};
// ============ MAIN CLASS ============
class ExportBuilder {
    /**
     * Create a new ExportBuilder instance
     * @param data - Array of data objects to export
     */
    constructor(data) {
        this.data = data;
        this.config = {
            format: 'excel',
            columns: [],
            headerMap: {},
            transforms: {},
            options: {
                format: 'excel',
                includeHeaders: true,
                theme: 'default',
                sheetName: 'Data',
            },
            pdfOptions: {
                orientation: 'portrait',
                pageSize: 'A4',
            },
        };
    }
    // ===== FORMAT SELECTION =====
    /**
     * Set the export format
     * @param format - 'excel' | 'csv' | 'json' | 'pdf'
     */
    format(format) {
        this.config.format = format;
        this.config.options.format = format;
        return this;
    }
    // ===== COLUMN CONFIGURATION =====
    /**
     * Define columns to export
     * @param columns - Array of column keys or ColumnConfig objects
     *
     * @example
     * // Simple keys
     * .columns(['name', 'email', 'createdAt'])
     *
     * @example
     * // With configuration
     * .columns([
     *   { key: 'name', header: 'Full Name', width: 20 },
     *   { key: 'user.email', header: 'Email' },  // Nested field
     *   { key: 'amount', transform: (v) => `$${v}` }
     * ])
     */
    columns(columns) {
        this.config.columns = columns.map(col => {
            if (typeof col === 'string') {
                return { key: col };
            }
            return col;
        });
        return this;
    }
    /**
     * Set custom header names for columns
     * @param headerMap - Object mapping field keys to display headers
     *
     * @example
     * .headers({
     *   name: 'Full Name',
     *   email: 'Email Address',
     *   createdAt: 'Registration Date'
     * })
     */
    headers(headerMap) {
        this.config.headerMap = Object.assign(Object.assign({}, this.config.headerMap), headerMap);
        // Also update columns that match
        this.config.columns = this.config.columns.map(col => {
            if (headerMap[col.key]) {
                return Object.assign(Object.assign({}, col), { header: headerMap[col.key] });
            }
            return col;
        });
        return this;
    }
    // ===== FORMATTING OPTIONS =====
    /**
     * Set global date format
     * @param format - date-fns format string (e.g., 'dd/MM/yyyy', 'yyyy-MM-dd')
     */
    dateFormat(format) {
        this.config.options.dateFormat = format;
        return this;
    }
    /**
     * Set number format (Excel only)
     * @param format - Excel number format string (e.g., '#,##0.00')
     */
    numberFormat(format) {
        this.config.options.numberFormat = format;
        return this;
    }
    /**
     * Add a transform function for a specific field
     * @param field - Field key to transform
     * @param fn - Transform function
     *
     * @example
     * .transform('price', (v) => `৳${v.toFixed(2)}`)
     * .transform('status', (v) => v.toUpperCase())
     */
    transform(field, fn) {
        this.config.transforms[field] = fn;
        // Also update the column if it exists
        this.config.columns = this.config.columns.map(col => {
            if (col.key === field) {
                return Object.assign(Object.assign({}, col), { transform: fn });
            }
            return col;
        });
        return this;
    }
    // ===== STYLING OPTIONS =====
    /**
     * Set document title (shown in PDF header, Excel header row)
     * @param title - Document title
     */
    title(title) {
        this.config.options.title = title;
        return this;
    }
    /**
     * Set visual theme
     * @param theme - 'default' | 'striped' | 'bordered'
     */
    theme(theme) {
        this.config.options.theme = theme;
        return this;
    }
    /**
     * Set Excel sheet name
     * @param name - Sheet name
     */
    sheetName(name) {
        this.config.options.sheetName = name;
        return this;
    }
    // ===== PDF OPTIONS =====
    /**
     * Set PDF-specific options
     * @param options - PDF configuration
     *
     * @example
     * .pdfOptions({
     *   orientation: 'landscape',
     *   pageSize: 'A4',
     *   headerColor: '#1E40AF'
     * })
     */
    pdfOptions(options) {
        this.config.pdfOptions = Object.assign(Object.assign({}, this.config.pdfOptions), options);
        return this;
    }
    // ===== OUTPUT METHODS =====
    /**
     * Generate export as Buffer
     * @returns Promise<Buffer>
     */
    toBuffer() {
        return __awaiter(this, void 0, void 0, function* () {
            // Auto-detect columns if not specified
            if (this.config.columns.length === 0 && this.data.length > 0) {
                this.config.columns = Object.keys(this.data[0]).map(key => ({ key }));
            }
            switch (this.config.format) {
                case 'excel':
                    return this.generateExcel();
                case 'csv':
                    return this.generateCSV();
                case 'json':
                    return this.generateJSON();
                case 'pdf':
                    return this.generatePDF();
                default:
                    throw new Error(`Unsupported export format: ${this.config.format}`);
            }
        });
    }
    /**
     * Save export to file
     * @param path - File path (extension auto-added if missing)
     */
    toFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield Promise.resolve().then(() => __importStar(require('fs/promises')));
            const buffer = yield this.toBuffer();
            // Add extension if missing
            const extensions = {
                excel: '.xlsx',
                csv: '.csv',
                json: '.json',
                pdf: '.pdf',
            };
            const ext = extensions[this.config.format];
            const finalPath = path.endsWith(ext) ? path : path + ext;
            yield fs.writeFile(finalPath, buffer);
        });
    }
    /**
     * Generate export as Base64 string
     * @returns Promise<string>
     */
    toBase64() {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield this.toBuffer();
            return buffer.toString('base64');
        });
    }
    /**
     * Generate export as readable stream (for large datasets)
     * @returns Promise<Readable>
     */
    toStream() {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield this.toBuffer();
            const stream = new stream_1.Readable();
            stream.push(buffer);
            stream.push(null);
            return stream;
        });
    }
    /**
     * Send export as Express response with proper headers
     * @param res - Express Response object
     * @param filename - Output filename (without extension)
     *
     * @example
     * // In controller
     * await new ExportBuilder(users)
     *   .format('excel')
     *   .columns(['name', 'email'])
     *   .sendResponse(res, 'users-export');
     */
    sendResponse(res, filename) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield this.toBuffer();
            const name = filename || `export-${Date.now()}`;
            const contentTypes = {
                excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                csv: 'text/csv; charset=utf-8',
                json: 'application/json; charset=utf-8',
                pdf: 'application/pdf',
            };
            const extensions = {
                excel: 'xlsx',
                csv: 'csv',
                json: 'json',
                pdf: 'pdf',
            };
            res.setHeader('Content-Type', contentTypes[this.config.format]);
            res.setHeader('Content-Disposition', `attachment; filename="${name}.${extensions[this.config.format]}"`);
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        });
    }
    // ===== PRIVATE: EXCEL GENERATION =====
    generateExcel() {
        return __awaiter(this, void 0, void 0, function* () {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ExportBuilder';
            workbook.created = new Date();
            const sheet = workbook.addWorksheet(this.config.options.sheetName || 'Data');
            const theme = excelThemes[this.config.options.theme || 'default'];
            // Add title row if specified
            let startRow = 1;
            if (this.config.options.title) {
                const titleRow = sheet.getRow(1);
                titleRow.getCell(1).value = this.config.options.title;
                titleRow.getCell(1).font = { bold: true, size: 16 };
                sheet.mergeCells(1, 1, 1, this.config.columns.length);
                startRow = 3; // Leave a blank row
            }
            // Configure columns
            sheet.columns = this.config.columns.map(col => ({
                header: col.header || this.config.headerMap[col.key] || this.formatHeader(col.key),
                key: col.key,
                width: col.width || this.calculateColumnWidth(col.key),
            }));
            // Move headers to correct row if we have a title
            if (this.config.options.title) {
                // Add header row manually
                const headerRowNum = startRow;
                const headerRow = sheet.getRow(headerRowNum);
                this.config.columns.forEach((col, index) => {
                    headerRow.getCell(index + 1).value =
                        col.header || this.config.headerMap[col.key] || this.formatHeader(col.key);
                });
                // Style header row
                this.applyHeaderStyle(headerRow, theme);
                startRow++;
            }
            else {
                // Style the auto-created header row
                const headerRow = sheet.getRow(1);
                this.applyHeaderStyle(headerRow, theme);
                startRow = 2;
            }
            // Add data rows
            for (let i = 0; i < this.data.length; i++) {
                const item = this.data[i];
                const rowNum = startRow + i;
                const row = sheet.getRow(rowNum);
                this.config.columns.forEach((col, colIndex) => {
                    const cell = row.getCell(colIndex + 1);
                    cell.value = this.getValue(item, col);
                    // Apply alignment
                    if (col.align) {
                        cell.alignment = { horizontal: col.align };
                    }
                });
                // Apply row styling
                this.applyRowStyle(row, i, theme);
            }
            // Apply borders to all data cells
            const lastRow = startRow + this.data.length - 1;
            for (let r = this.config.options.title ? 3 : 1; r <= lastRow; r++) {
                const row = sheet.getRow(r);
                for (let c = 1; c <= this.config.columns.length; c++) {
                    row.getCell(c).border = {
                        top: theme.borderStyle,
                        left: theme.borderStyle,
                        bottom: theme.borderStyle,
                        right: theme.borderStyle,
                    };
                }
            }
            // Freeze header row
            sheet.views = [
                { state: 'frozen', xSplit: 0, ySplit: this.config.options.title ? 3 : 1 },
            ];
            const arrayBuffer = yield workbook.xlsx.writeBuffer();
            return Buffer.from(arrayBuffer);
        });
    }
    applyHeaderStyle(row, theme) {
        row.eachCell((cell, colNumber) => {
            if (colNumber <= this.config.columns.length) {
                cell.fill = theme.headerFill;
                cell.font = theme.headerFont;
                cell.alignment = theme.headerAlignment;
                cell.border = {
                    top: theme.borderStyle,
                    left: theme.borderStyle,
                    bottom: theme.borderStyle,
                    right: theme.borderStyle,
                };
            }
        });
        row.height = 25;
    }
    applyRowStyle(row, index, theme) {
        const isStriped = this.config.options.theme === 'striped' && index % 2 === 1;
        row.eachCell((cell, colNumber) => {
            if (colNumber <= this.config.columns.length) {
                if (isStriped) {
                    cell.fill = theme.stripeFill;
                }
                cell.alignment = { vertical: 'middle' };
            }
        });
        row.height = 20;
    }
    // ===== PRIVATE: CSV GENERATION =====
    generateCSV() {
        return __awaiter(this, void 0, void 0, function* () {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Data');
            // Configure columns
            sheet.columns = this.config.columns.map(col => ({
                header: col.header || this.config.headerMap[col.key] || this.formatHeader(col.key),
                key: col.key,
            }));
            // Add data rows
            for (const item of this.data) {
                const row = {};
                for (const col of this.config.columns) {
                    row[col.key] = this.getValue(item, col);
                }
                sheet.addRow(row);
            }
            const csvBuffer = yield workbook.csv.writeBuffer({
                formatterOptions: {
                    delimiter: ',',
                    quote: '"',
                    quoteColumns: true,
                },
            });
            return Buffer.from(csvBuffer);
        });
    }
    // ===== PRIVATE: JSON GENERATION =====
    generateJSON() {
        const result = this.data.map(item => {
            const row = {};
            for (const col of this.config.columns) {
                const headerName = col.header || this.config.headerMap[col.key] || col.key;
                row[headerName] = this.getValue(item, col);
            }
            return row;
        });
        return Buffer.from(JSON.stringify(result, null, 2), 'utf-8');
    }
    // ===== PRIVATE: PDF GENERATION =====
    generatePDF() {
        return __awaiter(this, void 0, void 0, function* () {
            const pdf = new PDFBuilder_1.default()
                .setTheme('modern')
                .setOrientation(this.config.pdfOptions.orientation || 'portrait')
                .setPageSize(this.config.pdfOptions.pageSize || 'A4');
            // Set title if provided
            if (this.config.options.title) {
                pdf.setTitle(this.config.options.title);
                pdf.setHeader({
                    title: this.config.options.title,
                    showDate: true,
                });
            }
            // Prepare table data
            const headers = this.config.columns.map(col => col.header || this.config.headerMap[col.key] || this.formatHeader(col.key));
            const rows = this.data.map(item => this.config.columns.map(col => {
                const value = this.getValue(item, col);
                return value !== null && value !== undefined ? String(value) : '';
            }));
            // Add table
            pdf.addTable({
                headers,
                rows,
                striped: this.config.options.theme === 'striped',
                headerStyle: {
                    background: this.config.pdfOptions.headerColor || '#1E40AF',
                    color: 'white',
                    fontWeight: 'bold',
                },
            });
            // Add footer with page numbers
            pdf.setFooter({ showPageNumbers: true });
            return pdf.toBuffer();
        });
    }
    // ===== PRIVATE: HELPER METHODS =====
    /**
     * Get value from item, supporting nested keys like 'user.name'
     */
    getValue(item, col) {
        // Support nested keys like 'user.name' or 'order.items.length'
        let value = col.key.split('.').reduce((obj, key) => {
            if (obj === null || obj === undefined)
                return undefined;
            return obj[key];
        }, item);
        // Handle Date objects
        if (value instanceof Date || this.isDateString(value)) {
            const dateValue = value instanceof Date ? value : new Date(value);
            if ((0, date_fns_1.isValid)(dateValue)) {
                const format = col.dateFormat || this.config.options.dateFormat;
                if (format) {
                    try {
                        value = (0, date_fns_1.format)(dateValue, this.convertDateFormat(format));
                    }
                    catch (_a) {
                        value = dateValue.toLocaleDateString();
                    }
                }
                else {
                    value = dateValue.toLocaleDateString();
                }
            }
        }
        // Apply column-specific transform
        if (col.transform) {
            value = col.transform(value);
        }
        // Apply global transform for this field
        else if (this.config.transforms[col.key]) {
            value = this.config.transforms[col.key](value);
        }
        // Handle null/undefined
        return value !== null && value !== void 0 ? value : '';
    }
    /**
     * Check if value looks like a date string
     */
    isDateString(value) {
        if (typeof value !== 'string')
            return false;
        // Check common date patterns
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}/, // ISO format
            /^\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
            /^\d{2}-\d{2}-\d{4}/, // DD-MM-YYYY
        ];
        return datePatterns.some(pattern => pattern.test(value));
    }
    /**
     * Convert common date format strings to date-fns format
     */
    convertDateFormat(format) {
        return format
            .replace(/YYYY/g, 'yyyy')
            .replace(/DD/g, 'dd')
            .replace(/MM/g, 'MM')
            .replace(/D/g, 'd')
            .replace(/M(?!M)/g, 'M');
    }
    /**
     * Format a key into a readable header
     * e.g., 'createdAt' -> 'Created At', 'user_name' -> 'User Name'
     */
    formatHeader(key) {
        // Get last part of nested key
        const lastKey = key.split('.').pop() || key;
        return lastKey
            // Add space before capital letters
            .replace(/([A-Z])/g, ' $1')
            // Replace underscores and hyphens with spaces
            .replace(/[_-]/g, ' ')
            // Capitalize first letter of each word
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }
    /**
     * Calculate optimal column width based on content
     */
    calculateColumnWidth(key) {
        const header = this.formatHeader(key);
        const headerLength = header.length;
        // Sample some data to estimate content width
        let maxContentLength = headerLength;
        const sampleSize = Math.min(100, this.data.length);
        for (let i = 0; i < sampleSize; i++) {
            const value = this.getValue(this.data[i], { key });
            const valueLength = String(value).length;
            if (valueLength > maxContentLength) {
                maxContentLength = valueLength;
            }
        }
        // Clamp width between 10 and 50
        return Math.min(50, Math.max(10, maxContentLength + 2));
    }
}
exports.default = ExportBuilder;
