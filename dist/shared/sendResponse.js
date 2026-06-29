"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Helper to recursively transform keys to camelCase and alias _id to id
const snakeToCamel = (str) => str.replace(/(_\w)/g, m => m[1].toUpperCase());
const formatData = (obj, seen = new WeakSet()) => {
    if (obj === null ||
        typeof obj !== 'object' ||
        obj instanceof Date ||
        obj instanceof Buffer) {
        return obj;
    }
    // Handle circular references
    if (seen.has(obj)) {
        return undefined;
    }
    // Handle Mongoose documents/Objects
    if (typeof obj.toObject === 'function') {
        obj = obj.toObject();
    }
    // Handle ObjectId (Mongoose)
    if (obj.constructor && obj.constructor.name === 'ObjectId') {
        return obj.toString();
    }
    // Add to seen set to prevent infinite recursion
    seen.add(obj);
    if (Array.isArray(obj)) {
        return obj.map(v => formatData(v, seen));
    }
    return Object.keys(obj).reduce((result, key) => {
        let value = obj[key];
        // Recursive call for nested objects/arrays
        value = formatData(value, seen);
        // Alias _id to id
        const newKey = key === '_id' ? 'id' : snakeToCamel(key);
        result[newKey] = value;
        return result;
    }, {});
};
const sendResponse = (res, data) => {
    // 👇 store full response data for logger middleware
    res.locals.responsePayload = data;
    const resData = {
        success: data.success,
        statusCode: data.statusCode,
        message: data.message,
        meta: data.meta,
        data: data.data ? formatData(data.data) : data.data,
    };
    res.status(data.statusCode).json(resData);
};
exports.default = sendResponse;
