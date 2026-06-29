"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalValidation = void 0;
const zod_1 = require("zod");
const createLegalPage = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({ required_error: 'Title is required' }).min(1).max(200),
        content: zod_1.z.string().optional(),
    }),
});
const updateLegalPage = zod_1.z.object({
    params: zod_1.z.object({
        slug: zod_1.z.string({ required_error: 'Slug is required' }),
    }),
    body: zod_1.z.object({
        title: zod_1.z.string().min(1).max(200).optional(),
        content: zod_1.z.string().min(1).optional(),
    }),
});
const deleteLegalPage = zod_1.z.object({
    params: zod_1.z.object({
        slug: zod_1.z.string({ required_error: 'Slug is required' }),
    }),
});
exports.LegalValidation = { createLegalPage, updateLegalPage, deleteLegalPage };
