/**
 * Footer Component
 *
 * A footer with company info, social links, and unsubscribe link.
 *
 * @example
 * ```typescript
 * builder.addComponent('footer', {
 *   showSocial: true,
 *   showCompanyInfo: true,
 *   unsubscribeUrl: 'https://example.com/unsubscribe',
 *   customText: 'Thanks for being a valued customer!'
 * });
 * ```
 */

import { IEmailTheme } from '../EmailBuilder';

interface FooterProps {
  showSocial?: boolean;
  showCompanyInfo?: boolean;
  unsubscribeUrl?: string;
  customText?: string;
}

export const footer = (props: FooterProps, theme: IEmailTheme): string => {
  const {
    showSocial = true,
    showCompanyInfo = true,
    unsubscribeUrl,
    customText,
  } = props;

  // Social icons (using text as fallback since images may not load in emails)
  const socialIcons: { name: string; key: keyof NonNullable<IEmailTheme['social']> }[] = [
    { name: 'FB', key: 'facebook' },
    { name: 'TW', key: 'twitter' },
    { name: 'IG', key: 'instagram' },
    { name: 'IN', key: 'linkedin' },
    { name: 'YT', key: 'youtube' },
  ];

  const socialHtml = showSocial && theme.social ? `
    <div style="margin-bottom: ${theme.spacing.md};">
      ${socialIcons
        .filter(icon => theme.social?.[icon.key])
        .map(icon => `
          <a href="${theme.social?.[icon.key]}" target="_blank" style="
            display: inline-block;
            width: 32px;
            height: 32px;
            line-height: 32px;
            margin: 0 4px;
            background-color: ${theme.colors.primary};
            color: #FFFFFF;
            border-radius: 50%;
            text-align: center;
            text-decoration: none;
            font-size: 12px;
            font-weight: bold;
          ">${icon.name}</a>
        `).join('')}
    </div>
  ` : '';

  const companyHtml = showCompanyInfo && theme.company ? `
    <div style="margin-bottom: ${theme.spacing.md};">
      <p style="margin: 0; font-weight: bold;">${theme.company.name}</p>
      ${theme.company.address ? `<p style="margin: 4px 0 0 0;">${theme.company.address}</p>` : ''}
      ${theme.company.phone ? `<p style="margin: 4px 0 0 0;">Phone: ${theme.company.phone}</p>` : ''}
      ${theme.company.email ? `<p style="margin: 4px 0 0 0;">Email: ${theme.company.email}</p>` : ''}
    </div>
  ` : '';

  const customTextHtml = customText ? `
    <p style="margin: 0 0 ${theme.spacing.md} 0;">${customText}</p>
  ` : '';

  const unsubscribeHtml = unsubscribeUrl ? `
    <p style="margin: ${theme.spacing.md} 0 0 0;">
      <a href="${unsubscribeUrl}" style="color: ${theme.colors.textMuted}; text-decoration: underline;">
        Unsubscribe from these emails
      </a>
    </p>
  ` : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="
          padding: ${theme.spacing.xl} 0 ${theme.spacing.md} 0;
          border-top: 1px solid ${theme.colors.border};
          color: ${theme.colors.textMuted};
          font-family: ${theme.fonts.primary};
          font-size: 13px;
          line-height: 1.5;
        ">
          ${customTextHtml}
          ${socialHtml}
          ${companyHtml}
          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  `.trim();
};

export default footer;
