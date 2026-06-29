"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handleCastError = (error) => {
    const errorMessages = [
        {
            path: error.path,
            message: `Invalid value '${error.value}' for field '${error.path}'`,
        },
    ];
    const statusCode = 400;
    return {
        statusCode,
        message: 'Invalid ID format',
        errorMessages,
    };
};
exports.default = handleCastError;
