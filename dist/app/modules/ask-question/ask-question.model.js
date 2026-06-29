"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const AnswerVersionSchema = new mongoose_1.Schema({
    version: { type: Number, required: true },
    text: { type: String, required: true },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true },
}, { _id: false });
const AskQuestionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, enum: ['BROTHER', 'SISTER'], required: true },
    question: { type: String, required: true },
    imageUrl: { type: String },
    status: {
        type: String,
        enum: ['pending', 'answered'],
        default: 'pending',
        required: true,
    },
    answers: { type: [AnswerVersionSchema], default: [] },
}, { timestamps: true });
// Indexes
AskQuestionSchema.index({ question: 'text' });
AskQuestionSchema.index({ userId: 1 });
AskQuestionSchema.index({ userRole: 1 });
AskQuestionSchema.index({ status: 1 });
AskQuestionSchema.index({ createdAt: -1 });
const AskQuestion = (0, mongoose_1.model)('AskQuestion', AskQuestionSchema);
exports.default = AskQuestion;
