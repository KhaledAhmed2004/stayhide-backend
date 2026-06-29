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
exports.verifyTurnstileToken = exports.isConfigured = void 0;
/**
 * Cloudflare Turnstile verifier.
 *
 * Calls Cloudflare's /siteverify endpoint to validate a client-issued
 * Turnstile token. The token comes from the Turnstile widget in the
 * client (mobile/web), is opaque, single-use, and short-lived.
 *
 * Activation: set `TURNSTILE_SECRET` in env. If unset, `isConfigured()`
 * returns false and the middleware no-ops — keeps the dev loop friendly
 * while protecting production once the secret is set.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
const logger_1 = require("../shared/logger");
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const isConfigured = () => {
    return Boolean(process.env.TURNSTILE_SECRET);
};
exports.isConfigured = isConfigured;
/**
 * Verify a Turnstile token. Returns true on success; throws nothing
 * (caller decides how to surface failure). On any error (network,
 * unconfigured, malformed response) returns false.
 */
const verifyTurnstileToken = (token, remoteIp) => __awaiter(void 0, void 0, void 0, function* () {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) {
        // Dev mode — pass-through. Production deployments MUST set the env.
        return { ok: true };
    }
    if (!token) {
        return { ok: false, errorCodes: ['missing-input-response'] };
    }
    try {
        const body = new URLSearchParams();
        body.append('secret', secret);
        body.append('response', token);
        if (remoteIp)
            body.append('remoteip', remoteIp);
        const res = yield fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        if (!res.ok) {
            logger_1.logger.warn(`Turnstile verify HTTP ${res.status}`);
            return { ok: false, errorCodes: [`http-${res.status}`] };
        }
        const data = (yield res.json());
        return {
            ok: Boolean(data.success),
            errorCodes: data['error-codes'],
        };
    }
    catch (err) {
        logger_1.logger.warn(`Turnstile verify error: ${err.message}`);
        return { ok: false, errorCodes: ['network-error'] };
    }
});
exports.verifyTurnstileToken = verifyTurnstileToken;
