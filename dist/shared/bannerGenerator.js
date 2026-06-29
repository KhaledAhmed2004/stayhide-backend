"use strict";
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
exports.generateAdvancedBanner = generateAdvancedBanner;
exports.generateDefaultBanner = generateDefaultBanner;
const figlet_1 = __importDefault(require("figlet"));
const colors_1 = __importDefault(require("colors"));
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
function addLetterSpacing(text, spacing = 1) {
    return text
        .split('')
        .join(' '.repeat(spacing))
        .trim();
}
/**
 * Apply color to text safely
 */
function applyColor(text, colorName) {
    if (!colorName)
        return text;
    try {
        const colorFn = colors_1.default[colorName];
        if (typeof colorFn === 'function') {
            const result = colorFn(text);
            return typeof result === 'string' ? result : text;
        }
    }
    catch (_a) {
        // If color fails, return plain text
    }
    return text;
}
/**
 * Strip ANSI color codes from text to get true length
 */
function stripAnsi(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\u001b\[[0-9;]*m/g, '');
}
/**
 * Get display length of text (excluding ANSI codes)
 */
function getDisplayLength(text) {
    return stripAnsi(text).length;
}
/**
 * Generate ASCII art using figlet
 */
function generateFigletArt(text_1) {
    return __awaiter(this, arguments, void 0, function* (text, font = 'ANSI Shadow') {
        return new Promise((resolve) => {
            try {
                figlet_1.default.text(text, { font: font }, (error, art) => {
                    if (error || !art) {
                        // Fallback to simple text if figlet fails
                        resolve([text]);
                    }
                    else {
                        resolve(art.split('\n').filter((line) => line.trim().length > 0));
                    }
                });
            }
            catch (_a) {
                // Fallback to simple text if figlet fails
                resolve([text]);
            }
        });
    });
}
/**
 * Build top border line
 */
function buildTopBorder(width, borders, borderColor) {
    const line = borders.topLeft + borders.horizontal.repeat(width - 2) + borders.topRight;
    return applyColor(line, borderColor);
}
/**
 * Build bottom border line
 */
function buildBottomBorder(width, borders, borderColor) {
    const line = borders.bottomLeft + borders.horizontal.repeat(width - 2) + borders.bottomRight;
    return applyColor(line, borderColor);
}
/**
 * Build divider line
 */
function buildDivider(width, borders, borderColor) {
    const line = borders.dividerLeft + borders.horizontal.repeat(width - 2) + borders.dividerRight;
    return applyColor(line, borderColor);
}
/**
 * Build empty line
 */
function buildEmptyLine(width, borders, borderColor) {
    const contentWidth = width - 4; // 2 for borders, 2 for padding
    const leftBorder = applyColor(borders.vertical, borderColor);
    const rightBorder = applyColor(borders.vertical, borderColor);
    return leftBorder + ' ' + ' '.repeat(contentWidth) + ' ' + rightBorder;
}
/**
 * Build content line with borders
 */
function buildContentLine(content, width, borders, borderColor, centered = true) {
    const contentWidth = width - 4; // 2 for borders, 2 for padding
    const displayLength = getDisplayLength(content);
    let paddedContent;
    if (centered) {
        // Ensure content doesn't exceed width
        if (displayLength >= contentWidth) {
            paddedContent = content;
        }
        else {
            const leftPadding = Math.floor((contentWidth - displayLength) / 2);
            const rightPadding = contentWidth - displayLength - leftPadding;
            paddedContent = ' '.repeat(leftPadding) + content + ' '.repeat(rightPadding);
        }
    }
    else {
        paddedContent = content + ' '.repeat(Math.max(0, contentWidth - displayLength));
    }
    const leftBorder = applyColor(borders.vertical, borderColor);
    const rightBorder = applyColor(borders.vertical, borderColor);
    return leftBorder + ' ' + paddedContent + ' ' + rightBorder;
}
/**
 * Build info line (key-value pair)
 */
function buildInfoLine(label, value, width, borders, borderColor, labelColor, valueColor) {
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
function getEnvironmentEmoji(environment) {
    const env = environment.toLowerCase();
    if (env.includes('prod'))
        return '🚀';
    if (env.includes('dev'))
        return '🛠️';
    if (env.includes('test'))
        return '🧪';
    if (env.includes('staging'))
        return '🎭';
    return '⚙️';
}
/**
 * Generate advanced banner with ASCII art and system info
 */
function generateAdvancedBanner(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { projectName, tagline, version, environment, nodeVersion, port, asciiFont = 'ANSI Shadow', style = 'double', colors: colorConfig = {}, width = 63, showSystemInfo = true, includeTimestamp = false, } = options;
        const borders = BORDER_STYLES[style];
        const lines = [];
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
        const asciiArtLines = yield generateFigletArt(firstWord, asciiFont);
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
            lines.push(buildInfoLine('Environment', `${environment.toUpperCase()} ${envEmoji}`, width, borders, borderColor, labelColor, valueColor));
            // Version
            lines.push(buildInfoLine('Version', version, width, borders, borderColor, labelColor, valueColor));
            // Node version
            lines.push(buildInfoLine('Node', nodeVersion, width, borders, borderColor, labelColor, valueColor));
            // Port
            lines.push(buildInfoLine('Port', String(port), width, borders, borderColor, labelColor, valueColor));
            // Timestamp (optional)
            if (includeTimestamp) {
                const now = new Date().toLocaleString('en-US', {
                    timeZone: 'Asia/Dhaka',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                });
                lines.push(buildInfoLine('Started', now, width, borders, borderColor, labelColor, valueColor));
            }
        }
        // 9. Bottom border
        lines.push(buildBottomBorder(width, borders, borderColor));
        return lines.join('\n');
    });
}
/**
 * Generate default banner from config values
 */
function generateDefaultBanner(appName_1, appTagline_1, appVersion_1, environment_1, port_1) {
    return __awaiter(this, arguments, void 0, function* (appName, appTagline, appVersion, environment, port, style = 'double') {
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
    });
}
