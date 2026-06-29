"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashIp = exports.tokenPrefixOf = exports.hashDeviceToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../../../config"));
const hashDeviceToken = (raw) => {
    var _a;
    const secret = ((_a = config_1.default.jwt) === null || _a === void 0 ? void 0 : _a.jwt_secret) || 'fallback-dev-only';
    return crypto_1.default.createHmac('sha256', secret).update(raw).digest('hex');
};
exports.hashDeviceToken = hashDeviceToken;
const tokenPrefixOf = (raw) => {
    if (!raw)
        return '';
    return raw.length <= 6 ? raw : `…${raw.slice(-6)}`;
};
exports.tokenPrefixOf = tokenPrefixOf;
const hashIp = (ip) => {
    var _a;
    const secret = ((_a = config_1.default.jwt) === null || _a === void 0 ? void 0 : _a.jwt_secret) || 'fallback-dev-only';
    return crypto_1.default.createHmac('sha256', secret).update(ip).digest('hex');
};
exports.hashIp = hashIp;
