"use strict";
/**
 * Capture Configuration
 *
 * Configuration for function argument and return value capture.
 * Loads settings from environment variables and provides utility
 * functions for determining when to capture data.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureConfig = void 0;
exports.getCaptureConfig = getCaptureConfig;
exports.shouldCapture = shouldCapture;
exports.isSensitiveField = isSensitiveField;
const config_1 = __importDefault(require("../../config"));
// Functions that should NEVER have args captured (too sensitive)
const EXCLUDED_FUNCTIONS = new Set([
    'AuthService.hashPassword',
    'AuthService.comparePassword',
    'AuthService.verifyPassword',
    'FileService.uploadLarge',
    'PaymentService.processCard',
    'PaymentService.handleCardPayment',
]);
/**
 * Get capture configuration from environment/config
 */
function getCaptureConfig() {
    var _a;
    const tracingConfig = (_a = config_1.default.tracing) === null || _a === void 0 ? void 0 : _a.capture;
    return {
        enabled: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.enabled) !== false,
        args: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.args) !== false,
        returns: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.returns) !== false,
        maxDepth: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.maxDepth) || 5,
        maxArrayItems: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.maxArrayItems) || 10,
        maxStringLength: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.maxStringLength) || 500,
        maxSizeKB: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.maxSizeKB) || 5,
        maskPII: (tracingConfig === null || tracingConfig === void 0 ? void 0 : tracingConfig.maskPII) !== false,
    };
}
/**
 * Determine if we should capture args/returns for this function
 *
 * @param label - Function label (e.g., "AuthService.login")
 * @param duration - Optional duration in ms (for conditional capture)
 * @returns true if should capture, false otherwise
 */
function shouldCapture(label, duration) {
    const captureConfig = getCaptureConfig();
    // Check if capture is globally enabled
    if (!captureConfig.enabled) {
        return false;
    }
    // Check if function is in exclusion list
    if (EXCLUDED_FUNCTIONS.has(label)) {
        return false;
    }
    // If duration provided, can add conditional logic
    // For example: only capture slow requests
    // if (duration && duration < 300) {
    //   return false; // Only capture slow requests (>300ms)
    // }
    return true;
}
/**
 * Check if a specific field name is sensitive
 */
function isSensitiveField(fieldName) {
    const lowerName = fieldName.toLowerCase();
    const sensitivePatterns = [
        'password',
        'token',
        'secret',
        'key',
        'apikey',
        'jwt',
        'auth',
        'credential',
    ];
    return sensitivePatterns.some(pattern => lowerName.includes(pattern));
}
// Export config as default
exports.captureConfig = getCaptureConfig();
