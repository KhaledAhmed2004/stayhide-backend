/**
 * EmailBuilder - Main Export
 *
 * A chainable email builder for creating beautiful, responsive emails.
 *
 * @example Basic Usage
 * ```typescript
 * import { EmailBuilder } from '@/app/builder/EmailBuilder';
 *
 * // Using a pre-built template
 * const { html, subject } = new EmailBuilder()
 *   .setTheme('default')
 *   .useTemplate('welcome', { name: 'John', otp: '123456' })
 *   .build();
 *
 * // Send directly
 * await EmailBuilder.send({ to: 'user@example.com', subject, html });
 * ```
 *
 * @example Custom Email with Components
 * ```typescript
 * const { html } = new EmailBuilder()
 *   .setTheme('default')
 *   .setSubject('Your Order Update')
 *   .addComponent('header', { title: 'Order Shipped!' })
 *   .addText('Your order #12345 has been shipped.')
 *   .addComponent('button', { text: 'Track Order', href: 'https://...' })
 *   .addComponent('footer')
 *   .build();
 * ```
 *
 * @example Registering Custom Theme
 * ```typescript
 * EmailBuilder.registerTheme('corporate', {
 *   name: 'corporate',
 *   colors: { primary: '#003366', ... },
 *   ...
 * });
 * ```
 */

// Main class export
export { EmailBuilder, default } from './EmailBuilder';

// Type exports
export type {
  IEmailTheme,
  IEmailComponent,
  IEmailTemplate,
  ISendEmailOptions,
  IEmailAttachment,
  IEmailBuilderOptions,
} from './EmailBuilder';

// Theme exports (for reference/extension)
export { defaultTheme } from './themes/default';
export { darkTheme } from './themes/dark';

// Component exports (for direct use if needed)
export * as emailComponents from './components';

// Template exports (for reference)
export * as emailTemplates from './templates';
