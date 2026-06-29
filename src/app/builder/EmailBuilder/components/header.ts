/**
 * Header Component
 *
 * A header section with logo and optional tagline.
 *
 * @example
 * ```typescript
 * builder.addComponent('header', {
 *   title: 'Welcome!',
 *   subtitle: 'Thanks for joining us',
 *   showLogo: true,
 *   align: 'center'
 * });
 * ```
 */

import { IEmailTheme } from '../EmailBuilder';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  align?: 'left' | 'center' | 'right';
}

export const header = (props: HeaderProps, theme: IEmailTheme): string => {
  const {
    title,
    subtitle,
    showLogo = true,
    align = 'center',
  } = props;

  const logoHtml = showLogo && theme.logo ? `
    <img
      src="${theme.logo.url}"
      alt="${theme.logo.alt}"
      width="${theme.logo.width}"
      height="${theme.logo.height}"
      style="max-width: 100%; height: auto; margin-bottom: ${theme.spacing.md};"
    />
  ` : '';

  const titleHtml = title ? `
    <h1 style="
      margin: 0 0 ${theme.spacing.sm} 0;
      color: ${theme.colors.text};
      font-family: ${theme.fonts.heading};
      font-size: 28px;
      font-weight: bold;
    ">${title}</h1>
  ` : '';

  const subtitleHtml = subtitle ? `
    <p style="
      margin: 0;
      color: ${theme.colors.textMuted};
      font-family: ${theme.fonts.primary};
      font-size: 16px;
    ">${subtitle}</p>
  ` : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="${align}" style="padding: ${theme.spacing.lg} 0; border-bottom: 1px solid ${theme.colors.border};">
          ${logoHtml}
          ${titleHtml}
          ${subtitleHtml}
        </td>
      </tr>
    </table>
  `.trim();
};

export default header;
