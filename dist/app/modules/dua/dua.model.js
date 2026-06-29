"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const DuaSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    waqt: {
        type: String,
        enum: ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'],
        required: true,
    },
    details: { type: String, required: true },
    audioUrl: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
}, {
    timestamps: true,
});
// Indexes for fast searching and filtering
DuaSchema.index({ title: 'text', details: 'text' });
DuaSchema.index({ waqt: 1 });
const DuaModel = (0, mongoose_1.model)('Dua', DuaSchema);
exports.default = DuaModel;
