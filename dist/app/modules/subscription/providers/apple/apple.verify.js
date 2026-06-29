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
exports.verifyAppleTransaction = void 0;
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../../../errors/ApiError"));
const config_1 = __importDefault(require("../../../../../config"));
const apple_client_1 = require("./apple.client");
const mapEnvironment = (raw) => {
    const value = String(raw || '').toLowerCase();
    return value.includes('prod') ? 'production' : 'sandbox';
};
const verifyAppleTransaction = (signedTransactionInfo) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!signedTransactionInfo || typeof signedTransactionInfo !== 'string') {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'signedTransactionInfo is required and must be a string');
    }
    const verifier = (0, apple_client_1.getAppleVerifier)();
    let decoded;
    try {
        decoded = yield verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Apple transaction verification failed: ${message}`);
    }
    // Apple types all fields as optional. Guard every required field.
    if (!decoded.transactionId || !decoded.originalTransactionId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Decoded Apple transaction is missing transaction IDs');
    }
    if (!decoded.productId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Decoded Apple transaction is missing productId');
    }
    if (!decoded.bundleId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Decoded Apple transaction is missing bundleId');
    }
    if (decoded.bundleId !== config_1.default.apple.bundleId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Bundle ID mismatch: expected ${config_1.default.apple.bundleId}, received ${decoded.bundleId}`);
    }
    if (decoded.revocationDate) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Transaction has been revoked by Apple');
    }
    if (decoded.expiresDate && Date.now() > decoded.expiresDate) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Transaction has already expired');
    }
    return {
        transactionId: decoded.transactionId,
        originalTransactionId: decoded.originalTransactionId,
        productId: decoded.productId,
        bundleId: decoded.bundleId,
        purchaseDate: (_a = decoded.purchaseDate) !== null && _a !== void 0 ? _a : Date.now(),
        expiresDate: decoded.expiresDate,
        revocationDate: decoded.revocationDate,
        revocationReason: typeof decoded.revocationReason === 'number'
            ? decoded.revocationReason
            : undefined,
        environment: mapEnvironment(decoded.environment),
        appAccountToken: decoded.appAccountToken,
        isUpgraded: decoded.isUpgraded,
    };
});
exports.verifyAppleTransaction = verifyAppleTransaction;
