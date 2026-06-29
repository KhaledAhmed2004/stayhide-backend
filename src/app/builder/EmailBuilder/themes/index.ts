/**
 * Theme Exports
 *
 * All themes are exported from here.
 * To add a new theme:
 * 1. Create a new file (e.g., corporate.ts)
 * 2. Export it here
 * 3. It will automatically be available in EmailBuilder
 */

export { defaultTheme } from './default';
export { darkTheme } from './dark';

// Export theme type for custom themes
export type { IEmailTheme } from '../EmailBuilder';
