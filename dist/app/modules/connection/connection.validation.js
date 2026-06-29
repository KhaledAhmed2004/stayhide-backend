"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionValidation = void 0;
const zod_1 = require("zod");
const sendConnectionRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        receiverId: zod_1.z.string({ required_error: 'Receiver user ID is required' }),
    }),
});
// Single reusable schema for all action endpoints that only need :connectionId in params
const connectionIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        connectionId: zod_1.z.string({ required_error: 'Connection ID is required' }),
    }),
});
exports.ConnectionValidation = {
    sendConnectionRequestSchema,
    connectionIdParamSchema,
};
