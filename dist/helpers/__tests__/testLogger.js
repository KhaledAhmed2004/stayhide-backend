"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logApi = logApi;
exports.logSocket = logSocket;
const chalk_1 = __importDefault(require("chalk"));
// Force chalk to output full colors (Truecolor) even in Vitest UI / captured environments
chalk_1.default.level = 3;
// Custom JSON syntax highlighter that bolds all tokens to make them look larger and thicker
function colorizeJson(jsonObj) {
    const jsonString = JSON.stringify(jsonObj, null, 2);
    if (!jsonString)
        return '';
    return jsonString.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                // JSON Key: Yellow & Bold
                return chalk_1.default.bold.yellow(match);
            }
            else {
                // String value: Bright Green & Bold
                return chalk_1.default.bold.green(match);
            }
        }
        else if (/true|false/.test(match)) {
            // Boolean value: Magenta & Bold
            return chalk_1.default.bold.magenta(match);
        }
        else if (/null/.test(match)) {
            // Null value: Dim Red & Bold
            return chalk_1.default.bold.dim.red(match);
        }
        else {
            // Number value: Cyan & Bold
            return chalk_1.default.bold.cyan(match);
        }
    });
}
function logApi(method, url, requestData, responseData, badge, description) {
    var _a, _b, _c;
    const methodColors = {
        GET: chalk_1.default.bgGreen.black.bold, // Green
        POST: chalk_1.default.bgYellow.black.bold, // Yellow
        PUT: chalk_1.default.bgCyan.black.bold, // Cyan
        PATCH: chalk_1.default.bgMagenta.whiteBright.bold, // Beguni / Magenta
        DELETE: chalk_1.default.bgRed.whiteBright.bold, // Red
    };
    const methodColor = methodColors[method] || chalk_1.default.bgWhite.black.bold;
    const badgeStr = badge ? chalk_1.default.bold.magenta(` [${badge}]`) : '';
    const descStr = description ? chalk_1.default.dim.white(` - ${description}`) : '';
    // Resolve path parameters (e.g., :userId -> actual value) and query parameters (e.g. ?type=received)
    let resolvedUrl = url;
    if (requestData.params && typeof requestData.params === 'object') {
        for (const [key, value] of Object.entries(requestData.params)) {
            if (value !== undefined && value !== null) {
                resolvedUrl = resolvedUrl.replace(`:${key}`, String(value));
            }
        }
    }
    if (requestData.query && typeof requestData.query === 'object' && Object.keys(requestData.query).length > 0) {
        const queryString = new URLSearchParams(requestData.query).toString();
        if (queryString) {
            resolvedUrl += `?${queryString}`;
        }
    }
    // Clean, borderless, iconless, fully bold and colorful output with Postman method badges
    console.log('\n');
    console.log(`${methodColor(` ${method} `)}${chalk_1.default.reset('  ')}${chalk_1.default.bold.white(url)}${badgeStr}${descStr}`);
    if (resolvedUrl !== url) {
        console.log(`        ${chalk_1.default.dim('↳')} ${chalk_1.default.cyan(resolvedUrl)}`);
    }
    // Normalize requestData: always show params, query, body even if empty/missing
    const normalizedRequest = {
        params: (_a = requestData.params) !== null && _a !== void 0 ? _a : {},
        query: (_b = requestData.query) !== null && _b !== void 0 ? _b : {},
        body: (_c = requestData.body) !== null && _c !== void 0 ? _c : {},
    };
    if (requestData.headers && Object.keys(requestData.headers).length > 0) {
        normalizedRequest.headers = requestData.headers;
    }
    // Format and print Request
    console.log(chalk_1.default.bgCyan.black.bold(' REQUEST ') + '\x1b[0m');
    const reqLines = colorizeJson(normalizedRequest).split('\n');
    reqLines.forEach(line => {
        // Bold the entire line to make braces/colons/brackets look thicker and bigger
        console.log(`${chalk_1.default.bold(line)}`);
    });
    // Format and print Response
    const isSuccess = responseData && responseData.success !== false;
    const responseHeader = isSuccess
        ? chalk_1.default.bgGreen.black.bold(' RESPONSE SUCCESS ') + '\x1b[0m'
        : chalk_1.default.bgRed.whiteBright.bold(' RESPONSE FAILED ') + '\x1b[0m';
    console.log(responseHeader);
    const resLines = colorizeJson(responseData).split('\n');
    resLines.forEach(line => {
        // Bold the entire line to make braces/colons/brackets look thicker and bigger
        console.log(`${chalk_1.default.bold(line)}`);
    });
    console.log('\n');
}
function logSocket(type, event, payload, badge, description) {
    const typeColors = {
        EMIT: chalk_1.default.bgBlue.whiteBright.bold, // Blue
        RECEIVE: chalk_1.default.bgGreen.black.bold, // Green
    };
    const typeColor = typeColors[type] || chalk_1.default.bgWhite.black.bold;
    const badgeStr = badge ? chalk_1.default.bold.magenta(` [${badge}]`) : '';
    const descStr = description ? chalk_1.default.dim.white(` - ${description}`) : '';
    console.log('\n');
    console.log(`${typeColor(` ${type} `)}${chalk_1.default.reset('  ')}${chalk_1.default.bold.white(event)}${badgeStr}${descStr}`);
    console.log(chalk_1.default.bgCyan.black.bold(' PAYLOAD ') + '\x1b[0m');
    const payloadLines = colorizeJson(payload).split('\n');
    payloadLines.forEach(line => {
        console.log(`${chalk_1.default.bold(line)}`);
    });
    console.log('\n');
}
