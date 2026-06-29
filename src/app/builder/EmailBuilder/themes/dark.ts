/**
 * Dark Theme for EmailBuilder
 *
 * A dark mode variant for emails.
 * Useful for apps that support dark mode.
 */

import { IEmailTheme } from '../EmailBuilder';

export const darkTheme: IEmailTheme = {
  name: 'dark',

  colors: {
    // Primary brand color - slightly brighter for dark mode
    primary: '#4CAF50',

    // Secondary color
    secondary: '#81C784',

    // Background color - dark outer background
    background: '#121212',

    // Surface color - slightly lighter dark for content area
    surface: '#1E1E1E',

    // Text colors - light text for dark background
    text: '#FFFFFF',
    textMuted: '#B0B0B0',

    // Border color - subtle on dark
    border: '#333333',

    // Status colors - slightly adjusted for dark mode
    success: '#4CAF50',
    warning: '#FFD54F',
    error: '#EF5350',
  },

  fonts: {
    primary: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    heading: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  borderRadius: '8px',

  // Logo - consider using a light/white version for dark theme
  logo: {
    url: 'https://i.postimg.cc/6pgNvKhD/logo.png',
    width: '150',
    height: 'auto',
    alt: 'Company Logo',
  },

  social: {
    facebook: 'https://facebook.com/yourcompany',
    twitter: 'https://twitter.com/yourcompany',
    instagram: 'https://instagram.com/yourcompany',
    linkedin: 'https://linkedin.com/company/yourcompany',
  },

  company: {
    name: 'Your Company Name',
    address: '123 Business Street, City, Country',
    phone: '+1 234 567 890',
    email: 'support@yourcompany.com',
    website: 'https://yourcompany.com',
  },
};

export default darkTheme;
