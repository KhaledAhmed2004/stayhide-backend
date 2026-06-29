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
exports.SymptomLogService = void 0;
const symptom_log_model_1 = require("./symptom-log.model");
const dayjs_1 = __importDefault(require("dayjs"));
const upsertTodayLogToDB = (userId, date, payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Clean up notes if provided
    if (payload.additionalNotes) {
        payload.additionalNotes = payload.additionalNotes
            .replace(/\n{3,}/g, '\n\n') // replace 3+ newlines with 2
            .trim();
    }
    const updatedLog = yield symptom_log_model_1.SymptomLog.findOneAndUpdate({ user: userId, date }, { $set: payload }, { new: true, upsert: true, runValidators: true });
    return updatedLog;
});
const getLogByDateFromDB = (userId, date) => __awaiter(void 0, void 0, void 0, function* () {
    return yield symptom_log_model_1.SymptomLog.findOne({ user: userId, date });
});
const getMoodScore = (mood) => {
    switch (mood) {
        case 'excellent': return 10.0;
        case 'good': return 8.0;
        case 'neutral': return 6.0;
        case 'bad': return 4.0;
        case 'very_bad': return 2.0;
        default: return 6.0;
    }
};
const calculateWellnessIndex = (log) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!log)
        return null;
    const sleepScore = (((_a = log.sleep) === null || _a === void 0 ? void 0 : _a.quality) || 0) * 2;
    const moodScore = getMoodScore((_b = log.mood) === null || _b === void 0 ? void 0 : _b.value);
    const totalSeverity = (((_c = log.nightSweats) === null || _c === void 0 ? void 0 : _c.severity) || 0) +
        (((_d = log.brainFog) === null || _d === void 0 ? void 0 : _d.severity) || 0) +
        (((_e = log.jointPain) === null || _e === void 0 ? void 0 : _e.severity) || 0) +
        (((_f = log.fatigue) === null || _f === void 0 ? void 0 : _f.severity) || 0) +
        (((_g = log.anxiety) === null || _g === void 0 ? void 0 : _g.severity) || 0);
    let symptomScore = 10.0 - (totalSeverity / 2.5);
    if (symptomScore < 0)
        symptomScore = 0;
    const wellnessIndex = (sleepScore + moodScore + symptomScore) / 3;
    return Math.round(wellnessIndex * 10) / 10;
};
const getTrendsFromDB = (userId, days) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const endDate = (0, dayjs_1.default)();
    const startDate = endDate.subtract(days - 1, 'day');
    const startDateStr = startDate.format('YYYY-MM-DD');
    const endDateStr = endDate.format('YYYY-MM-DD');
    const logs = yield symptom_log_model_1.SymptomLog.find({
        user: userId,
        date: { $gte: startDateStr, $lte: endDateStr },
    }).sort({ date: 1 }).lean();
    const logsMap = new Map();
    logs.forEach(log => logsMap.set(log.date, log));
    const data = [];
    let daysLogged = 0;
    const summaryAcc = {
        hotFlashes: { totalCount: 0, severitySum: 0, count: 0 },
        nightSweats: { severitySum: 0, count: 0 },
        sleep: { hoursSum: 0, qualitySum: 0, count: 0 },
        fatigue: { severitySum: 0, count: 0 },
        brainFog: { severitySum: 0, count: 0 },
        jointPain: { severitySum: 0, count: 0 },
        anxiety: { severitySum: 0, count: 0 },
        moods: {},
        wellnessIndex: { sum: 0, count: 0 }
    };
    for (let i = 0; i < days; i++) {
        const currentDate = startDate.add(i, 'day').format('YYYY-MM-DD');
        const log = logsMap.get(currentDate);
        if (log) {
            daysLogged++;
            const wellnessIndex = calculateWellnessIndex(log);
            data.push({
                date: currentDate,
                logged: true,
                wellnessIndex,
                hotFlashes: log.hotFlashes || null,
                nightSweats: log.nightSweats || null,
                sleep: log.sleep || null,
                fatigue: log.fatigue || null,
                brainFog: log.brainFog || null,
                jointPain: log.jointPain || null,
                anxiety: log.anxiety || null,
                mood: log.mood || null,
                additionalNotes: log.additionalNotes || null,
            });
            if (wellnessIndex !== null) {
                summaryAcc.wellnessIndex.sum += wellnessIndex;
                summaryAcc.wellnessIndex.count++;
            }
            if (log.hotFlashes) {
                summaryAcc.hotFlashes.totalCount += (log.hotFlashes.count || 0);
                summaryAcc.hotFlashes.severitySum += (log.hotFlashes.severity || 0);
                summaryAcc.hotFlashes.count++;
            }
            if ((_a = log.nightSweats) === null || _a === void 0 ? void 0 : _a.severity) {
                summaryAcc.nightSweats.severitySum += log.nightSweats.severity;
                summaryAcc.nightSweats.count++;
            }
            if (log.sleep) {
                summaryAcc.sleep.hoursSum += (log.sleep.hours || 0);
                summaryAcc.sleep.qualitySum += (log.sleep.quality || 0);
                summaryAcc.sleep.count++;
            }
            if ((_b = log.fatigue) === null || _b === void 0 ? void 0 : _b.severity) {
                summaryAcc.fatigue.severitySum += log.fatigue.severity;
                summaryAcc.fatigue.count++;
            }
            if ((_c = log.brainFog) === null || _c === void 0 ? void 0 : _c.severity) {
                summaryAcc.brainFog.severitySum += log.brainFog.severity;
                summaryAcc.brainFog.count++;
            }
            if ((_d = log.jointPain) === null || _d === void 0 ? void 0 : _d.severity) {
                summaryAcc.jointPain.severitySum += log.jointPain.severity;
                summaryAcc.jointPain.count++;
            }
            if ((_e = log.anxiety) === null || _e === void 0 ? void 0 : _e.severity) {
                summaryAcc.anxiety.severitySum += log.anxiety.severity;
                summaryAcc.anxiety.count++;
            }
            if ((_f = log.mood) === null || _f === void 0 ? void 0 : _f.value) {
                summaryAcc.moods[log.mood.value] = (summaryAcc.moods[log.mood.value] || 0) + 1;
            }
        }
        else {
            data.push({
                date: currentDate,
                logged: false,
                wellnessIndex: null,
                hotFlashes: null,
                nightSweats: null,
                sleep: null,
                fatigue: null,
                brainFog: null,
                jointPain: null,
                anxiety: null,
                mood: null,
                additionalNotes: null,
            });
        }
    }
    const round2 = (num) => Math.round(num * 100) / 100;
    const summary = {};
    if (summaryAcc.wellnessIndex.count > 0) {
        summary.averageWellnessIndex = round2(summaryAcc.wellnessIndex.sum / summaryAcc.wellnessIndex.count);
    }
    if (summaryAcc.hotFlashes.count > 0) {
        summary.hotFlashes = {
            totalCount: summaryAcc.hotFlashes.totalCount,
            averageSeverity: round2(summaryAcc.hotFlashes.severitySum / summaryAcc.hotFlashes.count)
        };
    }
    if (summaryAcc.nightSweats.count > 0) {
        summary.nightSweats = {
            averageSeverity: round2(summaryAcc.nightSweats.severitySum / summaryAcc.nightSweats.count)
        };
    }
    if (summaryAcc.sleep.count > 0) {
        summary.sleep = {
            averageHours: round2(summaryAcc.sleep.hoursSum / summaryAcc.sleep.count),
            averageQuality: round2(summaryAcc.sleep.qualitySum / summaryAcc.sleep.count)
        };
    }
    if (summaryAcc.fatigue.count > 0) {
        summary.fatigue = {
            averageSeverity: round2(summaryAcc.fatigue.severitySum / summaryAcc.fatigue.count)
        };
    }
    if (summaryAcc.brainFog.count > 0) {
        summary.brainFog = {
            averageSeverity: round2(summaryAcc.brainFog.severitySum / summaryAcc.brainFog.count)
        };
    }
    if (summaryAcc.jointPain.count > 0) {
        summary.jointPain = {
            averageSeverity: round2(summaryAcc.jointPain.severitySum / summaryAcc.jointPain.count)
        };
    }
    if (summaryAcc.anxiety.count > 0) {
        summary.anxiety = {
            averageSeverity: round2(summaryAcc.anxiety.severitySum / summaryAcc.anxiety.count)
        };
    }
    if (Object.keys(summaryAcc.moods).length > 0) {
        let mostFrequent = '';
        let maxCount = 0;
        for (const [mood, count] of Object.entries(summaryAcc.moods)) {
            if (count > maxCount) {
                maxCount = count;
                mostFrequent = mood;
            }
        }
        summary.mood = { mostFrequent };
    }
    const completionRate = days > 0 ? round2((daysLogged / days) * 100) : 0;
    return {
        meta: {
            daysRequested: days,
            startDate: startDateStr,
            endDate: endDateStr,
            daysLogged,
            completionRate
        },
        summary,
        data
    };
});
const generateDailySummary = (userId, date) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const log = yield symptom_log_model_1.SymptomLog.findOne({ user: userId, date }).lean();
    if (!log) {
        return {
            date,
            wellnessScore: null,
            mood: null,
            sleep: null,
            topSymptoms: [],
            insights: ['No data logged for this date.']
        };
    }
    const wellnessScore = calculateWellnessIndex(log);
    const symptomsList = [
        { name: 'anxiety', severity: ((_a = log.anxiety) === null || _a === void 0 ? void 0 : _a.severity) || 0 },
        { name: 'fatigue', severity: ((_b = log.fatigue) === null || _b === void 0 ? void 0 : _b.severity) || 0 },
        { name: 'brainFog', severity: ((_c = log.brainFog) === null || _c === void 0 ? void 0 : _c.severity) || 0 },
        { name: 'jointPain', severity: ((_d = log.jointPain) === null || _d === void 0 ? void 0 : _d.severity) || 0 },
        { name: 'nightSweats', severity: ((_e = log.nightSweats) === null || _e === void 0 ? void 0 : _e.severity) || 0 },
        { name: 'hotFlashes', severity: ((_f = log.hotFlashes) === null || _f === void 0 ? void 0 : _f.severity) || 0 }
    ];
    const topSymptoms = symptomsList
        .filter(s => s.severity > 0)
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 3);
    const insights = [];
    if (wellnessScore !== null) {
        if (wellnessScore >= 8)
            insights.push('Your wellness score is Excellent today.');
        else if (wellnessScore >= 6)
            insights.push('Your wellness score is Good today.');
        else if (wellnessScore >= 4)
            insights.push('Your wellness score is Fair today.');
        else
            insights.push('Your wellness score is Poor today, please take care.');
    }
    if (topSymptoms.length > 0) {
        const highest = topSymptoms[0];
        if (highest.severity >= 4) {
            insights.push(`${highest.name} is your most prominent symptom today, consider resting or practicing relaxation techniques.`);
        }
        else {
            insights.push(`Your highest symptom today was ${highest.name}.`);
        }
    }
    else {
        insights.push('You had no severe symptoms today, great job!');
    }
    return {
        date,
        wellnessScore,
        mood: ((_g = log.mood) === null || _g === void 0 ? void 0 : _g.value) || null,
        sleep: log.sleep || null,
        topSymptoms,
        insights
    };
});
exports.SymptomLogService = {
    upsertTodayLogToDB,
    getLogByDateFromDB,
    getTrendsFromDB,
    generateDailySummary,
};
