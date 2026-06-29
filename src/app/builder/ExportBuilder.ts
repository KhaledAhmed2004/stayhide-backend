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

import * as ExcelJS from 'exceljs';
import PDFBuilder from './PDFBuilder';
import { Readable } from 'stream';
import { Response } from 'express';
import { format as formatDate, isValid } from 'date-fns';

// ============ TYPE DEFINITIONS ============

/**
 * Supported export formats
 */
export type ExportFormat = 'excel' | 'csv' | 'json' | 'pdf';

/**
 * Theme types for styling exports
 */
export type ExportTheme = 'default' | 'striped' | 'bordered';

/**
 * Column configuration for exports
 */
export interface ColumnConfig {
  /** Data field name (supports nested keys like 'user.name') */
  key: string;
  /** Display header text (default: key name) */
  header?: string;
  /** Column width in characters (Excel only) */
  width?: number;
  /** Custom value transformer function */
  transform?: (value: any) => string;
  /** Date format string (date-fns format) */
  dateFormat?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Export configuration options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Output filename (without extension) */
  filename?: string;
  /** Excel sheet name */
  sheetName?: string;
  /** Document title (PDF/Excel header) */
  title?: string;
  /** Include headers row (default: true) */
  includeHeaders?: boolean;
  /** Global date format string */
  dateFormat?: string;
  /** Number format string */
  numberFormat?: string;
  /** Visual theme */
  theme?: ExportTheme;
}

/**
 * PDF-specific export options
 */
export interface PDFExportOptions {
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
  /** Page size */
  pageSize?: 'A4' | 'Letter' | 'Legal';
  /** Base font size */
  fontSize?: number;
  /** Table header background color */
  headerColor?: string;
}

/**
 * Internal configuration structure
 */
interface ExportBuilderConfig {
  format: ExportFormat;
  columns: ColumnConfig[];
  headerMap: Record<string, string>;
  transforms: Record<string, (value: any) => string>;
  options: ExportOptions;
  pdfOptions: PDFExportOptions;
}

// ============ THEME DEFINITIONS ============

type BorderStyle = 'thin' | 'medium' | 'thick' | 'dotted' | 'dashed';

interface ExcelTheme {
  headerFill: ExcelJS.Fill;
  headerFont: Partial<ExcelJS.Font>;
  headerAlignment: Partial<ExcelJS.Alignment>;
  borderStyle: Partial<ExcelJS.Border>;
  stripeFill: ExcelJS.Fill;
}

