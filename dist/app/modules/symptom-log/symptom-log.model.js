"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymptomLog = void 0;
const mongoose_1 = require("mongoose");
const symptomLogSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: String,
        required: true,
    },
    hotFlashes: {
        count: { type: Number },
        severity: { type: Number, min: 1, max: 5 },
    },
    nightSweats: {
        severity: { type: Number, min: 1, max: 5 },
    },
    mood: {
        value: {
            type: String,
            enum: ['excellent', 'good', 'neutral', 'bad', 'very_bad'],
        },
    },
    sleep: {
        hours: { type: Number, min: 0, max: 24 },
        quality: { type: Number, min: 1, max: 5 },
    },
    brainFog: {
        severity: { type: Number, min: 1, max: 5 },
    },
    jointPain: {
        severity: { type: Number, min: 1, max: 5 },
    },
    fatigue: {
        severity: { type: Number, min: 1, max: 5 },
    },
    anxiety: {
        severity: { type: Number, min: 1, max: 5 },
    },
    additionalNotes: {
        type: String,
        maxlength: 1000,
    },
}, { timestamps: true });
// Ensure unique log per user per day
symptomLogSchema.index({ user: 1, date: 1 }, { unique: true });
exports.SymptomLog = (0, mongoose_1.model)('SymptomLog', symptomLogSchema);
