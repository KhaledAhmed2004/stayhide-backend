"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const colors_1 = __importDefault(require("colors"));
const crypto_1 = require("crypto");
const logger_1 = require("../../shared/logger");
const requestContext_1 = require("./requestContext");
const config_1 = __importDefault(require("../../config"));
const api_1 = require("@opentelemetry/api");
const opentelemetry_1 = require("./opentelemetry");
const performanceMetrics_1 = require("./performanceMetrics");
// 🧾 Status text
const statusText = (code) => {
    switch (code) {
        case 200:
            return 'OK';
        case 201:
            return 'Created';
        case 204:
            return 'No Content';
        case 400:
            return 'Bad Request';
        case 401:
            return 'Unauthorized';
        case 403:
            return 'Forbidden';
        case 404:
            return 'Not Found';
        case 429:
            return 'Too Many Requests';
        case 500:
            return 'Internal Server Error';
        default:
            return String(code);
    }
};
// 🌐 Client IP
const getClientIp = (req) => {
    var _a, _b;
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length)
        return xff.split(',')[0].trim();
    const ip = req.ip ||
        ((_a = req.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress) ||
        ((_b = req.connection) === null || _b === void 0 ? void 0 : _b.remoteAddress);
    return ip || 'unknown';
};
// 🔒 Mask sensitive
const SENSITIVE_KEYS = new Set([
    'password',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'client_secret',
    'secret',
    'api_key',
    'apiKey',
]);
const maskSensitive = (value) => {
    if (value === null || value === undefined)
        return value;
    if (Array.isArray(value))
        return value.map(maskSensitive);
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = SENSITIVE_KEYS.has(k) ? '********' : maskSensitive(v);
        }
        return out;
    }
    return value;
};
// 🧰 Normalize body
const normalizeBody = (req) => {
    const body = req.body;
    if (!body)
        return {};
    if (Buffer.isBuffer(body))
        return { raw: true, length: body.length };
    if (typeof body !== 'object')
        return { value: String(body) };
    return body;
};
// 🔠 Indent helper
const indentBlock = (text, spaces = 5) => {
    const pad = ' '.repeat(spaces);
    return text
        .split('\n')
        .map(line => pad + line)
        .join('\n');
};
// 🎨 Format MongoDB execution stage to human-readable format
const formatExecutionStage = (stage) => {
    if (!stage)
        return colors_1.default.dim('Unknown');
    const stageUpper = String(stage).toUpperCase();
    // Fast operations (bright green indicator)
    if (stageUpper.includes('IXSCAN')) {
        return `${colors_1.default.green.bold('🟢')} ${colors_1.default.green.bold('IXSCAN')} ${colors_1.default.yellow('(Index Scan - Fast)')}`;
    }
    if (stageUpper.includes('COUNT_SCAN')) {
        return `${colors_1.default.green.bold('🟢')} ${colors_1.default.green.bold('COUNT_SCAN')} ${colors_1.default.yellow('(Count via Index)')}`;
    }
    if (stageUpper.includes('TEXT')) {
        return `${colors_1.default.green.bold('🟢')} ${colors_1.default.green.bold('TEXT')} ${colors_1.default.yellow('(Text Index Search)')}`;
    }
    if (stageUpper.includes('GEO') || stageUpper.includes('2DSPHERE')) {
        return `${colors_1.default.green.bold('🟢')} ${colors_1.default.green.bold('GEO_NEAR')} ${colors_1.default.yellow('(Geo Index Scan)')}`;
    }
    // Moderate operations (bright yellow indicator)
    if (stageUpper.includes('FETCH')) {
        return `${colors_1.default.yellow.bold('🟡')} ${colors_1.default.yellow.bold('FETCH')} ${colors_1.default.yellow('(Index + Document Fetch)')}`;
    }
    // Slow operations (bright red indicator - needs attention!)
    if (stageUpper.includes('COLLSCAN')) {
        return `${colors_1.default.red.bold('🔴')} ${colors_1.default.red.bold('COLLSCAN')} ${colors_1.default.yellow('(Full Collection Scan - Slow!)')}`;
    }
    // Default - unknown stage
    return `${colors_1.default.cyan.bold('ℹ️')} ${colors_1.default.cyan.bold(stage)}`;
};
// 🗄️ Render a single query in multi-line format
const renderQueryMultiLine = (q, index) => {
    const lines = [];
    // Determine performance level for emoji
    const isSlow = ((q === null || q === void 0 ? void 0 : q.durationMs) || 0) >= 1000;
    const isModerate = ((q === null || q === void 0 ? void 0 : q.durationMs) || 0) >= 300 && ((q === null || q === void 0 ? void 0 : q.durationMs) || 0) < 1000;
    const isFast = ((q === null || q === void 0 ? void 0 : q.durationMs) || 0) < 300;
    const perfEmoji = isSlow ? '🐌' : isModerate ? '⚠️' : '⚡';
    const durColor = isSlow ? colors_1.default.red.bold : isModerate ? colors_1.default.yellow.bold : colors_1.default.green.bold;
    // Header: 1️⃣ User.findOne • 51ms ⚡
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const numberEmoji = index < numberEmojis.length ? numberEmojis[index] : `${index + 1}️⃣`;
    const model = colors_1.default.cyan.bold((q === null || q === void 0 ? void 0 : q.model) || 'Unknown');
    const operation = colors_1.default.white((q === null || q === void 0 ? void 0 : q.operation) || 'query');
    const duration = durColor(`${(q === null || q === void 0 ? void 0 : q.durationMs) || 0}ms`);
    lines.push(`   ${numberEmoji} ${model}.${operation} • ${duration} ${perfEmoji}`);
    // Line 1: Scanned & Returned & Efficiency
    const scanned = colors_1.default.white.bold(String((q === null || q === void 0 ? void 0 : q.docsExamined) || '?'));
    const returned = colors_1.default.white.bold(String((q === null || q === void 0 ? void 0 : q.nReturned) !== undefined ? q.nReturned : '?'));
    // Calculate efficiency
    let efficiencyDisplay = colors_1.default.dim('n/a');
    if ((q === null || q === void 0 ? void 0 : q.docsExamined) && (q === null || q === void 0 ? void 0 : q.nReturned) !== undefined) {
        const pct = (q.nReturned / q.docsExamined) * 100;
        const pctStr = pct < 1 ? pct.toFixed(3) : pct.toFixed(2);
        if (pct >= 50) {
            efficiencyDisplay = `${colors_1.default.green.bold(pctStr + '%')} ${colors_1.default.green.bold('🟢')}`;
        }
        else if (pct >= 10) {
            efficiencyDisplay = `${colors_1.default.yellow.bold(pctStr + '%')} ${colors_1.default.yellow.bold('🟡')}`;
        }
        else {
            efficiencyDisplay = `${colors_1.default.red.bold(pctStr + '%')} ${colors_1.default.red.bold('🔴')}`;
        }
    }
    lines.push(`      ├─ ${colors_1.default.cyan('Scanned:')} ${scanned} • ${colors_1.default.cyan('Returned:')} ${returned} • ${colors_1.default.cyan('Efficiency:')} ${efficiencyDisplay}`);
    // Line 2: Index
    const indexUsed = q === null || q === void 0 ? void 0 : q.indexUsed;
    let indexDisplay;
    if (!indexUsed || indexUsed === 'NO_INDEX') {
        indexDisplay = `${colors_1.default.red.bold('❌')} ${colors_1.default.red.bold('NO_INDEX')}`;
    }
    else {
        indexDisplay = `${colors_1.default.green.bold('✅')} ${colors_1.default.green.bold(indexUsed)}`;
    }
    lines.push(`      ├─ ${colors_1.default.cyan('Index:')} ${indexDisplay}`);
    // Line 3: Execution Stage
    const executionStage = formatExecutionStage(q === null || q === void 0 ? void 0 : q.executionStage);
    lines.push(`      ├─ ${colors_1.default.cyan('Execution:')} ${executionStage}`);
    // Line 4: Cache
    const cacheHit = q === null || q === void 0 ? void 0 : q.cacheHit;
    const cacheDisplay = cacheHit
        ? `${colors_1.default.green.bold('✅')} ${colors_1.default.green.bold('Yes')}`
        : `${colors_1.default.dim('❌')} ${colors_1.default.dim('No')}`;
    lines.push(`      ├─ ${colors_1.default.cyan('Cache:')} ${cacheDisplay}`);
    // Line 5 (conditional): Pipeline (only for aggregate operations)
    const operationName = String((q === null || q === void 0 ? void 0 : q.operation) || '').toLowerCase();
    const isAgg = operationName === 'aggregate';
    if (isAgg && (q === null || q === void 0 ? void 0 : q.pipeline)) {
        const pipelineStr = colors_1.default.magenta.bold(q.pipeline);
        lines.push(`      ├─ ${colors_1.default.cyan('Pipeline:')} ${pipelineStr}`);
    }
    // 🆕 NEW: Enhanced query details (filter, sort, projection, limit, skip, caller)
    // Filter
    if (q === null || q === void 0 ? void 0 : q.filter) {
        try {
            const filterObj = JSON.parse(q.filter);
            const filterDisplay = colors_1.default.yellow(JSON.stringify(filterObj));
            lines.push(`      ├─ ${colors_1.default.cyan('Filter:')} ${filterDisplay}`);
        }
        catch (_a) {
            lines.push(`      ├─ ${colors_1.default.cyan('Filter:')} ${colors_1.default.yellow(q.filter)}`);
        }
    }
    // Sort
    if (q === null || q === void 0 ? void 0 : q.sort) {
        try {
            const sortObj = JSON.parse(q.sort);
            const sortDisplay = colors_1.default.yellow(JSON.stringify(sortObj));
            lines.push(`      ├─ ${colors_1.default.cyan('Sort:')} ${sortDisplay}`);
        }
        catch (_b) {
            lines.push(`      ├─ ${colors_1.default.cyan('Sort:')} ${colors_1.default.yellow(q.sort)}`);
        }
    }
    // Projection
    if (q === null || q === void 0 ? void 0 : q.projection) {
        try {
            const projObj = JSON.parse(q.projection);
            const projDisplay = colors_1.default.yellow(JSON.stringify(projObj));
            lines.push(`      ├─ ${colors_1.default.cyan('Projection:')} ${projDisplay}`);
        }
        catch (_c) {
            lines.push(`      ├─ ${colors_1.default.cyan('Projection:')} ${colors_1.default.yellow(q.projection)}`);
        }
    }
    // Limit & Skip
    if ((q === null || q === void 0 ? void 0 : q.limit) !== undefined || (q === null || q === void 0 ? void 0 : q.skip) !== undefined) {
        const limitDisplay = (q === null || q === void 0 ? void 0 : q.limit) !== undefined ? colors_1.default.white.bold(String(q.limit)) : colors_1.default.dim('none');
        const skipDisplay = (q === null || q === void 0 ? void 0 : q.skip) !== undefined ? colors_1.default.white.bold(String(q.skip)) : colors_1.default.dim('0');
        lines.push(`      ├─ ${colors_1.default.cyan('Limit:')} ${limitDisplay} • ${colors_1.default.cyan('Skip:')} ${skipDisplay}`);
    }
    // Caller Location
    if (q === null || q === void 0 ? void 0 : q.callerLocation) {
        const locationDisplay = colors_1.default.green.bold(q.callerLocation);
        lines.push(`      ├─ ${colors_1.default.cyan('Called from:')} ${locationDisplay}`);
    }
    // Last line: Suggestion
    const suggestion = q === null || q === void 0 ? void 0 : q.suggestion;
    if (suggestion && suggestion !== 'n/a') {
        const suggestionDisplay = `${colors_1.default.magenta.bold('💡')} ${colors_1.default.magenta.bold(suggestion)}`;
        lines.push(`      └─ ${colors_1.default.cyan('Suggestion:')} ${suggestionDisplay}`);
    }
    else {
        // Post-process the last pushed line in the tree to terminate with '└─' instead of '├─'
        if (lines.length > 1) {
            const lastIdx = lines.length - 1;
            if (lines[lastIdx].includes('      ├─ ')) {
                lines[lastIdx] = lines[lastIdx].replace('      ├─ ', '      └─ ');
            }
        }
    }
    return lines;
};
// 📏 File size converter
const humanFileSize = (size) => {
    if (size < 1024)
        return size + ' B';
    const i = Math.floor(Math.log(size) / Math.log(1024));
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    return (size / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
};
// 📝 Extract files
const extractFilesInfo = (req) => {
    const formatFile = (file) => ({
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: humanFileSize(file.size),
    });
    if (req.file)
        return formatFile(req.file);
    if (req.files) {
        // Handle both array format (from .any()) and object format (from .fields())
        if (Array.isArray(req.files)) {
            // Group files by fieldname when using .any()
            const grouped = {};
            for (const file of req.files) {
                const fieldName = file.fieldname;
                if (!grouped[fieldName]) {
                    grouped[fieldName] = [];
                }
                grouped[fieldName].push(formatFile(file));
            }
            // Convert single-item arrays to single objects for cleaner output
            const out = {};
            for (const [fieldName, files] of Object.entries(grouped)) {
                out[fieldName] = files.length === 1 ? files[0] : files;
            }
            return out;
        }
        else {
            // Handle object format (from .fields())
            const out = {};
            for (const [key, value] of Object.entries(req.files)) {
                if (Array.isArray(value))
                    out[key] = value.map(formatFile);
                else
                    out[key] = formatFile(value);
            }
            return out;
        }
    }
    return undefined;
};
// 🧭 Detect Stripe webhook requests
const WEBHOOK_PATH = '/api/v1/payments/webhook';
const isStripeWebhook = (req) => {
    var _a;
    const pathMatch = (_a = req.originalUrl) === null || _a === void 0 ? void 0 : _a.includes(WEBHOOK_PATH);
    const sigPresent = Boolean(req.headers['stripe-signature']);
    const ua = String(req.headers['user-agent'] || '');
    const uaStripe = ua.startsWith('Stripe/');
    return Boolean(pathMatch || sigPresent || uaStripe);
};
// 🧾 Build minimal webhook context for global logs (no secrets)
const getWebhookLogContext = (req) => {
    const contentType = String(req.headers['content-type'] || '');
    const ua = String(req.headers['user-agent'] || '');
    const sigHeader = req.headers['stripe-signature'];
    const body = req.body;
    const rawLength = Buffer.isBuffer(body)
        ? body.length
        : typeof body === 'string'
            ? Buffer.byteLength(body)
            : undefined;
    return {
        timestamp: new Date().toISOString(),
        headers: {
            'stripe-signature': sigHeader ? 'Present' : 'Missing',
            'content-type': contentType,
            'user-agent': ua,
        },
        bodySize: rawLength,
    };
};
// 🧪 Safely parse Stripe event from raw body without mutating req.body
const parseStripeEventSafe = (req) => {
    const body = req.body;
    try {
        if (Buffer.isBuffer(body))
            return JSON.parse(body.toString('utf8'));
        if (typeof body === 'string')
            return JSON.parse(body);
        if (body && typeof body === 'object')
            return body;
    }
    catch (_a) {
        return undefined;
    }
    return undefined;
};
const getEventSummary = (evt) => ({
    type: evt === null || evt === void 0 ? void 0 : evt.type,
    id: evt === null || evt === void 0 ? void 0 : evt.id,
    created: typeof (evt === null || evt === void 0 ? void 0 : evt.created) === 'number'
        ? new Date(evt.created * 1000).toISOString()
        : evt === null || evt === void 0 ? void 0 : evt.created,
    livemode: Boolean(evt === null || evt === void 0 ? void 0 : evt.livemode),
});
const getPaymentIntentLogDetails = (evt) => {
    var _a;
    const obj = ((_a = evt === null || evt === void 0 ? void 0 : evt.data) === null || _a === void 0 ? void 0 : _a.object) || {};
    const metadata = (obj === null || obj === void 0 ? void 0 : obj.metadata) && typeof obj.metadata === 'object' ? obj.metadata : undefined;
    return {
        paymentIntentId: obj === null || obj === void 0 ? void 0 : obj.id,
        amount: obj === null || obj === void 0 ? void 0 : obj.amount,
        amount_capturable: obj === null || obj === void 0 ? void 0 : obj.amount_capturable,
        currency: obj === null || obj === void 0 ? void 0 : obj.currency,
        status: obj === null || obj === void 0 ? void 0 : obj.status,
        metadata,
    };
};
// 🎛️ Try to derive an Express handler/controller label
const deriveHandlerLabel = (req, res) => {
    var _a;
    const fromLocals = (_a = res.locals) === null || _a === void 0 ? void 0 : _a.handlerName;
    if (fromLocals && typeof fromLocals === 'string')
        return fromLocals;
    // Attempt to infer from Express route stack
    const route = req.route;
    if ((route === null || route === void 0 ? void 0 : route.stack) && Array.isArray(route.stack)) {
        const names = route.stack
            .map((layer) => (layer && layer.handle && layer.handle.name) || '')
            .filter((n) => Boolean(n));
        if (names.length)
            return names[names.length - 1];
    }
    // Fallback to route path if available
    if (route === null || route === void 0 ? void 0 : route.path)
        return `${req.method} ${route.path}`;
    return undefined;
};
// 🧾 Main Logger
const requestLogger = (req, res, next) => {
    var _a, _b;
    // 🛑 Skip all logging when explicitly disabled in .env
    if (config_1.default.disable_logs) {
        return next();
    }
    const start = Date.now();
    const requestId = (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']) || (0, crypto_1.randomUUID)();
    res.setHeader('X-Request-Id', requestId);
    res.locals.requestId = requestId;
    // Intercept response methods to capture response payload
    const originalJson = res.json;
    res.json = function (body) {
        try {
            res.locals.responsePayload = body;
        }
        catch (_a) { }
        return originalJson.call(this, body);
    };
    const originalSend = res.send;
    res.send = function (body) {
        try {
            if (typeof body === 'string' && (body.trim().startsWith('{') || body.trim().startsWith('['))) {
                res.locals.responsePayload = JSON.parse(body);
            }
            else if (body && typeof body === 'object') {
                res.locals.responsePayload = body;
            }
        }
        catch (_a) { }
        return originalSend.call(this, body);
    };
    // Capture route params dynamically as they are matched by Express routers
    const capturedParams = {};
    const proxyHandler = {
        get(target, prop) {
            return capturedParams[prop];
        },
        set(target, prop, value) {
            capturedParams[prop] = value;
            return true;
        },
    };
    const proxy = new Proxy({}, proxyHandler);
    Object.defineProperty(req, 'params', {
        get() {
            return proxy;
        },
        set(val) {
            if (val && typeof val === 'object') {
                if (Object.keys(val).length > 0) {
                    Object.assign(capturedParams, val);
                }
            }
        },
        configurable: true,
        enumerable: true,
    });
    // 🆕 NEW: Capture performance baseline (memory, CPU)
    try {
        if ((_b = (_a = config_1.default.tracing) === null || _a === void 0 ? void 0 : _a.performance) === null || _b === void 0 ? void 0 : _b.enabled) {
            if (config_1.default.tracing.performance.captureMemory) {
                (0, requestContext_1.recordMemoryStart)((0, performanceMetrics_1.captureMemorySnapshot)());
            }
            if (config_1.default.tracing.performance.captureCPU) {
                (0, requestContext_1.recordCPUStart)((0, performanceMetrics_1.captureCPUUsage)());
            }
        }
    }
    catch (_c) {
        // Silent failure - won't affect request
    }
    res.on('finish', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
        const ms = Date.now() - start;
        let processedMs = ms;
        try {
            const span = api_1.trace.getSpan(api_1.context.active());
            const tid = span === null || span === void 0 ? void 0 : span.spanContext().traceId;
            const total = tid ? (0, opentelemetry_1.getTimelineTotal)(tid) : undefined;
            if (typeof total === 'number' && total > 0)
                processedMs = total;
        }
        catch (_0) { }
        const status = res.statusCode;
        const statusMsg = statusText(status);
        // Silence console logs for observability endpoints to avoid terminal spam
        const isObservabilityRoute = Boolean((_a = req.originalUrl) === null || _a === void 0 ? void 0 : _a.includes('/api/v1/observability'));
        const details = {
            params: capturedParams,
            query: req.query || {},
            body: normalizeBody(req),
            files: extractFilesInfo(req),
        };
        const maskedDetails = maskSensitive(details);
        // 🎨 Method color
        const methodColor = (() => {
            switch (req.method) {
                case 'GET':
                    return colors_1.default.bgGreen.black.bold(` ${req.method} `);
                case 'POST':
                    return colors_1.default.bgBlue.white.bold(` ${req.method} `);
                case 'PUT':
                    return colors_1.default.bgYellow.black.bold(` ${req.method} `);
                case 'PATCH':
                    return colors_1.default.bgMagenta.white.bold(` ${req.method} `);
                case 'DELETE':
                    return colors_1.default.bgRed.white.bold(` ${req.method} `);
                default:
                    return colors_1.default.bgWhite.black.bold(` ${req.method} `);
            }
        })();
        const routeColor = colors_1.default.cyan.bold(req.originalUrl);
        const ipColor = colors_1.default.blue.bold(` ${getClientIp(req)} `);
        // 🎨 Status color
        const statusColor = (() => {
            if (status >= 500)
                return colors_1.default.bgRed.white.bold;
            if (status >= 400)
                return colors_1.default.bgRed.white.bold;
            if (status >= 300)
                return colors_1.default.bgYellow.black.bold;
            return colors_1.default.bgGreen.black.bold;
        })();
        // 🎨 Message text color only background
        const messageBg = (() => {
            if (status >= 500)
                return colors_1.default.bgRed.white;
            if (status >= 400)
                return colors_1.default.bgRed.white;
            if (status >= 300)
                return colors_1.default.bgYellow.black;
            return colors_1.default.bgGreen.black;
        })();
        const responsePayload = res.locals.responsePayload || {};
        const responseMessage = responsePayload.message || '';
        const responseErrors = responsePayload.errorMessages;
        // 🧑‍💻 Auth context (if available)
        const authCtx = (() => {
            const u = req.user;
            if (!u)
                return undefined;
            return {
                id: u.userId || u.id || u._id,
                email: u.email,
                role: u.role,
            };
        })();
        // 🛰️ Client context
        const ua = String(req.headers['user-agent'] || '');
        const referer = String(req.headers['referer'] || req.headers['referrer'] || '');
        const contentType = String(req.headers['content-type'] || '');
        const handlerLabel = deriveHandlerLabel(req, res);
        // Read dynamic labels from AsyncLocalStorage (if any)
        const ctxLabels = (0, requestContext_1.getLabels)();
        let controllerLabel = ((_b = res.locals) === null || _b === void 0 ? void 0 : _b.controllerLabel) || ctxLabels.controllerLabel || ((_c = res.locals) === null || _c === void 0 ? void 0 : _c.handlerName);
        const serviceLabel = ((_d = res.locals) === null || _d === void 0 ? void 0 : _d.serviceLabel) || ctxLabels.serviceLabel || ((_e = res.locals) === null || _e === void 0 ? void 0 : _e.serviceName);
        // If controller label is missing, derive from base path + handler
        if (!controllerLabel) {
            const baseCtrl = (0, requestContext_1.controllerNameFromBasePath)(req.baseUrl);
            if (baseCtrl && handlerLabel) {
                controllerLabel = `${baseCtrl}.${handlerLabel}`;
            }
            else if (baseCtrl) {
                controllerLabel = baseCtrl;
            }
        }
        const lines = [];
        lines.push(colors_1.default.blue.bold(`🧩 Req-ID: ${requestId}`));
        const statusTextColored = status >= 400 ? colors_1.default.red.bold(String(status)) : colors_1.default.green.bold(String(status));
        const methodColored = req.method === 'GET' ? colors_1.default.green.bold(req.method) : req.method === 'POST' ? colors_1.default.blue.bold(req.method) : req.method === 'PUT' ? colors_1.default.yellow.bold(req.method) : req.method === 'DELETE' ? colors_1.default.red.bold(req.method) : colors_1.default.cyan.bold(req.method);
        const morganStyleLine = `${methodColored} ${colors_1.default.white(req.originalUrl)} ${statusTextColored} - ${colors_1.default.white(`${processedMs.toFixed(3)} ms`)}`;
        lines.push(colors_1.default.blue(`     📝 Summary: ${morganStyleLine}`));
        lines.push(`📥 Request: ${methodColor} ${routeColor} from IP:${ipColor}`);
        lines.push(colors_1.default.blue(`     🛰️ Client: ua="${ua}" referer="${referer || 'n/a'}" ct="${contentType || 'n/a'}"`));
        // Enriched device/OS/browser info (if available)
        const info = (_f = res.locals) === null || _f === void 0 ? void 0 : _f.clientInfo;
        if (info) {
            const osLabel = info.osFriendly || info.os;
            const osRaw = info.osVersion ? ` (${info.osVersion})` : '';
            const model = info.deviceModel ? `, Model: ${info.deviceModel}` : '';
            const arch = info.arch ? `, Arch: ${info.arch}` : '';
            const bits = info.bitness ? `, ${info.bitness}-bit` : '';
            const br = info.browser ? `, Browser: ${info.browser}${info.browserVersion ? ' ' + info.browserVersion : ''}` : '';
        }
        // 🌐 CORS details
        if (req.corsStatus) {
            const corsAllowed = req.corsAllowed;
            const corsColor = corsAllowed ? colors_1.default.green.bold : colors_1.default.red.bold;
            const statusColor = corsAllowed ? colors_1.default.green : colors_1.default.red;
            lines.push(colors_1.default.blue(`     🌐 CORS: ${corsColor(corsAllowed ? '✅' : '❌')} ${statusColor(req.corsStatus)}`));
        }
        if (controllerLabel || serviceLabel) {
            const parts = [];
            if (controllerLabel)
                parts.push(`controller: ${controllerLabel}`);
            if (serviceLabel)
                parts.push(`service: ${serviceLabel}`);
            lines.push(colors_1.default.blue(`     🎛️ Handler: ${parts.join(' ')}`));
        }
        else if (handlerLabel) {
            lines.push(colors_1.default.blue(`     🎛️ Handler: ${handlerLabel}`));
        }
        if (authCtx) {
            lines.push(colors_1.default.gray(`     👤 Auth: id="${authCtx.id || 'n/a'}" email="${authCtx.email || 'n/a'}" role="${authCtx.role || 'n/a'}"`));
        }
        // 🔔 Stripe webhook request context (global)
        if (isStripeWebhook(req)) {
            lines.push(colors_1.default.yellow('     🔔 Stripe webhook request context:'));
            lines.push(colors_1.default.white(indentBlock(JSON.stringify(getWebhookLogContext(req), null, 2))));
            // ✅ Signature verification status from controller
            const sigVerified = (_g = res.locals) === null || _g === void 0 ? void 0 : _g.webhookSignatureVerified;
            const sigError = (_h = res.locals) === null || _h === void 0 ? void 0 : _h.webhookSignatureError;
            if (sigVerified === true) {
                lines.push(colors_1.default.green('     ✅ Webhook signature verified successfully'));
            }
            else if (sigVerified === false) {
                lines.push(colors_1.default.red(`     ❌ Webhook signature verification failed: ${sigError || 'unknown error'}`));
            }
            // 🔐 Masked webhook secret preview
            const secretPreview = ((_j = res.locals) === null || _j === void 0 ? void 0 : _j.webhookSecretPreview) || (process.env.STRIPE_WEBHOOK_SECRET ? String(process.env.STRIPE_WEBHOOK_SECRET).substring(0, 10) + '...' : undefined);
            if (secretPreview) {
                lines.push(colors_1.default.blue(`     🔐 Webhook secret configured: ${secretPreview}`));
            }
            const evt = parseStripeEventSafe(req);
            if (evt && evt.object === 'event' && evt.type) {
                lines.push(colors_1.default.yellow('     📨 Received webhook event:'));
                lines.push(colors_1.default.white(indentBlock(JSON.stringify(getEventSummary(evt), null, 2))));
                const type = evt.type;
                if (type === 'payment_intent.amount_capturable_updated') {
                    lines.push(colors_1.default.yellow('     💳 Amount capturable updated:'));
                    lines.push(colors_1.default.white(indentBlock(JSON.stringify(getPaymentIntentLogDetails(evt), null, 2))));
                }
                else if (type === 'payment_intent.succeeded') {
                    lines.push(colors_1.default.yellow('     💰 Processing payment succeeded:'));
                    lines.push(colors_1.default.white(indentBlock(JSON.stringify(getPaymentIntentLogDetails(evt), null, 2))));
                }
                else if (type === 'payment_intent.payment_failed') {
                    lines.push(colors_1.default.yellow('     ❌ Payment failed details:'));
                    lines.push(colors_1.default.white(indentBlock(JSON.stringify(getPaymentIntentLogDetails(evt), null, 2))));
                }
            }
        }
        if (config_1.default.node_env === 'development' || config_1.default.node_env === 'test') {
            lines.push(colors_1.default.yellow('     🔎 Request details:'));
            lines.push(colors_1.default.white(indentBlock(JSON.stringify(maskedDetails, null, 2))));
        }
        const respLabel = status >= 400 ? '❌ Response sent:' : '📤 Response sent:';
        const respSizeHeader = res.getHeader('Content-Length');
        const respSize = typeof respSizeHeader === 'string' ? respSizeHeader : Array.isArray(respSizeHeader) ? respSizeHeader[0] : respSizeHeader;
        lines.push(`${respLabel} ${statusColor(` ${status} ${statusMsg} `)} ${colors_1.default.blue(respSize ? `(size: ${respSize} bytes)` : '')}`);
        const errorHandledBy = (_k = res.locals) === null || _k === void 0 ? void 0 : _k.errorHandledBy;
        if (errorHandledBy) {
            lines.push(colors_1.default.red(`     💥 Error Handler: ${errorHandledBy}`));
        }
        // 💬 Message with bg only on message text
        if (responseMessage) {
            lines.push(`💬 Message: ${messageBg(` ${responseMessage} `)}`);
        }
        if (config_1.default.node_env === 'development' || config_1.default.node_env === 'test') {
            if (responsePayload && Object.keys(responsePayload).length > 0) {
                const stringified = JSON.stringify(maskSensitive(responsePayload), null, 2);
                if (stringified.length > 5000) {
                    lines.push(colors_1.default.yellow('     📥 Response Payload:'));
                    lines.push(colors_1.default.gray(`     [Payload size ${stringified.length} chars exceeds display limit; truncated]`));
                    lines.push(colors_1.default.white(indentBlock(stringified.substring(0, 1000) + '\n...')));
                }
                else {
                    lines.push(colors_1.default.yellow('     📥 Response Payload:'));
                    lines.push(colors_1.default.white(indentBlock(stringified)));
                }
            }
        }
        // 🆕 NEW: Capture performance end state (memory, CPU)
        try {
            if ((_m = (_l = config_1.default.tracing) === null || _l === void 0 ? void 0 : _l.performance) === null || _m === void 0 ? void 0 : _m.enabled) {
                if (config_1.default.tracing.performance.captureMemory) {
                    (0, requestContext_1.recordMemoryEnd)((0, performanceMetrics_1.captureMemorySnapshot)());
                }
                if (config_1.default.tracing.performance.captureCPU) {
                    (0, requestContext_1.recordCPUEnd)((0, performanceMetrics_1.captureCPUUsage)());
                }
            }
        }
        catch (_1) {
            // Silent failure
        }
        // 📊 Metrics block (DB, Cache, External) with detailed DB categories
        try {
            const m = (0, requestContext_1.getMetrics)();
            if (m) {
                const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
                const max = (arr) => (arr.length ? Math.max(...arr) : 0);
                const dbHits = m.db.hits;
                const dbAvg = avg(m.db.durations);
                const dbSlow = max(m.db.durations);
                // Build detailed DB metrics output
                lines.push(' ----------------------------------------------------');
                lines.push(colors_1.default.bold(' 🧮 DB Metrics'));
                lines.push(colors_1.default.magenta(`    • Hits            : ${dbHits}${dbHits > 0 ? ' ✅' : ''}`));
                lines.push(colors_1.default.magenta(`    • Avg Query Time  : ${dbAvg}ms ⏱️`));
                lines.push(colors_1.default.magenta(`    • Slowest Query   : ${dbSlow}ms ${dbSlow >= 1000 ? '🐌' : dbSlow >= 300 ? '⏱️' : '⚡'}`));
                const queries = m.db.queries || [];
                const byCat = {
                    fast: queries.filter((q) => (q === null || q === void 0 ? void 0 : q.durationMs) < 300),
                    moderate: queries.filter((q) => (q === null || q === void 0 ? void 0 : q.durationMs) >= 300 && (q === null || q === void 0 ? void 0 : q.durationMs) < 1000),
                    slow: queries.filter((q) => (q === null || q === void 0 ? void 0 : q.durationMs) >= 1000),
                };
                const fmtDocs = (val) => {
                    if (val === null || val === undefined)
                        return 'n/a';
                    if (typeof val === 'string')
                        return val;
                    if (typeof val !== 'number')
                        return 'n/a';
                    const n = val;
                    if (n >= 1000000)
                        return `${(n / 1000000).toFixed(1)}M 😱`;
                    if (n >= 1000)
                        return `${(n / 1000).toFixed(1)}K`;
                    return String(n);
                };
                const fmtIndex = (val) => {
                    if (!val)
                        return 'n/a';
                    const s = String(val).toUpperCase();
                    if (s === 'NO_INDEX')
                        return '❌ NO_INDEX';
                    if (s === 'INDEX')
                        return '✅ INDEX';
                    return `✅ ${String(val)}`;
                };
                const deriveSuggestion = (q) => {
                    const slow = (q === null || q === void 0 ? void 0 : q.durationMs) >= 1000;
                    const noIdx = String((q === null || q === void 0 ? void 0 : q.indexUsed) || '').toUpperCase() === 'NO_INDEX';
                    const isAgg = String(q === null || q === void 0 ? void 0 : q.operation).toLowerCase() === 'aggregate';
                    if (!slow && !noIdx)
                        return 'n/a';
                    if (isAgg && typeof (q === null || q === void 0 ? void 0 : q.pipeline) === 'string') {
                        const m = /\$match\(([^=]+)=/.exec(q.pipeline);
                        if (m && m[1]) {
                            if (m[1] === '_id')
                                return 'n/a';
                            return `createIndex({ ${m[1]}: 1 })`;
                        }
                    }
                    return 'add indexes on frequent filter fields';
                };
                const deriveScanEfficiency = (q) => {
                    const docsExamined = typeof (q === null || q === void 0 ? void 0 : q.docsExamined) === 'number' ? q.docsExamined : undefined;
                    const nReturned = typeof (q === null || q === void 0 ? void 0 : q.nReturned) === 'number' ? q.nReturned : undefined;
                    if (!docsExamined || docsExamined <= 0 || !nReturned || nReturned < 0)
                        return 'n/a';
                    const pct = (nReturned / docsExamined) * 100;
                    const pctStr = pct < 0.01 ? pct.toFixed(3) : pct < 1 ? pct.toFixed(3) : pct.toFixed(2);
                    const label = pct >= 50 ? '🟢 (Excellent)' : pct >= 10 ? '⚡ (Good)' : '⚠️ (Poor)';
                    return `${pctStr}% ${label}`;
                };
                const renderQueryLine = (q) => {
                    const isAgg = String(q === null || q === void 0 ? void 0 : q.operation).toLowerCase() === 'aggregate';
                    const pipelineStr = isAgg ? (q === null || q === void 0 ? void 0 : q.pipeline) || 'n/a' : 'n/a';
                    const suggestion = deriveSuggestion(q);
                    const nReturnedStr = typeof (q === null || q === void 0 ? void 0 : q.nReturned) === 'number' ? String(q.nReturned) : 'n/a';
                    const scanEff = deriveScanEfficiency(q);
                    const execStage = (q === null || q === void 0 ? void 0 : q.executionStage) || 'n/a';
                    return colors_1.default.gray(` - Model: ${q.model || 'n/a'} | Operation: ${q.operation || 'n/a'} | Duration: ${q.durationMs}ms | Docs Examined: ${fmtDocs(q.docsExamined)} | Index Used: ${fmtIndex(q.indexUsed)} | Pipeline: ${pipelineStr} | Cache Hit: ${q.cacheHit ? '✅' : '❌'} | Suggestion: ${suggestion} | nReturned: ${nReturnedStr} | Scan Efficiency: ${scanEff} | Execution Stage: ${execStage}`);
                };
                lines.push(colors_1.default.green.bold(`⚡ FAST QUERIES (< 300ms) — ${byCat.fast.length} found`));
                lines.push('');
                if (!byCat.fast.length) {
                    lines.push(colors_1.default.dim('   └─ None'));
                }
                else {
                    byCat.fast.forEach((q, index) => {
                        const queryLines = renderQueryMultiLine(q, index);
                        lines.push(...queryLines);
                        // Add blank line between queries (except after last one)
                        if (index < byCat.fast.length - 1) {
                            lines.push('');
                        }
                    });
                }
                lines.push('');
                lines.push(colors_1.default.yellow.bold(`⏱️  MODERATE QUERIES (300-999ms) — ${byCat.moderate.length} found`));
                if (!byCat.moderate.length) {
                    lines.push(colors_1.default.dim('   └─ None'));
                }
                else {
                    lines.push('');
                    byCat.moderate.forEach((q, index) => {
                        const queryLines = renderQueryMultiLine(q, index);
                        lines.push(...queryLines);
                        if (index < byCat.moderate.length - 1) {
                            lines.push('');
                        }
                    });
                }
                lines.push('');
                lines.push(colors_1.default.red.bold(`🐌 SLOW QUERIES (≥ 1000ms) — ${byCat.slow.length} found`));
                if (!byCat.slow.length) {
                    lines.push(colors_1.default.dim('   └─ None ✨'));
                }
                else {
                    lines.push('');
                    byCat.slow.forEach((q, index) => {
                        const queryLines = renderQueryMultiLine(q, index);
                        lines.push(...queryLines);
                        if (index < byCat.slow.length - 1) {
                            lines.push('');
                        }
                    });
                }
                const cacheHits = m.cache.hits;
                const cacheMisses = m.cache.misses;
                const cacheTotal = cacheHits + cacheMisses;
                const cacheHitRatio = cacheTotal ? Math.round((cacheHits / cacheTotal) * 100) : 0;
                const extCount = m.external.count;
                const extAvg = avg(m.external.durations);
                const extSlow = max(m.external.durations);
                // Derive total request cost
                let cost = 'LOW';
                if (dbHits >= 8 || dbAvg >= 120 || dbSlow >= 350 || extAvg >= 400 || extSlow >= 500)
                    cost = 'HIGH';
                else if (dbHits >= 4 || extCount >= 1)
                    cost = 'MEDIUM';
                lines.push(colors_1.default.bold(' 🗄️ Cache Metrics'));
                lines.push(colors_1.default.magenta(`    • Hits            : ${cacheHits}`));
                lines.push(colors_1.default.magenta(`    • Misses          : ${cacheMisses}`));
                lines.push(colors_1.default.magenta(`    • Hit Ratio       : ${cacheHitRatio}%`));
                lines.push(colors_1.default.bold(' 🌐 External API Calls'));
                lines.push(colors_1.default.magenta(`    • Count           : ${extCount}`));
                lines.push(colors_1.default.magenta(`    • Avg Response    : ${extAvg}ms`));
                lines.push(colors_1.default.magenta(`    • Slowest Call    : ${extSlow}ms`));
                const costColor = cost === 'HIGH' ? colors_1.default.bgRed.white.bold : cost === 'MEDIUM' ? colors_1.default.bgYellow.black.bold : colors_1.default.bgGreen.black.bold;
                lines.push(' ----------------------------------------------------');
                lines.push(`${colors_1.default.bold(' 📊 Total Request Cost ')}: ${costColor(` ${cost} `)} ${cost === 'HIGH' ? '⚠️' : cost === 'MEDIUM' ? '⚠️' : '✅'}`);
            }
        }
        catch (_2) { }
        // 🆕 NEW: Performance Metrics Display
        try {
            const m = (0, requestContext_1.getMetrics)();
            if (((_p = (_o = config_1.default.tracing) === null || _o === void 0 ? void 0 : _o.performance) === null || _p === void 0 ? void 0 : _p.enabled) &&
                (m === null || m === void 0 ? void 0 : m.performance) &&
                (m.performance.memoryStart || m.performance.cpuStart)) {
                const perf = m.performance;
                const thresholds = config_1.default.tracing.performance.thresholds;
                lines.push('');
                lines.push(colors_1.default.cyan.bold(' 📊 PERFORMANCE METRICS'));
                lines.push(' ----------------------------------------------------');
                // Memory Section
                if (perf.memoryStart && perf.memoryEnd) {
                    const growthMB = (0, performanceMetrics_1.calculateMemoryGrowth)(perf.memoryStart, perf.memoryEnd);
                    const memHealth = (0, performanceMetrics_1.getMemoryHealth)(growthMB, thresholds.memory);
                    const memColor = (0, performanceMetrics_1.getHealthColor)(memHealth);
                    const memEmoji = (0, performanceMetrics_1.getHealthEmoji)(memHealth);
                    const memBar = (0, performanceMetrics_1.formatProgressBar)(Math.abs(growthMB), 100, 10);
                    lines.push(colors_1.default.bold(' 💾 Memory'));
                    lines.push(colors_1.default.magenta(`    • Heap Start      : ${(0, performanceMetrics_1.formatBytes)(perf.memoryStart.heapUsed)}`));
                    lines.push(colors_1.default.magenta(`    • Heap End        : ${(0, performanceMetrics_1.formatBytes)(perf.memoryEnd.heapUsed)}`));
                    // Context note for high memory growth
                    let memoryNote = '';
                    if (growthMB > 50) {
                        const hasFiles = req.files && Object.keys(req.files).length > 0;
                        const isCryptoOperation = ((_q = req.originalUrl) === null || _q === void 0 ? void 0 : _q.includes('/auth/')) ||
                            ((_r = req.originalUrl) === null || _r === void 0 ? void 0 : _r.includes('/login')) ||
                            ((_s = req.originalUrl) === null || _s === void 0 ? void 0 : _s.includes('/register')) ||
                            ((_t = req.originalUrl) === null || _t === void 0 ? void 0 : _t.includes('/reset-password'));
                        if (hasFiles) {
                            memoryNote = colors_1.default.gray(' (file upload allocates buffers - normal)');
                        }
                        else if (isCryptoOperation) {
                            memoryNote = colors_1.default.gray(' (bcrypt allocates ~30-40MB - normal for auth)');
                        }
                        else {
                            memoryNote = colors_1.default.gray(' (consider if sustained across multiple requests)');
                        }
                    }
                    lines.push(memColor(`    • Growth          : ${memBar} ${growthMB >= 0 ? '+' : ''}${growthMB} MB [${memHealth}] ${memEmoji}${memoryNote}`));
                    lines.push(colors_1.default.magenta(`    • RSS             : ${(0, performanceMetrics_1.formatBytes)(perf.memoryEnd.rss)}`));
                    lines.push(memColor(`    • Status          : ${memHealth} - ${(0, performanceMetrics_1.getHealthDescription)(memHealth, 'memory')} ${memEmoji}`));
                }
                // CPU Section
                if (perf.cpuStart && perf.cpuEnd) {
                    const cpuTime = (0, performanceMetrics_1.calculateCPUTime)(perf.cpuStart, perf.cpuEnd);
                    const cpuOverhead = (0, performanceMetrics_1.calculateCPUOverhead)(cpuTime.totalMs, processedMs);
                    const cpuHealth = (0, performanceMetrics_1.getCPUHealth)(cpuOverhead, thresholds.cpu);
                    const cpuColor = (0, performanceMetrics_1.getHealthColor)(cpuHealth);
                    const cpuEmoji = (0, performanceMetrics_1.getHealthEmoji)(cpuHealth);
                    const cpuBar = (0, performanceMetrics_1.formatProgressBar)(cpuOverhead, 100, 10);
                    lines.push(colors_1.default.bold(' ⚡ CPU'));
                    lines.push(colors_1.default.magenta(`    • User Time       : ${cpuTime.userMs}ms`));
                    lines.push(colors_1.default.magenta(`    • System Time     : ${cpuTime.systemMs}ms`));
                    lines.push(colors_1.default.magenta(`    • Total           : ${cpuTime.totalMs}ms`));
                    // Context note for high CPU overhead (>100%)
                    let cpuOverheadNote = '';
                    if (cpuOverhead > 100) {
                        const isCryptoOperation = ((_u = req.originalUrl) === null || _u === void 0 ? void 0 : _u.includes('/auth/')) ||
                            ((_v = req.originalUrl) === null || _v === void 0 ? void 0 : _v.includes('/login')) ||
                            ((_w = req.originalUrl) === null || _w === void 0 ? void 0 : _w.includes('/register')) ||
                            ((_x = req.originalUrl) === null || _x === void 0 ? void 0 : _x.includes('/reset-password'));
                        const isFileOperation = ((_y = req.originalUrl) === null || _y === void 0 ? void 0 : _y.includes('/upload')) ||
                            Boolean(req.files && Object.keys(req.files).length > 0);
                        if (isCryptoOperation) {
                            cpuOverheadNote = colors_1.default.gray(' (bcrypt/JWT uses thread pool - normal)');
                        }
                        else if (isFileOperation) {
                            cpuOverheadNote = colors_1.default.gray(' (file processing on thread pool - normal)');
                        }
                        else {
                            cpuOverheadNote = colors_1.default.gray(' (multi-core async operation)');
                        }
                    }
                    lines.push(cpuColor(`    • Overhead        : ${cpuBar} ${cpuOverhead.toFixed(1)}% of request [${cpuHealth}] ${cpuEmoji}${cpuOverheadNote}`));
                    lines.push(cpuColor(`    • Status          : ${cpuHealth} - ${(0, performanceMetrics_1.getHealthDescription)(cpuHealth, 'cpu')} ${cpuEmoji}`));
                }
                // Event Loop Section
                if (perf.eventLoopSamples && perf.eventLoopSamples.length > 0) {
                    const loopMetrics = (0, performanceMetrics_1.calculateEventLoopMetrics)(perf.eventLoopSamples);
                    const loopHealth = (0, performanceMetrics_1.getEventLoopHealth)(loopMetrics.avgLag, thresholds.eventLoop);
                    const loopColor = (0, performanceMetrics_1.getHealthColor)(loopHealth);
                    const loopEmoji = (0, performanceMetrics_1.getHealthEmoji)(loopHealth);
                    const loopBar = (0, performanceMetrics_1.formatProgressBar)(loopMetrics.avgLag, 50, 10);
                    lines.push(colors_1.default.bold(' 🔄 Event Loop'));
                    lines.push(loopColor(`    • Avg Lag         : ${loopBar} ${loopMetrics.avgLag.toFixed(1)}ms [${loopHealth}] ${loopEmoji}`));
                    lines.push(colors_1.default.magenta(`    • Peak Lag        : ${loopMetrics.peakLag.toFixed(1)}ms`));
                    lines.push(colors_1.default.magenta(`    • Samples         : ${loopMetrics.sampleCount}`));
                    lines.push(loopColor(`    • Status          : ${loopHealth} - ${(0, performanceMetrics_1.getHealthDescription)(loopHealth, 'eventLoop')} ${loopEmoji}`));
                }
                // Overall Health Summary
                if (perf.memoryStart && perf.memoryEnd && perf.cpuStart && perf.cpuEnd) {
                    const growthMB = (0, performanceMetrics_1.calculateMemoryGrowth)(perf.memoryStart, perf.memoryEnd);
                    const cpuTime = (0, performanceMetrics_1.calculateCPUTime)(perf.cpuStart, perf.cpuEnd);
                    const cpuOverhead = (0, performanceMetrics_1.calculateCPUOverhead)(cpuTime.totalMs, processedMs);
                    const loopMetrics = ((_z = perf.eventLoopSamples) === null || _z === void 0 ? void 0 : _z.length)
                        ? (0, performanceMetrics_1.calculateEventLoopMetrics)(perf.eventLoopSamples)
                        : { avgLag: 0 };
                    const memHealth = (0, performanceMetrics_1.getMemoryHealth)(growthMB, thresholds.memory);
                    const cpuHealth = (0, performanceMetrics_1.getCPUHealth)(cpuOverhead, thresholds.cpu);
                    const loopHealth = (0, performanceMetrics_1.getEventLoopHealth)(loopMetrics.avgLag, thresholds.eventLoop);
                    const overall = (0, performanceMetrics_1.getOverallHealth)(memHealth, cpuHealth, loopHealth);
                    const overallColor = overall.emoji === '✅' ? colors_1.default.green.bold : overall.emoji === '⚠️' ? colors_1.default.yellow.bold : overall.emoji === '🟠' ? colors_1.default.magenta.bold : colors_1.default.red.bold;
                    lines.push(' ----------------------------------------------------');
                    lines.push(overallColor(` 🧠 Overall Health: ${overall.status} - ${overall.message} ${overall.emoji}`));
                }
            }
        }
        catch (_3) { }
        // ⏱️ Duration with thresholds and category label
        const durColor = processedMs >= 1000 ? colors_1.default.bgRed.white.bold : processedMs >= 300 ? colors_1.default.bgYellow.black.bold : colors_1.default.bgGreen.black.bold;
        const categoryLabel = processedMs >= 1000 ? 'Slow: >= 1000ms' : processedMs >= 300 ? 'Moderate: 300–999ms' : 'Fast: < 300ms';
        lines.push(`${durColor(` ⏱️ Processed in ${processedMs}ms `)} ${colors_1.default.blue(`[ ${categoryLabel} ]`)}`);
        const formatted = lines.join('\n');
        if (!isObservabilityRoute) {
            if (status >= 400)
                logger_1.errorLogger.error(formatted);
            else
                logger_1.logger.info(formatted);
        }
        // Observability log buffer removed
    });
    next();
};
exports.requestLogger = requestLogger;
// (removed) Misplaced Stripe signature log block — now handled inside formatted logger output
