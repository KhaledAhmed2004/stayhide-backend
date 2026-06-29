"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskQuestionService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const ask_question_model_1 = __importDefault(require("./ask-question.model"));
const NotificationBuilder_1 = __importDefault(require("../../builder/NotificationBuilder/NotificationBuilder"));
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const validateObjectId_1 = require("../../../shared/validateObjectId");
const logger_1 = require("../../../shared/logger");
const submitQuestionIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield ask_question_model_1.default.create(payload);
    return result;
});
const getAllQuestionsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    // Fix for existing data: Sync userRole if missing
    const questionsToSync = yield ask_question_model_1.default.find({ userRole: { $exists: false } });
    if (questionsToSync.length > 0) {
        for (const question of questionsToSync) {
            const user = yield mongoose_1.default.model('User').findById(question.userId);
            if (user) {
                yield ask_question_model_1.default.findByIdAndUpdate(question._id, { userRole: user.role });
            }
        }
    }
    const questionQuery = new QueryBuilder_1.default(ask_question_model_1.default.find().populate('userId', 'name email role'), query)
        .textSearch()
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield questionQuery.modelQuery;
    const pagination = yield questionQuery.getPaginationInfo();
    return { data, pagination };
});
const getMyQuestionsFromDB = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const questionQuery = new QueryBuilder_1.default(ask_question_model_1.default.find({ userId }), query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield questionQuery.modelQuery;
    const pagination = yield questionQuery.getPaginationInfo();
    return { data, pagination };
});
const answerQuestionInDB = (id, answer) => __awaiter(void 0, void 0, void 0, function* () {
    // Guard: reject malformed ObjectIds before any DB call to prevent raw CastErrors
    (0, validateObjectId_1.validateObjectId)(id, 'question ID');
    const question = yield ask_question_model_1.default.findById(id);
    if (!question) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Question not found');
    }
    const isFirstAnswer = question.status === 'pending';
    // Deactivate the current active version (handles re-answers)
    question.answers.forEach(a => {
        a.isActive = false;
    });
    // Push new version — 1-indexed, always increments
    const nextVersion = question.answers.length + 1;
    question.answers.push({
        version: nextVersion,
        text: answer,
        isActive: true,
        createdAt: new Date(),
    });
    // Flip status only on the first answer
    if (isFirstAnswer) {
        question.status = 'answered';
    }
    const result = yield question.save();
    // Notify only on first answer — re-answers must not re-notify the user
    if (isFirstAnswer && question.userId) {
        new NotificationBuilder_1.default()
            .to(question.userId.toString())
            .setTitle('Question Answered')
            .setText('An Imam has answered your question.')
            .setType('QUESTION_ANSWERED')
            .setResource('AskQuestion', id)
            .viaAll()
            .send()
            .catch(err => {
            var _a;
            return logger_1.errorLogger.error('Failed to send QUESTION_ANSWERED notification', {
                questionId: id,
                recipientId: (_a = question.userId) === null || _a === void 0 ? void 0 : _a.toString(),
                err,
            });
        });
    }
    return result;
});
const getQuestionMetricsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const aggregationBuilder = new AggregationBuilder_1.default(ask_question_model_1.default);
    const totalStats = yield aggregationBuilder.calculateGrowth({
        period: 'month',
    });
    const answeredStats = yield aggregationBuilder.calculateGrowth({
        filter: { status: 'answered' },
        period: 'month',
    });
    const pendingStats = yield aggregationBuilder.calculateGrowth({
        filter: { status: 'pending' },
        period: 'month',
    });
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: stat.growth,
        direction: stat.growthType === 'increase'
            ? 'up'
            : stat.growthType === 'decrease'
                ? 'down'
                : 'neutral',
    });
    return {
        meta: { comparisonPeriod: 'month' },
        totalQuestions: formatMetric(totalStats),
        answeredQuestions: formatMetric(answeredStats),
        pendingQuestions: formatMetric(pendingStats),
    };
});
exports.AskQuestionService = {
    submitQuestionIntoDB,
    getAllQuestionsFromDB,
    getMyQuestionsFromDB,
    answerQuestionInDB,
    getQuestionMetricsFromDB,
};
