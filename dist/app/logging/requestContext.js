"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.controllerNameFromBasePath = exports.recordEventLoopSample = exports.recordCPUEnd = exports.recordCPUStart = exports.recordMemoryEnd = exports.recordMemoryStart = exports.getMetrics = exports.recordExternalCall = exports.recordCacheMiss = exports.recordCacheHit = exports.recordDbQuery = exports.getLabels = exports.setServiceLabel = exports.setControllerLabel = exports.requestContextInit = void 0;
const async_hooks_1 = require("async_hooks");
const storage = new async_hooks_1.AsyncLocalStorage();
// Initialize per-request context
const requestContextInit = (req, _res, next) => {
    storage.run({
        labels: {},
        metrics: {
            db: { hits: 0, durations: [], queries: [] },
            cache: { hits: 0, misses: 0, hitDurations: [], missDurations: [] },
            external: { count: 0, durations: [] },
        },
    }, () => next());
};
exports.requestContextInit = requestContextInit;
const setControllerLabel = (label) => {
    const store = storage.getStore();
    if (!store)
        return;
    store.labels.controllerLabel = label;
};
exports.setControllerLabel = setControllerLabel;
const setServiceLabel = (label) => {
    const store = storage.getStore();
    if (!store)
        return;
    store.labels.serviceLabel = label;
};
exports.setServiceLabel = setServiceLabel;
const getLabels = () => { var _a; return ((_a = storage.getStore()) === null || _a === void 0 ? void 0 : _a.labels) || {}; };
exports.getLabels = getLabels;
// ===== Metrics helpers =====
const recordDbQuery = (durationMs, meta) => {
    const store = storage.getStore();
    if (!store)
        return;
    store.metrics.db.hits += 1;
    store.metrics.db.durations.push(durationMs);
    store.metrics.db.queries.push({
        model: meta === null || meta === void 0 ? void 0 : meta.model,
        operation: meta === null || meta === void 0 ? void 0 : meta.operation,
        durationMs,
        cacheHit: Boolean(meta === null || meta === void 0 ? void 0 : meta.cacheHit),
        docsExamined: meta === null || meta === void 0 ? void 0 : meta.docsExamined,
        indexUsed: meta === null || meta === void 0 ? void 0 : meta.indexUsed,
        pipeline: meta === null || meta === void 0 ? void 0 : meta.pipeline,
        suggestion: meta === null || meta === void 0 ? void 0 : meta.suggestion,
        nReturned: meta === null || meta === void 0 ? void 0 : meta.nReturned,
        executionStage: meta === null || meta === void 0 ? void 0 : meta.executionStage,
        // 🆕 NEW: Include enhanced fields
        filter: meta === null || meta === void 0 ? void 0 : meta.filter,
        sort: meta === null || meta === void 0 ? void 0 : meta.sort,
        projection: meta === null || meta === void 0 ? void 0 : meta.projection,
        limit: meta === null || meta === void 0 ? void 0 : meta.limit,
        skip: meta === null || meta === void 0 ? void 0 : meta.skip,
        callerLocation: meta === null || meta === void 0 ? void 0 : meta.callerLocation,
    });
};
exports.recordDbQuery = recordDbQuery;
const recordCacheHit = (durationMs) => {
    const store = storage.getStore();
    if (!store)
        return;
    store.metrics.cache.hits += 1;
    store.metrics.cache.hitDurations.push(durationMs);
};
exports.recordCacheHit = recordCacheHit;
const recordCacheMiss = (durationMs) => {
    const store = storage.getStore();
    if (!store)
        return;
    store.metrics.cache.misses += 1;
    store.metrics.cache.missDurations.push(durationMs);
};
exports.recordCacheMiss = recordCacheMiss;
const recordExternalCall = (durationMs) => {
    const store = storage.getStore();
    if (!store)
        return;
    store.metrics.external.count += 1;
    store.metrics.external.durations.push(durationMs);
};
exports.recordExternalCall = recordExternalCall;
const getMetrics = () => { var _a; return (_a = storage.getStore()) === null || _a === void 0 ? void 0 : _a.metrics; };
exports.getMetrics = getMetrics;
// 🆕 NEW: Performance metrics helpers
const recordMemoryStart = (snapshot) => {
    const store = storage.getStore();
    if (!store)
        return;
    if (!store.metrics.performance) {
        store.metrics.performance = {
            eventLoopSamples: [],
        };
    }
    store.metrics.performance.memoryStart = snapshot;
};
exports.recordMemoryStart = recordMemoryStart;
const recordMemoryEnd = (snapshot) => {
    const store = storage.getStore();
    if (!store)
        return;
    if (!store.metrics.performance) {
        store.metrics.performance = {
            eventLoopSamples: [],
        };
    }
    store.metrics.performance.memoryEnd = snapshot;
};
exports.recordMemoryEnd = recordMemoryEnd;
const recordCPUStart = (metrics) => {
    const store = storage.getStore();
    if (!store)
        return;
    if (!store.metrics.performance) {
        store.metrics.performance = {
            eventLoopSamples: [],
        };
    }
    store.metrics.performance.cpuStart = metrics;
};
exports.recordCPUStart = recordCPUStart;
const recordCPUEnd = (metrics) => {
    const store = storage.getStore();
    if (!store)
        return;
    if (!store.metrics.performance) {
        store.metrics.performance = {
            eventLoopSamples: [],
        };
    }
    store.metrics.performance.cpuEnd = metrics;
};
exports.recordCPUEnd = recordCPUEnd;
const recordEventLoopSample = (lagMs) => {
    const store = storage.getStore();
    if (!store)
        return;
    if (!store.metrics.performance) {
        store.metrics.performance = {
            eventLoopSamples: [],
        };
    }
    store.metrics.performance.eventLoopSamples.push(lagMs);
};
exports.recordEventLoopSample = recordEventLoopSample;
// Helper to convert a base path segment like "auth" -> "AuthController"
// Known base path -> Controller name mapping (handles plural/singular)
const BASE_TO_CONTROLLER = {
    auth: 'AuthController',
    user: 'UserController',
    users: 'UserController',
    notification: 'NotificationController',
    notifications: 'NotificationController',
    message: 'MessageController',
    messages: 'MessageController',
    bookmark: 'BookmarkController',
    bookmarks: 'BookmarkController',
    payment: 'PaymentController',
    payments: 'PaymentController',
    chat: 'ChatController',
    chats: 'ChatController',
};
const controllerNameFromBasePath = (baseUrl) => {
    if (!baseUrl)
        return undefined;
    const parts = baseUrl.split('/').filter(Boolean);
    const last = (parts[parts.length - 1] || '').toLowerCase();
    if (!last)
        return undefined;
    const direct = BASE_TO_CONTROLLER[last];
    if (direct)
        return direct;
    // Fallback: PascalCase + Controller
    const pascal = last
        .split('-')
        .map(seg => seg.charAt(0).toUpperCase() + seg.slice(1))
        .join('');
    return `${pascal}Controller`;
};
exports.controllerNameFromBasePath = controllerNameFromBasePath;
