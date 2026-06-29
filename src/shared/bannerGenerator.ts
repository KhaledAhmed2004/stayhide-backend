import figlet from 'figlet';
import colors from 'colors';

/**
 * Advanced ASCII Banner Generator
 *
 * Generates beautiful formatted banners with ASCII art for application startup.
 * Features:
 * - ASCII art font rendering using figlet
 * - Multiple border styles (single, double, bold, rounded)
 * - Two-section layout (branding + system info)
 * - Auto-centering and text spacing
 * - Color support
 * - Dynamic width calculation
 *
 * Example output:
 * ╔═══════════════════════════════════════════════════════════╗
 * ║   ████████╗ █████╗ ███████╗██╗  ██╗                      ║
 * ║              T A S K   T I T A N S                        ║
 * ╠═══════════════════════════════════════════════════════════╣
 * ║  Environment     DEVELOPMENT 🛠️                          ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

export type BannerStyle = 'single' | 'double' | 'bold' | 'rounded';

export type BannerColors = {
  border?: keyof typeof colors;
  asciiArt?: keyof typeof colors;
  title?: keyof typeof colors;
  tagline?: keyof typeof colors;
  infoLabel?: keyof typeof colors;
  infoValue?: keyof typeof colors;
};

export type AdvancedBannerOptions = {
  projectName: string;
  tagline: string;
  version: string;
  environment: string;
  nodeVersion: string;
  port: number | string;
  asciiFont?: string; // Figlet font name (default: 'ANSI Shadow')
  style?: BannerStyle;
  colors?: BannerColors;
  width?: number; // Default: 63
  showSystemInfo?: boolean;
  includeTimestamp?: boolean;
};

// Border character sets for different styles
const BORDER_STYLES = {
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    dividerLeft: '├',
    dividerRight: '┤',
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    dividerLeft: '╠',
    dividerRight: '╣',
  },
  bold: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    dividerLeft: '┣',
    dividerRight: '┫',
  },
  rounded: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    dividerLeft: '├',
    dividerRight: '┤',
  },
};

/**
 * Add letter spacing to text for aesthetic effect
 */
function addLetterSpacing(text: string, spacing: number = 1): string {
  return text
    .split('')
    .join(' '.repeat(spacing))
    .trim();
}

/**
 * Apply color to text safely
 */
function applyColor(text: string, colorName?: keyof typeof colors): string {
  if (!colorName) return text;

  try {
    const colorFn = colors[colorName];
    if (typeof colorFn === 'function') {
      const result = colorFn(text);
      return typeof result === 'string' ? result : text;
    }
  } catch {
    // If color fails, return plain text
  }

  return text;
}

/**
 * Strip ANSI color codes from text to get true length
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Get display length of text (excluding ANSI codes)
 */
function getDisplayLength(text: string): number {
  return stripAnsi(text).length;
}

/**
 * Generate ASCII art using figlet
 */
async function generateFigletArt(
  text: string,
  font: string = 'ANSI Shadow'
): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      figlet.text(
        text,
        { font: font as any },
        (error: Error | null, art?: string) => {
          if (error || !art) {
            // Fallback to simple text if figlet fails
            resolve([text]);
          } else {
            resolve(art.split('\n').filter((line: string) => line.trim().length > 0));
          }
        }
      );
    } catch {
      // Fallback to simple text if figlet fails
      resolve([text]);
    }
  });
}

/**
 * Build top border line
 */
function buildTopBorder(width: number, borders: typeof BORDER_STYLES.double, borderColor?: keyof typeof colors): string {
  const line = borders.topLeft + borders.horizontal.repeat(width - 2) + borders.topRight;
  return applyColor(line, borderColor);
}

/**
 * Build bottom border line
 */
function buildBottomBorder(width: number, borders: typeof BORDER_STYLES.double, borderColor?: keyof typeof colors): string {
  const line = borders.bottomLeft + borders.horizontal.repeat(width - 2) + borders.bottomRight;
  return applyColor(line, borderColor);
}

/**
 * Build divider line
 */
function buildDivider(width: number, borders: typeof BORDER_STYLES.double, borderColor?: keyof typeof colors): string {
  const line = borders.dividerLeft + borders.horizontal.repeat(width - 2) + borders.dividerRight;
  return applyColor(line, borderColor);
}

/**
 * Build empty line
 */
function buildEmptyLine(width: number, borders: typeof BORDER_STYLES.double, borderColor?: keyof typeof colors): string {
  const contentWidth = width - 4; // 2 for borders, 2 for padding
  const leftBorder = applyColor(borders.vertical, borderColor);
  const rightBorder = applyColor(borders.vertical, borderColor);
  return leftBorder + ' ' + ' '.repeat(contentWidth) + ' ' + rightBorder;
}

/**
 * Build content line with borders
 */
function buildContentLine(
  content: string,
  width: number,
  borders: typeof BORDER_STYLES.double,
  borderColor?: keyof typeof colors,
  centered: boolean = true
): string {
  const contentWidth = width - 4; // 2 for borders, 2 for padding
  const displayLength = getDisplayLength(content);

  let paddedContent: string;
  if (centered) {
    // Ensure content doesn't exceed width
    if (displayLength >= contentWidth) {
      paddedContent = content;
    } else {
      const leftPadding = Math.floor((contentWidth - displayLength) / 2);
      const rightPadding = contentWidth - displayLength - leftPadding;
      paddedContent = ' '.repeat(leftPadding) + content + ' '.repeat(rightPadding);
    }
  } else {
    paddedContent = content + ' '.repeat(Math.max(0, contentWidth - displayLength));
  }

  const leftBorder = applyColor(borders.vertical, borderColor);
  const rightBorder = applyColor(borders.vertical, borderColor);
  return leftBorder + ' ' + paddedContent + ' ' + rightBorder;
}

