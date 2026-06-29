"use strict";
/**
 * Capture Utilities
 *
 * Safe serialization, sanitization, and truncation utilities for
 * capturing function arguments and return values in OpenTelemetry spans.
 *
 * Features:
 * - Circular reference handling
 * - Sensitive data sanitization (passwords, tokens, API keys)
 * - PII masking (emails, phones)
 * - Size and depth limiting
 * - Smart array truncation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeSerialize = safeSerialize;
exports.sanitize = sanitize;
exports.truncate = truncate;
exports.formatArray = formatArray;
exports.exceedsSize = exceedsSize;
// Sensitive field names that should always be masked
const SENSITIVE_KEYS = new Set([
    // Authentication
    'password', 'newpassword', 'oldpassword', 'currentpassword',
    'confirmpassword', 'passwordconfirm', 'passwordhash', 'pwd',
    // Tokens & Keys
    'token', 'accesstoken', 'access_token', 'refreshtoken',
    'refresh_token', 'jwt', 'jwttoken', 'bearertoken',
    'apikey', 'api_key', 'secretkey', 'secret_key',
    'privatekey', 'private_key', 'publickey', 'public_key',
    // Stripe & Payment
    'clientsecret', 'client_secret', 'stripesecret',
    'cardnumber', 'card_number', 'cvv', 'cvc', 'pin',
    'accountnumber', 'account_number', 'routingnumber',
    // OAuth & Social
    'oauthtoken', 'oauth_token', 'oauthsecret',
    'googletoken', 'facebooktoken', 'githubtoken',
    // Security
    'secret', 'secretcode', 'otpcode', 'otp', 'mfacode',
    'verificationcode', 'resettoken', 'activationtoken',
    // Encryption
    'encryptionkey', 'encryption_key', 'iv', 'salt',
    'cipher', 'passphrase',
    // Session
    'sessionid', 'session_id', 'sessiontoken', 'csrftoken',
    // Database
    'connectionstring', 'databaseurl', 'db_url',
    // Cookies
    'cookie', 'cookies', 'setcookie',
]);
// PII fields (configurable masking)
const PII_KEYS = new Set([
    'email', 'phone', 'phonenumber', 'mobile',
    'ssn', 'socialsecurity', 'nationalid',
    'address', 'street', 'city', 'zip', 'zipcode',
    'birthdate', 'dob', 'dateofbirth',
    'firstname', 'lastname', 'name',
    'ip', 'ipaddress', 'ipv4', 'ipv6',
]);
/**
 * Safe JSON serialization with circular reference handling
 */
function safeSerialize(value, options = {}) {
    const seen = new WeakSet();
    const maxDepth = options.maxDepth || 5;
    const replacer = function (key, val, depth = 0) {
        var _a;
        // Handle circular references
        if (val !== null && typeof val === 'object') {
            if (seen.has(val)) {
                return '[Circular]';
            }
            seen.add(val);
        }
        // Handle depth limit
        if (depth > maxDepth) {
            if (Array.isArray(val)) {
                return `[Array: ${val.length} items]`;
            }
            if (val && typeof val === 'object') {
                return `[Object: ${Object.keys(val).length} keys]`;
            }
        }
        // Handle special types
        if (Buffer.isBuffer(val)) {
            return {
                _type: 'Buffer',
                length: val.length,
                preview: val.slice(0, 20).toString('hex'),
            };
        }
        if (typeof val === 'function') {
            return {
                _type: 'Function',
                name: val.name || 'anonymous',
                params: val.length,
            };
        }
        if (val instanceof Error) {
            return {
                _type: 'Error',
                name: val.name,
                message: val.message,
                stack: (_a = val.stack) === null || _a === void 0 ? void 0 : _a.split('\n').slice(0, 3).join('\n'),
            };
        }
        if (val instanceof Date) {
            return {
                _type: 'Date',
                value: val.toISOString(),
            };
        }
        if (val && typeof val.readable === 'boolean') {
            return {
                _type: 'Stream',
                readable: val.readable,
            };
        }
        return val;
    };
    try {
        return JSON.stringify(value, replacer);
    }
    catch (err) {
        return '[Unserializable]';
    }
}
/**
 * Sanitize sensitive data by masking passwords, tokens, PII, etc.
 */
