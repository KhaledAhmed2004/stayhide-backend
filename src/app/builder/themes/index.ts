/**
 * Pre-built themes for PDFBuilder
 * Each theme includes colors, fonts, and custom styles
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  success: string;
  error: string;
}

export interface Theme {
  colors: ThemeColors;
  fonts: { family: string };
  styles: string;
}

export const themes: Record<string, Theme> = {
  modern: {
    colors: {
      primary: '#2563eb', // Deeper blue
      secondary: '#4b5563',
      accent: '#3b82f6',
      background: '#f8fafc',
      text: '#1e293b',
      success: '#10b981',
      error: '#ef4444',
    },
    fonts: { family: "'Inter', system-ui, sans-serif" },
    styles: `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      .header { border-radius: 12px; margin-bottom: 30px; background: #ffffff; border: 1px solid #e2e8f0; }
      .header-title { font-size: 32px; letter-spacing: -0.025em; }
      .heading { border-left: 4px solid #2563eb; padding-left: 12px; margin-top: 32px; }
      table { border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      th { text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; padding: 14px 16px; }
      td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
      .badge { font-weight: 500; border: 1px solid #e2e8f0; }
    `,
  },

  corporate: {
    colors: {
      primary: '#0f172a', // Slate 900
      secondary: '#475569',
      accent: '#334155',
      background: '#ffffff',
      text: '#0f172a',
      success: '#059669',
      error: '#dc2626',
    },
    fonts: { family: "'Playfair Display', serif" },
    styles: `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
      body { font-family: 'Plus Jakarta Sans', sans-serif; }
      .header { border-bottom: 2px solid #0f172a; padding: 0 0 24px 0; background: transparent; color: #0f172a; }
      .header-title { font-family: 'Playfair Display', serif; font-size: 36px; color: #0f172a; }
      .heading { text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-family: 'Playfair Display', serif; }
      table { border-collapse: separate; border-spacing: 0; }
      table th { background: #f8fafc; color: #0f172a; border-bottom: 2px solid #0f172a; }
      table td { border-bottom: 1px solid #f1f5f9; }
    `,
  },

  minimal: {
    colors: {
      primary: '#000000',
      secondary: '#525252',
      accent: '#000000',
      background: '#ffffff',
      text: '#000000',
      success: '#16a34a',
      error: '#dc2626',
    },
    fonts: { family: "'Geist', system-ui, sans-serif" },
    styles: `
      .header { border-bottom: 1px solid #000; padding-bottom: 12px; margin-bottom: 40px; }
      .header-title { font-weight: 800; text-transform: uppercase; }
      .heading { font-weight: 800; margin-top: 40px; text-transform: uppercase; font-size: 14px; }
      table { border-top: 2px solid #000; }
      table th { background: transparent; color: #000; border-bottom: 1px solid #000; text-transform: uppercase; font-size: 12px; }
      table td { border-bottom: 1px solid #f0f0f0; }
    `,
  },
};

/**
 * Font families for different language support
 */
export const fontFamilies: Record<string, string> = {
  default: 'system-ui, sans-serif',
  bangla: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
  arabic: "'Noto Sans Arabic', sans-serif",
};

/**
 * Google Fonts import URLs for different fonts
 */
export const fontImports: Record<string, string> = {
  default: '',
  bangla:
    "@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');",
  arabic:
    "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap');",
};

export type ThemeType = keyof typeof themes;
export type FontType = keyof typeof fontFamilies;
