"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.errorLogger = exports.notifyCritical = void 0;
const path_1 = __importDefault(require("path"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const config_1 = __importDefault(require("../config"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
const bdTime = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).formatToParts(date);
    const get = (type) => { var _a; return ((_a = parts.find(p => p.type === type)) === null || _a === void 0 ? void 0 : _a.value) || ''; };
    const month = get('month');
    const day = get('day');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');
    const dayPeriod = get('dayPeriod');
    return `${month} ${day}, ${hour}:${minute}:${second} ${dayPeriod}, ${year}`;
};
const myFormat = printf(({ level, message, label, timestamp }) => {
    // Always render timestamps in BD timezone
    const ts = bdTime(new Date(timestamp));
    return `[${ts}] [${label}] ${level}: ${message}`;
});
const baseTransports = [
    new transports.Console(),
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(process.cwd(), 'winston', 'success', '%DATE%-success.log'),
        datePattern: 'DD-MM-YYYY-HH',
        maxSize: '20m',
        maxFiles: '1d',
    }),
];
const errorTransports = [
    new transports.Console(),
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(process.cwd(), 'winston', 'error', '%DATE%-error.log'),
        datePattern: 'DD-MM-YYYY-HH',
        maxSize: '20m',
        maxFiles: '1d',
    }),
];
const logger = createLogger({
    level: config_1.default.node_env === 'development' ? 'debug' : 'info',
    format: combine(label({ label: 'Task Titans' }), timestamp(), myFormat),
    transports: baseTransports,
    silent: config_1.default.disable_logs,
});
exports.logger = logger;
const errorLogger = createLogger({
    level: 'error',
    format: combine(label({ label: 'Task Titans' }), timestamp(), myFormat),
    transports: errorTransports,
    silent: config_1.default.disable_logs,
});
exports.errorLogger = errorLogger;
// Optional desktop notification for critical failures in development
const notifyCritical = (title, message) => {
    if (config_1.default.node_env !== 'development')
        return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const notifier = require('node-notifier');
        notifier.notify({ title, message });
    }
    catch (_a) {
        // no-op if notifier not available
    }
};
exports.notifyCritical = notifyCritical;
