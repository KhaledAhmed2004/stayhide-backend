/**
 * Template Exports
 *
 * All email templates are exported from here.
 * To add a new template:
 * 1. Create a new file (e.g., myTemplate.ts)
 * 2. Export it here
 * 3. It will automatically be available in EmailBuilder
 */

export { welcome } from './welcome';
export { otpTemplate as otp } from './otp';
export { resetPassword } from './resetPassword';
export { invoice } from './invoice';
export { notification } from './notification';

// Export template type for custom templates
export type { IEmailTemplate } from '../EmailBuilder';
