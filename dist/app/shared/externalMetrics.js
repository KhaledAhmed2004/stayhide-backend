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
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackExternal = trackExternal;
exports.recordExternal = recordExternal;
const requestContext_1 = require("../logging/requestContext");
const logger_1 = require("../../shared/logger");
function trackExternal(label, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = Date.now();
        try {
            const res = yield fn();
            const dur = Date.now() - start;
            (0, requestContext_1.recordExternalCall)(dur);
            logger_1.logger.info(`[EXTERNAL] ${label} ✅ | ⏱ ${dur}ms`);
            return res;
        }
        catch (err) {
            const dur = Date.now() - start;
            (0, requestContext_1.recordExternalCall)(dur);
            logger_1.errorLogger.error(`[EXTERNAL] ${label} ❌ | ⏱ ${dur}ms | ${(err === null || err === void 0 ? void 0 : err.message) || 'unknown error'}`);
            throw err;
        }
    });
}
function recordExternal(durationMs, label) {
    (0, requestContext_1.recordExternalCall)(durationMs);
    if (label)
        logger_1.logger.info(`[EXTERNAL] ${label} ⏱ ${durationMs}ms`);
}
