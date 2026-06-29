import crypto from 'crypto';
import config from '../../../config';

export const hashDeviceToken = (raw: string): string => {
  const secret = (config.jwt?.jwt_secret as string) || 'fallback-dev-only';
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
};

export const tokenPrefixOf = (raw: string): string => {
  if (!raw) return '';
  return raw.length <= 6 ? raw : `…${raw.slice(-6)}`;
};

export const hashIp = (ip: string): string => {
  const secret = (config.jwt?.jwt_secret as string) || 'fallback-dev-only';
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
};
