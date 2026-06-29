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
exports.calculateGrowthDynamic = void 0;
const requestContext_1 = require("../logging/requestContext");
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
class AggregationBuilder {
    constructor(model) {
        this.pipeline = [];
        this.model = model;
    }
    // ====== PIPELINE BUILDERS ======
    match(conditions) {
        this.pipeline.push({ $match: conditions });
        return this;
    }
    group(groupSpec) {
        this.pipeline.push({ $group: groupSpec });
        return this;
    }
    project(projectSpec) {
        this.pipeline.push({ $project: projectSpec });
        return this;
    }
    sort(sortSpec) {
        this.pipeline.push({ $sort: sortSpec });
        return this;
    }
    limit(limitValue) {
        this.pipeline.push({ $limit: limitValue });
        return this;
    }
    reset() {
        this.pipeline = [];
        return this;
    }
    getPipeline() {
        return this.pipeline;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const _start = Date.now();
            const res = yield this.model.aggregate(this.pipeline);
            const dur = Date.now() - _start;
            const modelName = ((_a = this.model) === null || _a === void 0 ? void 0 : _a.modelName) || ((_c = (_b = this.model) === null || _b === void 0 ? void 0 : _b.collection) === null || _c === void 0 ? void 0 : _c.name);
            const pipelineSummary = summarizePipeline(this.pipeline);
            (0, requestContext_1.recordDbQuery)(dur, { model: modelName, operation: 'aggregate', cacheHit: false, pipeline: pipelineSummary });
            return res;
        });
    }
    // ====== PERIOD CALCULATOR ======
    getPeriodDates(period) {
        const now = new Date();
        let startThis, startLast, endLast;
        switch (period) {
            case 'day':
                startThis = new Date(now);
                startThis.setHours(0, 0, 0, 0);
                startLast = new Date(startThis);
                startLast.setDate(startThis.getDate() - 1);
                endLast = new Date(startThis);
                endLast.setDate(startThis.getDate() - 1);
                endLast.setHours(23, 59, 59, 999);
                break;
            case 'week':
                const day = now.getDay(); // Sunday = 0
                startThis = new Date(now);
                startThis.setDate(now.getDate() - day);
                startThis.setHours(0, 0, 0, 0);
                startLast = new Date(startThis);
                startLast.setDate(startThis.getDate() - 7);
                endLast = new Date(startThis);
                endLast.setDate(startThis.getDate() - 1);
                endLast.setHours(23, 59, 59, 999);
                break;
            case 'month':
                startThis = new Date(now.getFullYear(), now.getMonth(), 1);
                startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endLast = new Date(now.getFullYear(), now.getMonth(), 0);
                endLast.setHours(23, 59, 59, 999);
                break;
            case 'quarter':
                const currentQuarter = Math.floor(now.getMonth() / 3);
                startThis = new Date(now.getFullYear(), currentQuarter * 3, 1);
                const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
                const lastQuarterYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
                startLast = new Date(lastQuarterYear, lastQuarter * 3, 1);
                endLast = new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0);
                endLast.setHours(23, 59, 59, 999);
                break;
            case 'year':
                startThis = new Date(now.getFullYear(), 0, 1);
                startLast = new Date(now.getFullYear() - 1, 0, 1);
                endLast = new Date(now.getFullYear() - 1, 11, 31);
                endLast.setHours(23, 59, 59, 999);
                break;
            default:
                throw new Error('Unsupported period');
        }
        return { startThis, startLast, endLast };
    }
    // ====== GENERIC GROWTH CALCULATION ======
    calculateGrowth() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            var _a, _b, _c;
            try {
                const { sumField, filter = {}, groupBy, period = 'month' } = options;
                const { startThis, startLast, endLast } = this.getPeriodDates(period);
                const buildPipeline = (dateFilter) => {
                    const pipeline = [];
                    const matchConditions = Object.assign({}, filter);
                    if (dateFilter)
                        matchConditions.createdAt = dateFilter;
                    pipeline.push({ $match: matchConditions });
                    const groupSpec = {
                        _id: groupBy ? `$${groupBy}` : null,
                    };
                    groupSpec.total = sumField ? { $sum: `$${sumField}` } : { $sum: 1 };
                    pipeline.push({ $group: groupSpec });
                    if (groupBy) {
                        pipeline.push({ $group: { _id: null, total: { $sum: '$total' } } });
                    }
                    return pipeline;
                };
                const [thisPeriodResult, lastPeriodResult, totalResult] = yield Promise.all([
                    this.model.aggregate(buildPipeline({ $gte: startThis })),
                    this.model.aggregate(buildPipeline({ $gte: startLast, $lte: endLast })),
                    this.model.aggregate(buildPipeline()),
                ]);
                const thisPeriodCount = ((_a = thisPeriodResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
                const lastPeriodCount = ((_b = lastPeriodResult[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
                const total = ((_c = totalResult[0]) === null || _c === void 0 ? void 0 : _c.total) || 0;
                // Growth calculation
                let growth = 0;
                let growthType = 'no_change';
                if (lastPeriodCount > 0) {
                    growth = ((thisPeriodCount - lastPeriodCount) / lastPeriodCount) * 100;
                    growthType =
                        growth > 0 ? 'increase' : growth < 0 ? 'decrease' : 'no_change';
                }
                else if (thisPeriodCount > 0 && lastPeriodCount === 0) {
                    growth = 100;
                    growthType = 'increase';
                }
                const formattedGrowth = (growth > 0 ? '+' : '') + growth.toFixed(2) + '%';
                return {
                    total,
                    thisPeriodCount,
                    lastPeriodCount,
                    growth: Math.abs(growth),
                    formattedGrowth,
                    growthType,
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to calculate growth: ${errorMessage}`);
            }
        });
    }
    // ====== REVENUE BREAKDOWN ======
    getRevenueBreakdown(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sumField, groupByField, filter = {}, limit = 10 } = options;
            this.pipeline = [
                { $match: filter },
                {
                    $group: {
                        _id: `$${groupByField}`,
                        totalRevenue: { $sum: `$${sumField}` },
                        count: { $sum: 1 },
                        averageRevenue: { $avg: `$${sumField}` },
                    },
                },
                { $sort: { totalRevenue: -1 } },
                { $limit: limit },
                {
                    $project: {
                        _id: 0,
                        [groupByField]: '$_id',
                        totalRevenue: { $round: ['$totalRevenue', 2] },
                        count: 1,
                        averageRevenue: { $round: ['$averageRevenue', 2] },
                    },
                },
            ];
            return yield this.execute();
        });
    }
    // ====== TIME TRENDS ======
    getTimeTrends(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sumField, timeUnit, filter = {}, year, from, to } = options;
            const now = new Date();
            const targetYear = year || now.getFullYear();
            const currentMonth = now.getMonth(); // 0-indexed
            // Build date filter
            const dateFilter = {};
            if (from || to) {
                if (from)
                    dateFilter.$gte = new Date(from);
                if (to)
                    dateFilter.$lte = new Date(to);
            }
            else {
                // Default to targetYear if no range provided
                dateFilter.$gte = new Date(targetYear, 0, 1);
                dateFilter.$lte = new Date(targetYear, 11, 31);
            }
            const matchFilter = Object.assign(Object.assign({}, filter), { createdAt: dateFilter });
            const dateGrouping = {
                day: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' },
                },
                week: { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } },
                month: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                year: { year: { $year: '$createdAt' } },
            };
            this.pipeline = [
                { $match: matchFilter },
                {
                    $group: {
                        _id: dateGrouping[timeUnit],
                        total: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: {
                        '_id.year': 1,
                        '_id.month': 1,
                        '_id.week': 1,
                        '_id.day': 1,
                    },
                },
            ];
            const results = yield this.execute();
            switch (timeUnit) {
                case 'month': {
                    const months = Array.from({ length: 12 }, (_, i) => ({
                        month: i + 1,
                        total: 0,
                        count: 0,
                    }));
                    results.forEach(item => {
                        // Only populate if the year matches the targetYear to prevent data bleed from ranges spanning multiple years
                        if (item._id.year === targetYear) {
                            const index = item._id.month - 1;
                            months[index] = {
                                month: item._id.month,
                                total: item.total,
                                count: item.count,
                            };
                        }
                    });
                    return months.map(m => ({
                        month: `${targetYear}-${String(m.month).padStart(2, '0')}`,
                        label: new Date(targetYear, m.month - 1).toLocaleString('default', {
                            month: 'long',
                        }) + ` ${targetYear}`,
                        totalRevenue: m.total,
                        transactionCount: m.count,
                    }));
                }
                case 'week': {
                    const weeks = Array.from({ length: 52 }, (_, i) => ({
                        week: i + 1,
                        total: 0,
                        count: 0,
                    }));
                    results.forEach(item => {
                        if (item._id.year === targetYear) {
                            const index = item._id.week - 1;
                            weeks[index] = {
                                week: item._id.week,
                                total: item.total,
                                count: item.count,
                            };
                        }
                    });
                    return weeks.map(w => ({
                        label: `Week ${w.week}`,
                        totalRevenue: w.total,
                        transactionCount: w.count,
                    }));
                }
                case 'day': {
                    const daysInMonth = new Date(targetYear, currentMonth + 1, 0).getDate();
                    const days = Array.from({ length: daysInMonth }, (_, i) => ({
                        day: i + 1,
                        total: 0,
                        count: 0,
                    }));
                    results.forEach(item => {
                        if (item._id.year === targetYear &&
                            item._id.month === currentMonth + 1) {
                            const index = item._id.day - 1;
                            days[index] = {
                                day: item._id.day,
                                total: item.total,
                                count: item.count,
                            };
                        }
                    });
                    return days.map(d => ({
                        label: `${now.toLocaleString('default', { month: 'short' })} ${d.day}`,
                        totalRevenue: d.total,
                        transactionCount: d.count,
                    }));
                }
                case 'year': {
                    const years = Array.from({ length: 5 }, (_, i) => ({
                        year: targetYear - i,
                        total: 0,
                        count: 0,
                    }));
                    results.forEach(item => {
                        const index = years.findIndex(y => y.year === item._id.year);
                        if (index >= 0) {
                            years[index] = {
                                year: item._id.year,
                                total: item.total,
                                count: item.count,
                            };
                        }
                    });
                    return years.map(y => ({
                        label: `${y.year}`,
                        totalRevenue: y.total,
                        transactionCount: y.count,
                    }));
                }
                default:
                    return results;
            }
        });
    }
    // ====== TOP PERFORMERS ======
    getTopPerformers(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sumField, groupByField, filter = {}, limit = 10, period, } = options;
                let dateFilter = {};
                if (period) {
                    const { startThis } = this.getPeriodDates(period);
                    dateFilter = { createdAt: { $gte: startThis } };
                }
                this.pipeline = [
                    { $match: Object.assign(Object.assign({}, filter), dateFilter) },
                    {
                        $group: {
                            _id: `$${groupByField}`,
                            totalValue: { $sum: `$${sumField}` },
                            count: { $sum: 1 },
                            averageValue: { $avg: `$${sumField}` },
                            firstSeen: { $min: '$createdAt' },
                            lastSeen: { $max: '$createdAt' },
                        },
                    },
                    { $sort: { totalValue: -1 } },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 0,
                            [groupByField]: '$_id',
                            totalValue: { $round: ['$totalValue', 2] },
                            count: 1,
                            averageValue: { $round: ['$averageValue', 2] },
                            firstSeen: 1,
                            lastSeen: 1,
                            rank: { $add: [{ $indexOfArray: [[], null] }, 1] },
                        },
                    },
                ];
                return yield this.execute();
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to get top performers: ${errorMessage}`);
            }
        });
    }
}
// ====== HELPER FUNCTION ======
const calculateGrowthDynamic = (Model_1, ...args_1) => __awaiter(void 0, [Model_1, ...args_1], void 0, function* (Model, options = {}) {
    try {
        const aggregationBuilder = new AggregationBuilder(Model);
        return yield aggregationBuilder.calculateGrowth(options);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to calculate growth dynamically: ${errorMessage}`);
    }
});
exports.calculateGrowthDynamic = calculateGrowthDynamic;
exports.default = AggregationBuilder;
// Compact summary for aggregation pipeline
function summarizePipeline(pipeline) {
    const parts = [];
    for (const stage of pipeline) {
        const key = stage && typeof stage === 'object' ? Object.keys(stage)[0] : undefined;
        if (!key)
            continue;
        const val = stage[key];
        switch (key) {
            case '$match': {
                const conds = val && typeof val === 'object' ? Object.keys(val) : [];
                const firstKey = conds[0];
                let display = `$match`;
                if (firstKey) {
                    const v = val[firstKey];
                    const repr = typeof v === 'object' ? JSON.stringify(v) : String(v);
                    display = `$match(${firstKey}=${repr})`;
                }
                parts.push(display);
                break;
            }
            case '$group': {
                const idVal = (val === null || val === void 0 ? void 0 : val._id) !== undefined ? val._id : undefined;
                const idRepr = idVal !== undefined ? String(idVal) : undefined;
                parts.push(idRepr ? `$group(_id='${idRepr}')` : `$group`);
                break;
            }
            case '$sort': {
                const keys = val && typeof val === 'object' ? Object.keys(val) : [];
                parts.push(keys.length ? `$sort(${keys.join(',')})` : `$sort`);
                break;
            }
            case '$project': {
                const keys = val && typeof val === 'object' ? Object.keys(val) : [];
                parts.push(keys.length ? `$project(${keys.length} fields)` : `$project`);
                break;
            }
            case '$lookup': {
                const from = (val === null || val === void 0 ? void 0 : val.from) ? String(val.from) : undefined;
                parts.push(from ? `$lookup(from='${from}')` : `$lookup`);
                break;
            }
            default:
                parts.push(key);
        }
    }
    return parts.join(' → ');
}
