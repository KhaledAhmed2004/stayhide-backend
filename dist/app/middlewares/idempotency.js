"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.idempotency = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../shared/logger");
const TTL_SECONDS = 24 * 60 * 60;
const cache = new node_cache_1.default({ stdTTL: TTL_SECONDS, checkperiod: 60 });
const idempotency = (routeName) => {
    return (req, res, next) => {
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
        const cached = cache.get(cacheKey);
        if (cached) {
            logger_1.logger.info(`Idempotency replay for ${routeName} key=${key}`);
            return res.status(cached.statusCode).json(cached.body);
        }
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache.set(cacheKey, { statusCode: res.statusCode, body });
            }
            return originalJson(body);
        };
        next();
    };
};
exports.idempotency = idempotency;
