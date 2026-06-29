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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DietLogService = void 0;
const diet_log_model_1 = require("./diet-log.model");
const createLog = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    payload.user = userId;
    const result = yield diet_log_model_1.DietLog.create(payload);
    return result;
});
const getLogsByDate = (userId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield diet_log_model_1.DietLog.find({ user: userId, date }).sort({ createdAt: 1 });
    return result;
});
const getHistory = (userId, startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield diet_log_model_1.DietLog.find({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
    }).sort({ date: -1, createdAt: -1 });
    return result;
});
const updateLog = (userId, logId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield diet_log_model_1.DietLog.findOneAndUpdate({ _id: logId, user: userId }, { $set: payload }, { new: true, runValidators: true });
    if (!result) {
        throw new Error('Diet log not found or you are not authorized to update it.');
    }
    return result;
});
const deleteLog = (userId, logId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield diet_log_model_1.DietLog.findOneAndDelete({ _id: logId, user: userId });
    if (!result) {
        throw new Error('Diet log not found or you are not authorized to delete it.');
    }
    return result;
});
const symptom_log_model_1 = require("../symptom-log/symptom-log.model");
const diet_log_utils_1 = require("./diet-log.utils");
const generateInsights = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const endDateStr = today.toISOString().split('T')[0];
    const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];
    const dietLogs = yield diet_log_model_1.DietLog.find({
        user: userId,
        date: { $gte: startDateStr, $lte: endDateStr }
    }).lean();
    const symptomLogs = yield symptom_log_model_1.SymptomLog.find({
        user: userId,
        date: { $gte: startDateStr, $lte: endDateStr }
    }).lean();
    const targetSymptoms = ['fatigue', 'brainFog', 'jointPain', 'anxiety'];
    const symptomsByDate = {};
    symptomLogs.forEach(log => {
        symptomsByDate[log.date] = {};
        targetSymptoms.forEach(sym => {
            var _a;
            symptomsByDate[log.date][sym] = ((_a = log[sym]) === null || _a === void 0 ? void 0 : _a.severity) || 0;
        });
    });
    const getSeverityForDay = (dateStr, symptom) => {
        var _a, _b;
        const dayDate = new Date(dateStr);
        const nextDayDate = new Date(dayDate);
        nextDayDate.setDate(dayDate.getDate() + 1);
        const nextDayStr = nextDayDate.toISOString().split('T')[0];
        const s1 = ((_a = symptomsByDate[dateStr]) === null || _a === void 0 ? void 0 : _a[symptom]) || 0;
        const s2 = ((_b = symptomsByDate[nextDayStr]) === null || _b === void 0 ? void 0 : _b[symptom]) || 0;
        return Math.max(s1, s2);
    };
    const keywordToDates = {};
    const allDatesInWindow = new Set();
    dietLogs.forEach(log => {
        allDatesInWindow.add(log.date);
        const keywords = (0, diet_log_utils_1.tokenizeFoodItems)(log.name);
        keywords.forEach(kw => {
            if (!keywordToDates[kw])
                keywordToDates[kw] = new Set();
            keywordToDates[kw].add(log.date);
        });
    });
    const uniqueDatesArray = Array.from(allDatesInWindow);
    if (uniqueDatesArray.length === 0) {
        return { timeframe: '30_days', totalMealsAnalyzed: 0, highRiskTriggers: [], safeFoods: [] };
    }
    const insights = [];
    for (const [keyword, datesSet] of Object.entries(keywordToDates)) {
        if (datesSet.size < 3)
            continue;
        const daysEaten = Array.from(datesSet);
        const daysNotEaten = uniqueDatesArray.filter(d => !datesSet.has(d));
        targetSymptoms.forEach(symptom => {
            const sumEaten = daysEaten.reduce((acc, date) => acc + getSeverityForDay(date, symptom), 0);
            const avgEaten = sumEaten / daysEaten.length;
            let avgNotEaten = 0;
            if (daysNotEaten.length > 0) {
                const sumNotEaten = daysNotEaten.reduce((acc, date) => acc + getSeverityForDay(date, symptom), 0);
                avgNotEaten = sumNotEaten / daysNotEaten.length;
            }
            const triggerPower = avgEaten - avgNotEaten;
            if (triggerPower > 1.5 || triggerPower < -1.5) {
                insights.push({
                    food: keyword,
                    symptom,
                    triggerPower: parseFloat(triggerPower.toFixed(2)),
                    type: triggerPower > 1.5 ? 'HIGH_RISK_TRIGGER' : 'SAFE_SOOTHING_FOOD',
                    message: triggerPower > 1.5
                        ? `You tend to experience higher ${symptom} when you eat ${keyword}.`
                        : `Eating ${keyword} seems to be associated with lower ${symptom}.`
                });
            }
        });
    }
    return {
        timeframe: '30_days',
        totalMealsAnalyzed: dietLogs.length,
        highRiskTriggers: insights.filter(i => i.type === 'HIGH_RISK_TRIGGER'),
        safeFoods: insights.filter(i => i.type === 'SAFE_SOOTHING_FOOD'),
    };
});
exports.DietLogService = {
    createLog,
    getLogsByDate,
    getHistory,
    updateLog,
    deleteLog,
    generateInsights,
};
