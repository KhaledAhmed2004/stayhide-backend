"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtHelper = void 0;
/**
 * JWT helper with built-in key rotation support.
 *
 * Backward-compatible signature: callers still pass a secret, just as
 * before. Rotation activates when the environment is set:
 *
 *   JWT_KEY_MAP          JSON object: { "<kid>": "<secret>", ... }
 *   JWT_KEY_CURRENT      kid used for signing new access tokens
 *   JWT_REFRESH_KEY_MAP  same shape, for refresh tokens
 *   JWT_REFRESH_KEY_CURRENT  kid used for signing new refresh tokens
 *
 * Behavior with env unset (default): identical to the previous
 * implementation. Behavior with env set:
 *
 *   - Sign: uses the "current" key from the map and stamps `kid` in the
 *     JWT header so verifiers know which key to use.
 *   - Verify: peeks at the JWT header for `kid`; if present and the
 *     key exists in the map, verifies against it. If `kid` is missing
 *     OR not in the map, falls back to the passed secret (so tokens
 *     issued before rotation, with no kid, still verify).
 *
 * Rotation procedure:
 *   1. Add a new entry to JWT_KEY_MAP (e.g. v2) alongside the existing
 *      one (v1). v1 SHOULD equal the legacy `config.jwt.jwt_secret`.
 *      Set JWT_KEY_CURRENT=v2. Deploy.
 *   2. New tokens are now signed with v2, kid=v2. Tokens issued before
 *      the deploy (no kid) still verify against the legacy secret.
 *      Tokens issued with kid=v1 also still verify.
 *   3. Wait for the longest natural token lifetime (refresh TTL) to
 *      pass, then remove v1 from the map. The legacy secret can also
 *      be rotated away once it's no longer used as fallback.
 */
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../shared/logger");
const parseKeyMap = (raw) => {
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    }
    catch (e) {
        logger_1.errorLogger.error(`jwtHelper: failed to parse key map env: ${e.message}`);
    }
    return null;
};
const accessKeyMap = parseKeyMap(process.env.JWT_KEY_MAP);
const accessKeyCurrent = process.env.JWT_KEY_CURRENT;
const refreshKeyMap = parseKeyMap(process.env.JWT_REFRESH_KEY_MAP);
const refreshKeyCurrent = process.env.JWT_REFRESH_KEY_CURRENT;
const detectKind = (secret) => {
    var _a, _b;
    if (typeof secret !== 'string')
        return 'unknown';
    if (secret === ((_a = config_1.default.jwt) === null || _a === void 0 ? void 0 : _a.jwt_secret))
        return 'access';
    if (secret === ((_b = config_1.default.jwt) === null || _b === void 0 ? void 0 : _b.jwt_refresh_secret))
        return 'refresh';
    return 'unknown';
};
const resolveSigningKey = (kind, fallback) => {
    if (kind === 'access' && accessKeyMap && accessKeyCurrent) {
        const s = accessKeyMap[accessKeyCurrent];
        if (s)
            return { secret: s, kid: accessKeyCurrent };
    }
    if (kind === 'refresh' && refreshKeyMap && refreshKeyCurrent) {
        const s = refreshKeyMap[refreshKeyCurrent];
        if (s)
            return { secret: s, kid: refreshKeyCurrent };
    }
    return { secret: fallback };
};
const resolveVerifyingKey = (token, kind, fallback) => {
    var _a;
    let kid;
    try {
        const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
        if (decoded && typeof decoded === 'object') {
            kid = (_a = decoded.header) === null || _a === void 0 ? void 0 : _a.kid;
        }
    }
    catch (_b) {
        /* malformed token — let verify fail naturally */
    }
    if (kid && kind === 'access' && accessKeyMap && accessKeyMap[kid]) {
        return accessKeyMap[kid];
    }
    if (kid && kind === 'refresh' && refreshKeyMap && refreshKeyMap[kid]) {
        return refreshKeyMap[kid];
    }
    return fallback;
};
const createToken = (payload, secret, expireTime) => {
    const kind = detectKind(secret);
    const { secret: signingSecret, kid } = resolveSigningKey(kind, secret);
    const opts = { expiresIn: expireTime };
    if (kid) {
        // `keyid` is jsonwebtoken's API for stamping the `kid` header.
        opts.keyid = kid;
    }
    return jsonwebtoken_1.default.sign(payload, signingSecret, opts);
};
const verifyToken = (token, secret) => {
    const kind = detectKind(secret);
    const verifyingSecret = resolveVerifyingKey(token, kind, secret);
    return jsonwebtoken_1.default.verify(token, verifyingSecret);
};
exports.jwtHelper = { createToken, verifyToken };