const excelThemes: Record<ExportTheme, ExcelTheme> = {
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

class ExportBuilder<T extends Record<string, any>> {
  private data: T[];
  private config: ExportBuilderConfig;

  /**
   * Create a new ExportBuilder instance
   * @param data - Array of data objects to export
   */
  constructor(data: T[]) {
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
  format(format: ExportFormat): this {
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
  columns(columns: (keyof T | string)[] | ColumnConfig[]): this {
    this.config.columns = columns.map(col => {
      if (typeof col === 'string') {
        return { key: col as string };
      }
      return col as ColumnConfig;
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
  headers(headerMap: Record<string, string>): this {
    this.config.headerMap = { ...this.config.headerMap, ...headerMap };
    // Also update columns that match
    this.config.columns = this.config.columns.map(col => {
      if (headerMap[col.key]) {
        return { ...col, header: headerMap[col.key] };
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
  dateFormat(format: string): this {
    this.config.options.dateFormat = format;
    return this;
  }

  /**
   * Set number format (Excel only)
   * @param format - Excel number format string (e.g., '#,##0.00')
   */
  numberFormat(format: string): this {
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
  transform(field: string, fn: (value: any) => string): this {
    this.config.transforms[field] = fn;
    // Also update the column if it exists
    this.config.columns = this.config.columns.map(col => {
      if (col.key === field) {
        return { ...col, transform: fn };
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
  title(title: string): this {
    this.config.options.title = title;
    return this;
  }

  /**
   * Set visual theme
   * @param theme - 'default' | 'striped' | 'bordered'
   */
  theme(theme: ExportTheme): this {
    this.config.options.theme = theme;
    return this;
  }

  /**
   * Set Excel sheet name
   * @param name - Sheet name
   */
  sheetName(name: string): this {
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
  pdfOptions(options: PDFExportOptions): this {
    this.config.pdfOptions = { ...this.config.pdfOptions, ...options };
    return this;
  }

  // ===== OUTPUT METHODS =====

  /**
   * Generate export as Buffer
   * @returns Promise<Buffer>
   */
  async toBuffer(): Promise<Buffer> {
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
  }

  /**
   * Save export to file
   * @param path - File path (extension auto-added if missing)
   */
  async toFile(path: string): Promise<void> {
    const fs = await import('fs/promises');
    const buffer = await this.toBuffer();

    // Add extension if missing
    const extensions: Record<ExportFormat, string> = {
      excel: '.xlsx',
      csv: '.csv',
      json: '.json',
      pdf: '.pdf',
    };

    const ext = extensions[this.config.format];
    const finalPath = path.endsWith(ext) ? path : path + ext;

    await fs.writeFile(finalPath, buffer);
  }

  /**
   * Generate export as Base64 string
   * @returns Promise<string>
   */
  async toBase64(): Promise<string> {
    const buffer = await this.toBuffer();
    return buffer.toString('base64');
  }

  /**
   * Generate export as readable stream (for large datasets)
   * @returns Promise<Readable>
   */
  async toStream(): Promise<Readable> {
    const buffer = await this.toBuffer();
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
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
  async sendResponse(res: Response, filename?: string): Promise<void> {
    const buffer = await this.toBuffer();
    const name = filename || `export-${Date.now()}`;

    const contentTypes: Record<ExportFormat, string> = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv; charset=utf-8',
      json: 'application/json; charset=utf-8',
      pdf: 'application/pdf',
    };

    const extensions: Record<ExportFormat, string> = {
      excel: 'xlsx',
      csv: 'csv',
      json: 'json',
      pdf: 'pdf',
    };

    res.setHeader('Content-Type', contentTypes[this.config.format]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name}.${extensions[this.config.format]}"`
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  // ===== PRIVATE: EXCEL GENERATION =====

  private async generateExcel(): Promise<Buffer> {
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
    } else {
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

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private applyHeaderStyle(
    row: ExcelJS.Row,
    theme: ExcelTheme
  ): void {
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

  private applyRowStyle(
    row: ExcelJS.Row,
    index: number,
    theme: ExcelTheme
  ): void {
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

  private async generateCSV(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');

    // Configure columns
    sheet.columns = this.config.columns.map(col => ({
      header: col.header || this.config.headerMap[col.key] || this.formatHeader(col.key),
      key: col.key,
    }));

    // Add data rows
    for (const item of this.data) {
      const row: Record<string, any> = {};
      for (const col of this.config.columns) {
        row[col.key] = this.getValue(item, col);
      }
      sheet.addRow(row);
    }

    const csvBuffer = await workbook.csv.writeBuffer({
      formatterOptions: {
        delimiter: ',',
        quote: '"',
        quoteColumns: true,
      },
    });

    return Buffer.from(csvBuffer);
  }

  // ===== PRIVATE: JSON GENERATION =====

  private generateJSON(): Buffer {
    const result = this.data.map(item => {
      const row: Record<string, any> = {};
      for (const col of this.config.columns) {
        const headerName = col.header || this.config.headerMap[col.key] || col.key;
        row[headerName] = this.getValue(item, col);
      }
      return row;
    });

    return Buffer.from(JSON.stringify(result, null, 2), 'utf-8');
  }

  // ===== PRIVATE: PDF GENERATION =====

  private async generatePDF(): Promise<Buffer> {
    const pdf = new PDFBuilder()
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
    const headers = this.config.columns.map(
      col => col.header || this.config.headerMap[col.key] || this.formatHeader(col.key)
    );

    const rows = this.data.map(item =>
      this.config.columns.map(col => {
        const value = this.getValue(item, col);
        return value !== null && value !== undefined ? String(value) : '';
      })
    );

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
  }

  // ===== PRIVATE: HELPER METHODS =====

  /**
   * Get value from item, supporting nested keys like 'user.name'
   */
  private getValue(item: T, col: ColumnConfig): any {
    // Support nested keys like 'user.name' or 'order.items.length'
    let value = col.key.split('.').reduce((obj: any, key: string) => {
      if (obj === null || obj === undefined) return undefined;
      return obj[key];
    }, item);

    // Handle Date objects
    if (value instanceof Date || this.isDateString(value)) {
      const dateValue = value instanceof Date ? value : new Date(value);
      if (isValid(dateValue)) {
        const format = col.dateFormat || this.config.options.dateFormat;
        if (format) {
          try {
            value = formatDate(dateValue, this.convertDateFormat(format));
          } catch {
            value = dateValue.toLocaleDateString();
          }
        } else {
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
    return value ?? '';
  }

  /**
   * Check if value looks like a date string
   */
  private isDateString(value: any): boolean {
    if (typeof value !== 'string') return false;
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
  private convertDateFormat(format: string): string {
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
  private formatHeader(key: string): string {
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
  private calculateColumnWidth(key: string): number {
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

export default ExportBuilder;
