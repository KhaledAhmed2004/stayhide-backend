"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
  Monkey-patch bcrypt.hash and bcrypt.compare to emit spans.
  Import this module early in app bootstrap.
*/
const api_1 = require("@opentelemetry/api");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcrypt');
const tracer = api_1.trace.getTracer('app');
try {
    if (!bcrypt.__otel_patched) {
        const originalHash = bcrypt.hash.bind(bcrypt);
        const originalCompare = bcrypt.compare.bind(bcrypt);
        bcrypt.hash = (...args) => {
            return tracer.startActiveSpan('bcrypt.hash', span => {
                const start = Date.now();
                try {
                    const out = originalHash(...args);
                    if (out && typeof out.then === 'function') {
                        return out.then((result) => {
                            try {
                                // Capture result message
                                const hashPreview = typeof result === 'string' ? result.substring(0, 15) + '...' : 'generated';
                                span.setAttribute('bcrypt.result.type', 'hash_generated');
                                span.setAttribute('bcrypt.result.message', `Hash generated (${hashPreview})`);
                                span.setAttribute('bcrypt.ms', Date.now() - start);
                            }
                            catch (_a) { }
                            try {
                                span.end();
                            }
                            catch (_b) { }
                            return result;
                        }).catch((err) => {
                            try {
                                span.recordException(err);
                            }
                            catch (_a) { }
                            try {
                                span.end();
                            }
                            catch (_b) { }
                            throw err;
                        });
                    }
                    return out;
                }
                catch (err) {
                    try {
                        span.recordException(err);
                    }
                    catch (_a) { }
                    try {
                        span.end();
                    }
                    catch (_b) { }
                    throw err;
                }
            });
        };
        bcrypt.compare = (...args) => {
            return tracer.startActiveSpan('bcrypt.compare', span => {
                const start = Date.now();
                try {
                    const out = originalCompare(...args);
                    if (out && typeof out.then === 'function') {
                        return out.then((result) => {
                            try {
                                // Capture result message
                                span.setAttribute('bcrypt.result.type', result ? 'match' : 'no_match');
                                span.setAttribute('bcrypt.result.message', result ? 'Password matched' : 'Password mismatch');
                                span.setAttribute('bcrypt.ms', Date.now() - start);
                            }
                            catch (_a) { }
                            try {
                                span.end();
                            }
                            catch (_b) { }
                            return result;
                        }).catch((err) => {
                            try {
                                span.recordException(err);
                            }
                            catch (_a) { }
                            try {
                                span.end();
                            }
                            catch (_b) { }
                            throw err;
                        });
                    }
                    return out;
                }
                catch (err) {
                    try {
                        span.recordException(err);
                    }
                    catch (_a) { }
                    try {
                        span.end();
                    }
                    catch (_b) { }
                    throw err;
                }
            });
        };
        bcrypt.__otel_patched = true;
    }
}
catch (_a) { }
