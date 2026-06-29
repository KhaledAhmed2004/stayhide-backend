"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DietLog = void 0;
const mongoose_1 = require("mongoose");
const dietLogSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: String,
        required: true,
    },
    mealType: {
        type: String,
        enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'],
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    note: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
exports.DietLog = (0, mongoose_1.model)('DietLog', dietLogSchema);
