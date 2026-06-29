"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalPage = void 0;
const mongoose_1 = require("mongoose");
const legalPageSchema = new mongoose_1.Schema({
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    content: {
        type: String,
        default: '',
    },
}, { timestamps: true });
exports.LegalPage = (0, mongoose_1.model)('LegalPage', legalPageSchema);
