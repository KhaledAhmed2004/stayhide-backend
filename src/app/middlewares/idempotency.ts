import type { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { logger } from '../../shared/logger';

const TTL_SECONDS = 24 * 60 * 60;
const cache = new NodeCache({ stdTTL: TTL_SECONDS, checkperiod: 60 });

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

export const idempotency = (routeName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key || typeof key !== 'string' || key.trim() === '') {
      return next();
    }

    if (key.length > 255) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Idempotency-Key must be 255 characters or fewer',
      });
    }

    const cacheKey = `idempotency:${routeName}:${key}`;
    const cached = cache.get<CachedResponse>(cacheKey);

    if (cached) {
      logger.info(`Idempotency replay for ${routeName} key=${key}`);
      return res.status(cached.statusCode).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, { statusCode: res.statusCode, body });
      }
      return originalJson(body);
    };

    next();
  };
};