/**
 * Build info line (key-value pair)
 */
function buildInfoLine(
  label: string,
  value: string,
  width: number,
  borders: typeof BORDER_STYLES.double,
  borderColor?: keyof typeof colors,
  labelColor?: keyof typeof colors,
  valueColor?: keyof typeof colors
): string {
  const contentWidth = width - 4; // 2 for borders, 2 for padding

  const coloredLabel = applyColor(label, labelColor);
  const coloredValue = applyColor(value, valueColor);

  // Calculate spacing (accounting for ANSI codes)
  const labelLength = getDisplayLength(coloredLabel);
  const valueLength = getDisplayLength(coloredValue);
  const spacing = Math.max(1, contentWidth - labelLength - valueLength);

  const content = coloredLabel + ' '.repeat(spacing) + coloredValue;
  const displayLength = getDisplayLength(content);
  const padding = ' '.repeat(Math.max(0, contentWidth - displayLength));

  const leftBorder = applyColor(borders.vertical, borderColor);
  const rightBorder = applyColor(borders.vertical, borderColor);
  return leftBorder + ' ' + content + padding + ' ' + rightBorder;
}

/**
 * Get environment emoji
 */
function getEnvironmentEmoji(environment: string): string {
  const env = environment.toLowerCase();
  if (env.includes('prod')) return '🚀';
  if (env.includes('dev')) return '🛠️';
  if (env.includes('test')) return '🧪';
  if (env.includes('staging')) return '🎭';
  return '⚙️';
}

/**
 * Generate advanced banner with ASCII art and system info
 */
export async function generateAdvancedBanner(
  options: AdvancedBannerOptions
): Promise<string> {
  const {
    projectName,
    tagline,
    version,
    environment,
    nodeVersion,
    port,
    asciiFont = 'ANSI Shadow',
    style = 'double',
    colors: colorConfig = {},
    width = 63,
    showSystemInfo = true,
    includeTimestamp = false,
  } = options;

  const borders = BORDER_STYLES[style];
  const lines: string[] = [];

  // Default colors
  const borderColor = colorConfig.border || 'cyan';
  const asciiArtColor = colorConfig.asciiArt || 'cyan';
  const titleColor = colorConfig.title || 'cyan';
  const taglineColor = colorConfig.tagline || 'cyan';
  const labelColor = colorConfig.infoLabel || 'white';
  const valueColor = colorConfig.infoValue || 'cyan';

  // 1. Top border
  lines.push(buildTopBorder(width, borders, borderColor));

  // 2. Empty line before ASCII art
  lines.push(buildEmptyLine(width, borders, borderColor));

  // 3. ASCII art (first word only to keep it compact)
  const firstWord = projectName.split(' ')[0];
  const asciiArtLines = await generateFigletArt(firstWord, asciiFont);

  for (const artLine of asciiArtLines) {
    const coloredArt = applyColor(artLine, asciiArtColor);
    lines.push(buildContentLine(coloredArt, width, borders, borderColor, true));
  }

  // 4. Empty line after ASCII art
  lines.push(buildEmptyLine(width, borders, borderColor));

  // 5. Spaced title
  const spacedTitle = addLetterSpacing(projectName.toUpperCase(), 1);
  const coloredTitle = applyColor(spacedTitle, titleColor);
  lines.push(buildContentLine(coloredTitle, width, borders, borderColor, true));

  // 6. Spaced tagline
  const spacedTagline = addLetterSpacing(tagline.toUpperCase(), 1);
  const coloredTagline = applyColor(spacedTagline, taglineColor);
  lines.push(buildContentLine(coloredTagline, width, borders, borderColor, true));

  // 7. Empty line before divider
  lines.push(buildEmptyLine(width, borders, borderColor));

  // 8. System info section (if enabled)
  if (showSystemInfo) {
    // Divider
    lines.push(buildDivider(width, borders, borderColor));

    // Environment
    const envEmoji = getEnvironmentEmoji(environment);
    lines.push(
      buildInfoLine(
        'Environment',
        `${environment.toUpperCase()} ${envEmoji}`,
        width,
        borders,
        borderColor,
        labelColor,
        valueColor
      )
    );

    // Version
    lines.push(
      buildInfoLine(
        'Version',
        version,
        width,
        borders,
        borderColor,
        labelColor,
        valueColor
      )
    );

    // Node version
    lines.push(
      buildInfoLine(
        'Node',
        nodeVersion,
        width,
        borders,
        borderColor,
        labelColor,
        valueColor
      )
    );

    // Port
    lines.push(
      buildInfoLine(
        'Port',
        String(port),
        width,
        borders,
        borderColor,
        labelColor,
        valueColor
      )
    );

    // Timestamp (optional)
    if (includeTimestamp) {
      const now = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      lines.push(
        buildInfoLine(
          'Started',
          now,
          width,
          borders,
          borderColor,
          labelColor,
          valueColor
        )
      );
    }
  }

  // 9. Bottom border
  lines.push(buildBottomBorder(width, borders, borderColor));

  return lines.join('\n');
}

/**
 * Generate default banner from config values
 */
export async function generateDefaultBanner(
  appName: string,
  appTagline: string,
  appVersion: string,
  environment: string,
  port: number | string,
  style: BannerStyle = 'double'
): Promise<string> {
  return generateAdvancedBanner({
    projectName: appName,
    tagline: appTagline,
    version: appVersion,
    environment,
    nodeVersion: process.version,
    port,
    style,
    colors: {
      border: 'cyan',
      asciiArt: 'cyan',
      title: 'cyan',
      tagline: 'cyan',
      infoLabel: 'white',
      infoValue: 'cyan',
    },
    showSystemInfo: true,
    includeTimestamp: false,
  });
}
