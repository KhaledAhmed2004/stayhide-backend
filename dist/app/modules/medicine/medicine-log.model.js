"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationLog = void 0;
const mongoose_1 = require("mongoose");
const MedicationLogSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    medication: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Medication',
        required: true,
    },
    dateString: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/,
    },
    scheduledTime: {
        type: String,
        required: true,
        match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    status: {
        type: String,
        enum: ['TAKEN', 'SKIPPED', 'MISSED'],
        required: true,
    },
    source: {
        type: String,
        enum: ['USER', 'SYSTEM'],
        required: true,
    },
    takenAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Prevent Duplicate Logs Race Condition
MedicationLogSchema.index({ user: 1, medication: 1, dateString: 1, scheduledTime: 1 }, { unique: true });
// Optimize History Generation (Millions of logs)
MedicationLogSchema.index({ user: 1, dateString: -1 });
exports.MedicationLog = (0, mongoose_1.model)('MedicationLog', MedicationLogSchema);
