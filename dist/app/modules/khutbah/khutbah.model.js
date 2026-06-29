"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const KhutbaSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    mosqueName: { type: String, required: true },
    imam: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String },
    audioUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    durationInSeconds: { type: Number },
}, {
    timestamps: true,
});
// Indexes for global search and fast sorting
KhutbaSchema.index({ title: 'text', imam: 'text', mosqueName: 'text' });
KhutbaSchema.index({ date: -1 });
const KhutbaModel = (0, mongoose_1.model)('Khutba', KhutbaSchema);
exports.default = KhutbaModel;
