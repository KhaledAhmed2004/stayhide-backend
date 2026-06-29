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
exports.CacheHelper = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../shared/logger");
const requestContext_1 = require("../logging/requestContext");
class CacheHelper {
    constructor(options = {}) {
        this.cache = new node_cache_1.default({
            stdTTL: options.ttl || 600,
            checkperiod: options.checkperiod || 120,
            useClones: false,
        });
        logger_1.logger.info('🔹 CacheHelper initialized');
    }
    static getInstance(options) {
        if (!CacheHelper.instance) {
            CacheHelper.instance = new CacheHelper(options);
        }
        return CacheHelper.instance;
    }
    // ------------------- Basic Cache Operations -------------------
    set(key, value, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const logPrefix = `[CACHE][SET] key:${key}`;
            try {
                const ok = this.cache.set(key, value, ttl || 0);
                logger_1.logger.info(`${logPrefix} ✅ | TTL: ${ttl || 'default'} | ⏱ ${Date.now() - start}ms`);
                return ok;
            }
            catch (err) {
                logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
                // Fallback to memory
                const ok = this.cache.set(key, value, ttl || 0);
                return ok;
            }
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const logPrefix = `[CACHE][GET] key:${key}`;
            try {
                const res = this.cache.get(key);
                logger_1.logger.info(`${logPrefix} ${res ? 'HIT ✅' : 'MISS ⚠️'} | ⏱ ${Date.now() - start}ms`);
                const dur = Date.now() - start;
                if (res !== undefined)
                    (0, requestContext_1.recordCacheHit)(dur);
                else
                    (0, requestContext_1.recordCacheMiss)(dur);
                return res;
            }
            catch (err) {
                logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
                const fallback = this.cache.get(key);
                const dur = Date.now() - start;
                if (fallback !== undefined)
                    (0, requestContext_1.recordCacheHit)(dur);
                else
                    (0, requestContext_1.recordCacheMiss)(dur);
                return fallback;
            }
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const keys = Array.isArray(key) ? key : [key];
            const logPrefix = `[CACHE][DEL] keys:${keys.join(',')}`;
            try {
                const res = this.cache.del(keys);
                logger_1.logger.info(`${logPrefix} ✅ | ⏱ ${Date.now() - start}ms`);
                return res;
            }
            catch (err) {
                logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
                return this.cache.del(keys);
            }
        });
    }
    has(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const logPrefix = `[CACHE][HAS] key:${key}`;
            try {
                const res = this.cache.has(key);
                logger_1.logger.info(`${logPrefix} ${res ? 'YES ✅' : 'NO ⚠️'} | ⏱ ${Date.now() - start}ms`);
                return res;
            }
            catch (err) {
                logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
                return this.cache.has(key);
            }
        });
    }
    flush() {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const logPrefix = `[CACHE][FLUSH]`;
            try {
            }
            catch (err) {
                logger_1.errorLogger.error(`${logPrefix} ❌ | ${err.message} | ⏱ ${Date.now() - start}ms`);
            }
            this.cache.flushAll();
            logger_1.logger.info(`${logPrefix} ✅ | ⏱ ${Date.now() - start}ms`);
        });
    }
    // ------------------- Advanced Operations -------------------
    getOrSet(key, fetchFunction, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const cached = yield this.get(key);
            if (cached !== undefined)
                return cached;
            const fresh = yield fetchFunction();
            yield this.set(key, fresh, ttl);
            logger_1.logger.info(`[CACHE][GETORSET] key:${key} ✅ (fresh) | ⏱ ${Date.now() - start}ms`);
            return fresh;
        });
    }
    setWithTags(key, value, tags, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            const success = yield this.set(key, value, ttl);
            if (success) {
                for (const tag of tags) {
                    const tagKey = `tag:${tag}`;
                    const existing = (yield this.get(tagKey)) || [];
                    if (!existing.includes(key)) {
                        existing.push(key);
                        yield this.set(tagKey, existing);
                    }
                }
            }
            return success;
        });
    }
    invalidateByTag(tag) {
        return __awaiter(this, void 0, void 0, function* () {
            const tagKey = `tag:${tag}`;
            const taggedKeys = (yield this.get(tagKey)) || [];
            const deletedCount = yield this.del(taggedKeys);
            yield this.del(tagKey);
            logger_1.logger.info(`[CACHE][INVALIDATE TAG] tag:${tag} deleted:${deletedCount}`);
            return deletedCount;
        });
    }
    // ------------------- Utility -------------------
    getStats() {
        return this.cache.getStats();
    }
    getKeys() {
        return this.cache.keys();
    }
    generateCacheKey(...parts) {
        return parts.join(':');
    }
}
exports.CacheHelper = CacheHelper;
