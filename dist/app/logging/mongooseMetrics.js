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
exports.registerMongooseMetricsPlugin = registerMongooseMetricsPlugin;
const mongoose_1 = __importDefault(require("mongoose"));
const requestContext_1 = require("./requestContext");
const api_1 = require("@opentelemetry/api");
const loadOrderValidator_1 = require("./loadOrderValidator");
// This must be the FIRST module to load (before any models compile)
loadOrderValidator_1.LoadOrderValidator.markLoaded('MONGOOSE_METRICS', 'mongooseMetrics.ts');
function getModelName(self) {
    var _a, _b, _c;
    return (((_a = self === null || self === void 0 ? void 0 : self.model) === null || _a === void 0 ? void 0 : _a.modelName) ||
        ((_b = self === null || self === void 0 ? void 0 : self.constructor) === null || _b === void 0 ? void 0 : _b.modelName) ||
        ((_c = self === null || self === void 0 ? void 0 : self._model) === null || _c === void 0 ? void 0 : _c.modelName) ||
        (self === null || self === void 0 ? void 0 : self.modelName) ||
        undefined);
}
// 🆕 NEW: Mask sensitive data in query filters
function maskSensitiveData(obj) {
    if (!obj || typeof obj !== 'object')
        return obj;
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'accessToken', 'refreshToken', 'authorization'];
    const result = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
        if (isSensitive) {
            result[key] = '***MASKED***';
        }
        else if (obj[key] && typeof obj[key] === 'object') {
            result[key] = maskSensitiveData(obj[key]);
        }
        else {
            result[key] = obj[key];
        }
    }
    return result;
}
// 🆕 NEW: Extract caller location from stack trace
function getCallerLocation() {
    try {
        const err = new Error();
        const stack = err.stack;
        if (!stack)
            return undefined;
        const lines = stack.split('\n');
        // Find the first line that's NOT in mongooseMetrics.ts or node_modules
        for (const line of lines) {
            if (line.includes('mongooseMetrics.ts') ||
                line.includes('node_modules') ||
                line.includes('at Object.') ||
                line.includes('at Function.') ||
                !line.includes('at ')) {
                continue;
            }
            // Extract file path and line number
            // Example: "    at UserService.createUser (d:\path\to\user.service.ts:89:15)"
            const match = line.match(/\((.+):(\d+):\d+\)/) || line.match(/at (.+):(\d+):\d+/);
            if (match) {
                const fullPath = match[1];
                const lineNumber = match[2];
                // Extract just filename from full path
                const parts = fullPath.split(/[/\\]/);
                const filename = parts[parts.length - 1];
                return `${filename}:${lineNumber}`;
            }
        }
    }
    catch (_a) {
        // Silent failure
    }
    return undefined;
}
const preStart = (op) => function (next) {
    this.__metricsStart = Date.now();
    this.__metricsOp = op;
    try {
        const tracer = api_1.trace.getTracer('app');
        const model = getModelName(this) || 'UnknownModel';
        const span = tracer.startSpan(`🗄️  Database: ${model}.${op}`);
        this.__otelSpan = span;
    }
    catch (_a) { }
    next();
};
const postEnd = (op) => function (_res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const start = this.__metricsStart || Date.now();
        const dur = Date.now() - start;
        const model = getModelName(this);
        // 🆕 NEW: Detect operation context for completion message
        let completionMessage;
        try {
            // For User.findOne during login, check if password field was queried
            if (op === 'findOne' && model === 'User' && _res) {
                const filter = (typeof this.getFilter === 'function' ? this.getFilter() : this._conditions) || {};
                // If querying by email (login scenario) and document found
                if (filter.email && _res) {
                    completionMessage = 'User found for authentication';
                }
            }
            // For successful saves
            if (op === 'save' && _res) {
                completionMessage = 'Document saved successfully';
            }
            // For updates
            if ((op === 'updateOne' || op === 'updateMany') && _res) {
                const count = _res.modifiedCount || 0;
                completionMessage = `Updated ${count} document(s)`;
            }
        }
        catch (_m) { }
        // 🆕 NEW: Capture query details (filter, sort, projection, limit, skip)
        let filterStr;
        let sortStr;
        let projectionStr;
        let limitVal;
        let skipVal;
        let callerLocation;
        try {
            // Capture caller location
            callerLocation = getCallerLocation();
            // Capture filter
            const filter = (typeof this.getFilter === 'function' ? this.getFilter() : this._conditions) || {};
            if (filter && Object.keys(filter).length > 0) {
                const masked = maskSensitiveData(filter);
                filterStr = JSON.stringify(masked);
            }
            // Capture sort
            const sort = ((_a = this.options) === null || _a === void 0 ? void 0 : _a.sort) || ((_b = this._mongooseOptions) === null || _b === void 0 ? void 0 : _b.sort);
            if (sort && Object.keys(sort).length > 0) {
                sortStr = JSON.stringify(sort);
            }
            // Capture projection
            const projection = this._fields || ((_d = (_c = this).projection) === null || _d === void 0 ? void 0 : _d.call(_c));
            if (projection && Object.keys(projection).length > 0) {
                projectionStr = JSON.stringify(projection);
            }
            // Capture limit
            const limit = ((_e = this.options) === null || _e === void 0 ? void 0 : _e.limit) || ((_f = this._mongooseOptions) === null || _f === void 0 ? void 0 : _f.limit);
            if (typeof limit === 'number' && limit > 0) {
                limitVal = limit;
            }
            // Capture skip
            const skip = ((_g = this.options) === null || _g === void 0 ? void 0 : _g.skip) || ((_h = this._mongooseOptions) === null || _h === void 0 ? void 0 : _h.skip);
            if (typeof skip === 'number' && skip > 0) {
                skipVal = skip;
            }
        }
        catch (_o) {
            // Silent failure for query details capture
        }
        // Capture aggregate pipeline summary when applicable
        let pipeline;
        if (op === 'aggregate' && typeof (this === null || this === void 0 ? void 0 : this.pipeline) === 'function') {
            try {
                const pl = this.pipeline();
                if (Array.isArray(pl))
                    pipeline = summarizePipeline(pl);
            }
            catch (_p) { }
        }
        // Derive nReturned for common ops from the result
        let nReturned;
        try {
            if (op === 'find' && Array.isArray(_res)) {
                nReturned = _res.length;
            }
            else if (op === 'findOne') {
                nReturned = _res ? 1 : 0;
            }
            else if (op === 'countDocuments' && typeof _res === 'number') {
                nReturned = _res;
            }
            else if (op === 'aggregate' && Array.isArray(_res)) {
                nReturned = _res.length;
            }
            else if (op === 'save') {
                nReturned = 1;
            }
        }
        catch (_q) { }
        // Try explain('executionStats') via native driver for accurate metrics
        let docsExamined;
        let indexUsed;
        let executionStage;
        try {
            const coll = (_j = this === null || this === void 0 ? void 0 : this.model) === null || _j === void 0 ? void 0 : _j.collection;
            const filter = (typeof this.getFilter === 'function' ? this.getFilter() : this._conditions) || {};
            let exp;
            if (coll) {
                if (op === 'find') {
                    exp = yield coll.find(filter).explain('executionStats');
                }
                else if (op === 'findOne') {
                    exp = yield coll.find(filter).limit(1).explain('executionStats');
                }
                else if (op === 'countDocuments') {
                    // For count, use a find explain to observe scan behavior
                    exp = yield coll.find(filter).explain('executionStats');
                }
                else if (op === 'aggregate' && typeof (this === null || this === void 0 ? void 0 : this.pipeline) === 'function') {
                    const pl = this.pipeline();
                    exp = yield coll.aggregate(pl).explain('executionStats');
                }
                else if (op === 'updateOne' || op === 'updateMany' || op === 'deleteOne' || op === 'deleteMany' || op === 'findOneAndUpdate') {
                    // Use find explain for write filters to infer index usage
                    exp = yield coll.find(filter).limit(op === 'updateMany' || op === 'deleteMany' ? 0 : 1).explain('executionStats');
                }
            }
            if (exp) {
                const stats = extractExplainStats(exp);
                docsExamined = stats.docsExamined;
                indexUsed = stats.indexUsed;
                executionStage = stats.executionStage;
                if (nReturned === undefined && typeof stats.nReturned === 'number') {
                    nReturned = stats.nReturned;
                }
            }
        }
        catch (_r) { }
        // 🆕 ENHANCED: Index suggestion with exact MongoDB command
        let suggestion;
        try {
            const conds = this._conditions || (typeof this.getFilter === 'function' ? this.getFilter() : undefined);
            const keys = conds && typeof conds === 'object' ? Object.keys(conds) : [];
            // Include sort fields in index suggestion
            const sort = ((_k = this.options) === null || _k === void 0 ? void 0 : _k.sort) || ((_l = this._mongooseOptions) === null || _l === void 0 ? void 0 : _l.sort);
            const sortKeys = sort && typeof sort === 'object' ? Object.keys(sort) : [];
            // Combine filter keys and sort keys for compound index
            const allKeys = Array.from(new Set([...keys, ...sortKeys])).filter(k => k !== '_id'); // Remove duplicates and skip '_id'
            const idxFields = allKeys.slice(0, 3).map(k => {
                // Use -1 for descending sort, 1 for ascending or filter fields
                const sortDir = sort && sort[k] === -1 ? -1 : 1;
                return `${k}: ${sortDir}`;
            }).join(', ');
            const efficiency = nReturned && docsExamined ? `${docsExamined}:${nReturned}` : undefined;
            if (!indexUsed || indexUsed === 'NO_INDEX' || (docsExamined && nReturned && docsExamined > nReturned * 50)) {
                if (idxFields && model) {
                    // Generate exact MongoDB command
                    const collectionName = model.toLowerCase() + 's'; // Pluralize (basic)
                    suggestion = `db.${collectionName}.createIndex({ ${idxFields} })`;
                }
            }
            // Attach attributes to OTel span
            if (this.__otelSpan) {
                try {
                    this.__otelSpan.setAttribute('db.model', model || 'unknown');
                    this.__otelSpan.setAttribute('db.operation', op);
                    if (pipeline)
                        this.__otelSpan.setAttribute('db.pipeline', pipeline);
                    if (typeof nReturned === 'number')
                        this.__otelSpan.setAttribute('db.n_returned', nReturned);
                    if (typeof docsExamined === 'number')
                        this.__otelSpan.setAttribute('db.docs_examined', docsExamined);
                    if (indexUsed)
                        this.__otelSpan.setAttribute('db.index_used', indexUsed);
                    if (executionStage)
                        this.__otelSpan.setAttribute('db.execution_stage', executionStage);
                    if (efficiency)
                        this.__otelSpan.setAttribute('db.scan_efficiency', efficiency);
                    if (suggestion)
                        this.__otelSpan.setAttribute('db.index_suggestion', suggestion);
                    // 🆕 NEW: Add completion message attribute
                    if (completionMessage) {
                        this.__otelSpan.setAttribute('db.completion_message', completionMessage);
                    }
                    this.__otelSpan.end();
                }
                catch (_s) { }
            }
        }
        catch (_t) { }
        // 🆕 NEW: Include enhanced query details in recordDbQuery
        (0, requestContext_1.recordDbQuery)(dur, {
            model,
            operation: op,
            cacheHit: false,
            pipeline,
            nReturned,
            docsExamined,
            indexUsed,
            executionStage,
            suggestion,
            filter: filterStr,
            sort: sortStr,
            projection: projectionStr,
            limit: limitVal,
            skip: skipVal,
            callerLocation,
        });
        next();
    });
};
// Create a compact, human-readable summary of an aggregation pipeline
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
// Extract docs examined, nReturned, index name, and execution stage from MongoDB explain output
function extractExplainStats(exp) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    if (!exp || typeof exp !== 'object')
        return {};
    const es = exp.executionStats || {};
    const qp = exp.queryPlanner || {};
    // Prefer top-level totals, but fall back to nested executionStages chain
    const deepDocs = (_g = (_d = (_b = (_a = es.executionStages) === null || _a === void 0 ? void 0 : _a.docsExamined) !== null && _b !== void 0 ? _b : (_c = es.executionStages) === null || _c === void 0 ? void 0 : _c.totalDocsExamined) !== null && _d !== void 0 ? _d : (_f = (_e = es.executionStages) === null || _e === void 0 ? void 0 : _e.inputStage) === null || _f === void 0 ? void 0 : _f.docsExamined) !== null && _g !== void 0 ? _g : (_k = (_j = (_h = es.executionStages) === null || _h === void 0 ? void 0 : _h.inputStage) === null || _j === void 0 ? void 0 : _j.inputStage) === null || _k === void 0 ? void 0 : _k.docsExamined;
    const totalDocsExamined = (_m = (_l = es.totalDocsExamined) !== null && _l !== void 0 ? _l : es.docsExamined) !== null && _m !== void 0 ? _m : deepDocs;
    const nReturned = es.nReturned;
    const winning = qp.winningPlan || {};
    const stage = winning.stage || ((_o = winning.inputStage) === null || _o === void 0 ? void 0 : _o.stage) || ((_q = (_p = winning.inputStage) === null || _p === void 0 ? void 0 : _p.inputStage) === null || _q === void 0 ? void 0 : _q.stage) || ((_r = es.executionStages) === null || _r === void 0 ? void 0 : _r.stage) || ((_t = (_s = es.executionStages) === null || _s === void 0 ? void 0 : _s.inputStage) === null || _t === void 0 ? void 0 : _t.stage);
    const input = winning.inputStage || {};
    const indexName = input.indexName || ((_u = input.inputStage) === null || _u === void 0 ? void 0 : _u.indexName) || winning.indexName || ((_v = es.executionStages) === null || _v === void 0 ? void 0 : _v.indexName) || ((_x = (_w = es.executionStages) === null || _w === void 0 ? void 0 : _w.inputStage) === null || _x === void 0 ? void 0 : _x.indexName);
    let executionStage = typeof stage === 'string' ? stage : undefined;
    let indexUsed = undefined;
    if (executionStage && executionStage.toUpperCase().includes('COLLSCAN')) {
        indexUsed = 'NO_INDEX';
        executionStage = 'COLLSCAN (Full Collection Scan)';
    }
    else if (executionStage && executionStage.toUpperCase().includes('IXSCAN')) {
        indexUsed = indexName ? String(indexName) : 'INDEX';
        executionStage = 'IXSCAN (Indexed Scan)';
    }
    else if (indexName) {
        indexUsed = String(indexName);
    }
    return {
        docsExamined: typeof totalDocsExamined === 'number' ? totalDocsExamined : undefined,
        nReturned: typeof nReturned === 'number' ? nReturned : undefined,
        indexUsed,
        executionStage,
    };
}
function registerMongooseMetricsPlugin() {
    const plugin = (schema) => {
        // Query operations
        schema.pre('find', preStart('find'));
        schema.post('find', postEnd('find'));
        schema.pre('findOne', preStart('findOne'));
        schema.post('findOne', postEnd('findOne'));
        schema.pre('countDocuments', preStart('countDocuments'));
        schema.post('countDocuments', postEnd('countDocuments'));
        schema.pre('estimatedDocumentCount', preStart('estimatedDocumentCount'));
        schema.post('estimatedDocumentCount', postEnd('estimatedDocumentCount'));
        schema.pre('findOneAndUpdate', preStart('findOneAndUpdate'));
        schema.post('findOneAndUpdate', postEnd('findOneAndUpdate'));
        schema.pre('updateOne', preStart('updateOne'));
        schema.post('updateOne', postEnd('updateOne'));
        schema.pre('updateMany', preStart('updateMany'));
        schema.post('updateMany', postEnd('updateMany'));
        schema.pre('deleteOne', preStart('deleteOne'));
        schema.post('deleteOne', postEnd('deleteOne'));
        schema.pre('deleteMany', preStart('deleteMany'));
        schema.post('deleteMany', postEnd('deleteMany'));
        // Error handlers for query ops (record even if failed)
        schema.post('updateOne', function (err, _res, next) {
            if (err) {
                const start = this.__metricsStart || Date.now();
                (0, requestContext_1.recordDbQuery)(Date.now() - start, { model: getModelName(this), operation: 'updateOne', cacheHit: false });
                if (this.__otelSpan) {
                    try {
                        this.__otelSpan.recordException(err);
                        this.__otelSpan.setStatus({ code: api_1.SpanStatusCode.ERROR, message: String((err === null || err === void 0 ? void 0 : err.message) || err) });
                        this.__otelSpan.end();
                    }
                    catch (_a) { }
                }
            }
            next(err);
        });
        schema.post('updateMany', function (err, _res, next) {
            if (err) {
                const start = this.__metricsStart || Date.now();
                (0, requestContext_1.recordDbQuery)(Date.now() - start, { model: getModelName(this), operation: 'updateMany', cacheHit: false });
                if (this.__otelSpan) {
                    try {
                        this.__otelSpan.recordException(err);
                        this.__otelSpan.setStatus({ code: api_1.SpanStatusCode.ERROR, message: String((err === null || err === void 0 ? void 0 : err.message) || err) });
                        this.__otelSpan.end();
                    }
                    catch (_a) { }
                }
            }
            next(err);
        });
        schema.post('findOneAndUpdate', function (err, _res, next) {
            if (err) {
                const start = this.__metricsStart || Date.now();
                (0, requestContext_1.recordDbQuery)(Date.now() - start, { model: getModelName(this), operation: 'findOneAndUpdate', cacheHit: false });
                if (this.__otelSpan) {
                    try {
                        this.__otelSpan.recordException(err);
                        this.__otelSpan.setStatus({ code: api_1.SpanStatusCode.ERROR, message: String((err === null || err === void 0 ? void 0 : err.message) || err) });
                        this.__otelSpan.end();
                    }
                    catch (_a) { }
                }
            }
            next(err);
        });
        schema.post('deleteOne', function (err, _res, next) {
            if (err) {
                const start = this.__metricsStart || Date.now();
                (0, requestContext_1.recordDbQuery)(Date.now() - start, { model: getModelName(this), operation: 'deleteOne', cacheHit: false });
                if (this.__otelSpan) {
                    try {
                        this.__otelSpan.recordException(err);
                        this.__otelSpan.setStatus({ code: api_1.SpanStatusCode.ERROR, message: String((err === null || err === void 0 ? void 0 : err.message) || err) });
                        this.__otelSpan.end();
                    }
                    catch (_a) { }
                }
            }
            next(err);
        });
        schema.post('deleteMany', function (err, _res, next) {
            if (err) {
                const start = this.__metricsStart || Date.now();
                (0, requestContext_1.recordDbQuery)(Date.now() - start, { model: getModelName(this), operation: 'deleteMany', cacheHit: false });
                if (this.__otelSpan) {
                    try {
                        this.__otelSpan.recordException(err);
                        this.__otelSpan.setStatus({ code: api_1.SpanStatusCode.ERROR, message: String((err === null || err === void 0 ? void 0 : err.message) || err) });
                        this.__otelSpan.end();
                    }
                    catch (_a) { }
                }
            }
            next(err);
        });
        // Aggregation
        schema.pre('aggregate', preStart('aggregate'));
        schema.post('aggregate', postEnd('aggregate'));
        schema.post('aggregate', function (err, _res, next) {
            if (err) {
                const start = this.__metricsStart || Date.now();
                let pipeline;
                try {
                    const pl = typeof (this === null || this === void 0 ? void 0 : this.pipeline) === 'function' ? this.pipeline() : undefined;
                    if (Array.isArray(pl))
                        pipeline = summarizePipeline(pl);
                }
                catch (_a) { }
                (0, requestContext_1.recordDbQuery)(Date.now() - start, { model: getModelName(this), operation: 'aggregate', cacheHit: false, pipeline });
            }
            next(err);
        });
        // Document operations (covers create/save)
        schema.pre('save', preStart('save'));
        schema.post('save', function (_doc, next) {
            const start = this.__metricsStart || Date.now();
            const dur = Date.now() - start;
            const model = getModelName(this);
            (0, requestContext_1.recordDbQuery)(dur, { model, operation: 'save', cacheHit: false });
            next();
        });
        schema.post('save', function (err, _doc, next) {
            if (err) {
                const start = this.__metricsStart || Date.now();
                (0, requestContext_1.recordDbQuery)(Date.now() - start, { model: getModelName(this), operation: 'save', cacheHit: false });
            }
            next(err);
        });
    };
    mongoose_1.default.plugin(plugin);
}
// Auto-register on import
registerMongooseMetricsPlugin();
