"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Central OpenTelemetry instrumentation for jsonwebtoken
// Loads once at startup and wraps jwt.sign / jwt.verify globally.
// This keeps business helpers clean (no per-call spans in jwtHelper.ts).
const api_1 = require("@opentelemetry/api");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken');
const originalSign = jwt.sign;
const originalVerify = jwt.verify;
// Wrap sign
jwt.sign = function patchedJwtSign(...args) {
    const tracer = api_1.trace.getTracer('app');
    return tracer.startActiveSpan('JWT.sign', span => {
        try {
            const result = originalSign.apply(jwt, args);
            // Capture result message
            try {
                span.setAttribute('jwt.result.type', 'token_generated');
                span.setAttribute('jwt.result.message', 'Tokens generated');
            }
            catch (_a) { }
            return result;
        }
        catch (err) {
            try {
                span.recordException(err);
            }
            catch (_b) { }
            throw err;
        }
        finally {
            try {
                span.end();
            }
            catch (_c) { }
        }
    });
};
// Wrap verify
jwt.verify = function patchedJwtVerify(...args) {
    const tracer = api_1.trace.getTracer('app');
    return tracer.startActiveSpan('JWT.verify', span => {
        try {
            const result = originalVerify.apply(jwt, args);
            // Capture result message
            try {
                span.setAttribute('jwt.result.type', 'token_verified');
                span.setAttribute('jwt.result.message', 'Token verified successfully');
            }
            catch (_a) { }
            return result;
        }
        catch (err) {
            try {
                span.recordException(err);
            }
            catch (_b) { }
            throw err;
        }
        finally {
            try {
                span.end();
            }
            catch (_c) { }
        }
    });
};