function sanitize(value, options = {}) {
    const { maskPII = true, sensitiveKeys = SENSITIVE_KEYS } = options;
    // Handle primitives
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value !== 'object') {
        return value;
    }
    // Handle arrays
    if (Array.isArray(value)) {
        return value.map(item => sanitize(item, options));
    }
    // Handle objects
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
        const lowerKey = key.toLowerCase();
        // Mask sensitive fields
        if (sensitiveKeys.has(lowerKey)) {
            sanitized[key] = '********';
            continue;
        }
        // Mask PII fields
        if (maskPII && PII_KEYS.has(lowerKey)) {
            if (typeof val === 'string') {
                if (lowerKey === 'email') {
                    sanitized[key] = maskEmail(val);
                }
                else if (lowerKey.includes('phone') || lowerKey === 'mobile') {
                    sanitized[key] = maskPhone(val);
                }
                else if (lowerKey.includes('name')) {
                    sanitized[key] = maskName(val);
                }
                else {
                    sanitized[key] = maskGeneric(val);
                }
                continue;
            }
        }
        // Recursively sanitize nested objects
        if (val && typeof val === 'object') {
            sanitized[key] = sanitize(val, options);
        }
        else {
            sanitized[key] = val;
        }
    }
    return sanitized;
}
/**
 * Truncate large data structures
 */
function truncate(value, options = {}) {
    const { maxDepth = 5, maxArrayItems = 10, maxStringLength = 500, } = options;
    return truncateRecursive(value, 0, maxDepth, maxArrayItems, maxStringLength);
}
function truncateRecursive(value, depth, maxDepth, maxArrayItems, maxStringLength) {
    // Check depth limit
    if (depth > maxDepth) {
        if (Array.isArray(value)) {
            return { _truncated: 'Array', length: value.length };
        }
        if (value && typeof value === 'object') {
            return { _truncated: 'Object', keys: Object.keys(value).length };
        }
        return value;
    }
    // Handle primitives
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        if (value.length > maxStringLength) {
            return value.substring(0, maxStringLength) + '... [Truncated]';
        }
        return value;
    }
    if (typeof value !== 'object') {
        return value;
    }
    // Handle arrays
    if (Array.isArray(value)) {
        return formatArray(value, maxArrayItems, depth, maxDepth, maxStringLength);
    }
    // Handle objects
    const truncated = {};
    for (const [key, val] of Object.entries(value)) {
        truncated[key] = truncateRecursive(val, depth + 1, maxDepth, maxArrayItems, maxStringLength);
    }
    return truncated;
}
/**
 * Format array with smart truncation based on size
 */
function formatArray(arr, maxItems = 10, depth = 0, maxDepth = 5, maxStringLength = 500) {
    const length = arr.length;
    // Empty array
    if (length === 0) {
        return { _type: 'Array', length: 0, empty: true };
    }
    // Small array - show all
    if (length <= maxItems) {
        return arr.map(item => truncateRecursive(item, depth + 1, maxDepth, maxItems, maxStringLength));
    }
    // Medium array (11-50) - show first N
    if (length <= 50) {
        return {
            _type: 'Array',
            _display: 'truncated',
            length: length,
            items: arr.slice(0, maxItems).map(item => truncateRecursive(item, depth + 1, maxDepth, maxItems, maxStringLength)),
            truncated: length - maxItems,
        };
    }
    // Large array (51-1000) - show summary
    if (length <= 1000) {
        return {
            _type: 'Array',
            _display: 'summary',
            length: length,
            sample: {
                first: arr.slice(0, 3).map(item => truncateRecursive(item, depth + 1, maxDepth, maxItems, maxStringLength)),
                last: arr.slice(-3).map(item => truncateRecursive(item, depth + 1, maxDepth, maxItems, maxStringLength)),
            },
        };
    }
    // Huge array (>1000) - minimal info
    return {
        _type: 'Array',
        _display: 'huge',
        length: length,
        warning: 'Large array (>1K items)',
        sample: arr.slice(0, 2).map(item => truncateRecursive(item, depth + 1, maxDepth, maxItems, maxStringLength)),
    };
}
/**
 * Check if serialized value exceeds size limit
 */
function exceedsSize(serialized, maxSizeKB) {
    const sizeKB = Buffer.byteLength(serialized, 'utf8') / 1024;
    return sizeKB > maxSizeKB;
}
// Helper functions for PII masking
function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (!domain)
        return '***@***';
    const maskedLocal = local.length <= 2
        ? '***'
        : local[0] + '***' + (local.length > 3 ? local[local.length - 1] : '');
    const [domainName, tld] = domain.split('.');
    const maskedDomain = domainName.length <= 2
        ? '***'
        : domainName[0] + '***';
    return `${maskedLocal}@${maskedDomain}.${tld || '***'}`;
}
function maskPhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4)
        return '+***';
    return `+***${digits.slice(-4)}`;
}
function maskName(name) {
    const words = name.split(' ');
    return words
        .map(word => {
        if (word.length <= 1)
            return word;
        return word[0] + '***';
    })
        .join(' ');
}
function maskGeneric(value) {
    if (value.length <= 4)
        return '***';
    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
}
