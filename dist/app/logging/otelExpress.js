"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otelExpressMiddleware = void 0;
const api_1 = require("@opentelemetry/api");
// Express middleware to emit helpful spans for timeline rendering
const otelExpressMiddleware = (req, res, next) => {
    const tracer = api_1.trace.getTracer('app');
    // Quick marker at the start of middleware chain
    try {
        tracer.startActiveSpan('Middleware Start', span => {
            span.end();
        });
    }
    catch (_a) { }
    const originalJson = res.json.bind(res);
    let afterJsonAt;
    // Wrap res.json to measure serialization
    res.json = (body) => {
        const start = Date.now();
        try {
            return tracer.startActiveSpan('Response Serialization', span => {
                try {
                    const out = originalJson(body);
                    return out;
                }
                finally {
                    const dur = Date.now() - start;
                    span.setAttribute('response.serialization.ms', dur);
                    span.end();
                    afterJsonAt = Date.now();
                }
            });
        }
        catch (_a) {
            const out = originalJson(body);
            afterJsonAt = Date.now();
            return out;
        }
    };
    // On finish, record the time spent after serialization until socket flush
    res.on('finish', () => {
        try {
            const start = afterJsonAt || Date.now();
            const dur = Date.now() - start;
            tracer.startActiveSpan('🌐 HTTP Response Send', span => {
                try {
                    span.setAttribute('http.status_code', res.statusCode);
                    span.setAttribute('response.send.ms', dur);
                    const bytes = res._contentLength || res.getHeader('content-length');
                    if (bytes)
                        span.setAttribute('response.content_length', Number(bytes));
                }
                finally {
                    span.end();
                }
            });
        }
        catch (_a) { }
    });
    next();
};
exports.otelExpressMiddleware = otelExpressMiddleware;
