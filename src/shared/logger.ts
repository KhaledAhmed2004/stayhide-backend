import path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const bdTime = (date = new Date()): string => {
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

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const month = get('month');
  const day = get('day');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  const dayPeriod = get('dayPeriod');
  return `${month} ${day}, ${hour}:${minute}:${second} ${dayPeriod}, ${year}`;
};

const myFormat = printf(
  ({ level, message, label, timestamp }: { level: string; message: string; label: string; timestamp: Date }) => {
    // Always render timestamps in BD timezone
    const ts = bdTime(new Date(timestamp));
    return `[${ts}] [${label}] ${level}: ${message}`;
  }
);

const baseTransports = [
  new transports.Console(),
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'winston', 'success', '%DATE%-success.log'),
    datePattern: 'DD-MM-YYYY-HH',
    maxSize: '20m',
    maxFiles: '1d',
  }),
];

const errorTransports = [
  new transports.Console(),
  new DailyRotateFile({
    filename: path.join(process.cwd(), 'winston', 'error', '%DATE%-error.log'),
    datePattern: 'DD-MM-YYYY-HH',
    maxSize: '20m',
    maxFiles: '1d',
  }),
];

const logger = createLogger({
  level: config.node_env === 'development' ? 'debug' : 'info',
  format: combine(label({ label: 'Task Titans' }), timestamp(), myFormat),
  transports: baseTransports,
  silent: config.disable_logs,
});

const errorLogger = createLogger({
  level: 'error',
  format: combine(label({ label: 'Task Titans' }), timestamp(), myFormat),
  transports: errorTransports,
  silent: config.disable_logs,
});

// Optional desktop notification for critical failures in development
export const notifyCritical = (title: string, message: string) => {
  if (config.node_env !== 'development') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const notifier = require('node-notifier');
    notifier.notify({ title, message });
  } catch {
    // no-op if notifier not available
  }
};

export { errorLogger, logger };
