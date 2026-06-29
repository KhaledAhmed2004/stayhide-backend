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
const requestContext_1 = require("./requestContext");
const api_1 = require("@opentelemetry/api");
const fs_1 = require("fs");
const path_1 = require("path");
const loadOrderValidator_1 = require("./loadOrderValidator");
const colors_1 = __importDefault(require("colors"));
const config_1 = __importDefault(require("../../config"));
const captureUtils_1 = require("./captureUtils");
const captureConfig_1 = require("./captureConfig");
// Validate: mongooseMetrics must be loaded first
loadOrderValidator_1.LoadOrderValidator.validate('AUTO_LABEL', ['MONGOOSE_METRICS'], 'autoLabelBootstrap.ts');
// Register this module as loaded
loadOrderValidator_1.LoadOrderValidator.markLoaded('AUTO_LABEL', 'autoLabelBootstrap.ts');
const wrapService = (serviceName, obj) => {
    Object.keys(obj).forEach(key => {
        const original = obj[key];
        if (typeof original === 'function') {
            obj[key] = (...args) => {
                const label = `${serviceName}.${key}`;
                try {
                    (0, requestContext_1.setServiceLabel)(label);
                }
                catch (_a) { }
                const tracer = api_1.trace.getTracer('app');
                return tracer.startActiveSpan(`Service: ${label}`, (span) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a, _b, _c, _d;
                    const startTime = Date.now();
                    try {
                        // 🆕 NEW: Capture arguments
                        if (((_b = (_a = config_1.default.tracing) === null || _a === void 0 ? void 0 : _a.capture) === null || _b === void 0 ? void 0 : _b.enabled) && (0, captureConfig_1.shouldCapture)(label)) {
                            try {
                                const sanitized = (0, captureUtils_1.sanitize)(args, {
                                    maskPII: config_1.default.tracing.capture.maskPII,
                                });
                                const truncated = (0, captureUtils_1.truncate)(sanitized, {
                                    maxDepth: config_1.default.tracing.capture.maxDepth,
                                    maxArrayItems: config_1.default.tracing.capture.maxArrayItems,
                                    maxStringLength: config_1.default.tracing.capture.maxStringLength,
                                });
                                const serialized = (0, captureUtils_1.safeSerialize)(truncated);
                                if (!(0, captureUtils_1.exceedsSize)(serialized, config_1.default.tracing.capture.maxSizeKB)) {
                                    span.setAttribute('function.args', serialized);
                                    span.setAttribute('function.args.count', args.length);
                                }
                            }
                            catch (_e) {
                                // Silent failure - doesn't affect existing functionality
                            }
                        }
                        // Execute original function
                        const out = original(...args);
                        if (out && typeof out.then === 'function') {
                            const result = yield out;
                            // 🆕 NEW: Capture return value
                            if (((_d = (_c = config_1.default.tracing) === null || _c === void 0 ? void 0 : _c.capture) === null || _d === void 0 ? void 0 : _d.enabled) && (0, captureConfig_1.shouldCapture)(label, Date.now() - startTime)) {
                                try {
                                    const sanitized = (0, captureUtils_1.sanitize)(result, {
                                        maskPII: config_1.default.tracing.capture.maskPII,
                                    });
                                    const truncated = (0, captureUtils_1.truncate)(sanitized, {
                                        maxDepth: config_1.default.tracing.capture.maxDepth,
                                        maxArrayItems: config_1.default.tracing.capture.maxArrayItems,
                                        maxStringLength: config_1.default.tracing.capture.maxStringLength,
                                    });
                                    const serialized = (0, captureUtils_1.safeSerialize)(truncated);
                                    if (!(0, captureUtils_1.exceedsSize)(serialized, config_1.default.tracing.capture.maxSizeKB)) {
                                        span.setAttribute('function.result', serialized);
                                        span.setAttribute('function.result.type', typeof result);
                                        if (Array.isArray(result)) {
                                            span.setAttribute('function.result.length', result.length);
                                        }
                                    }
                                }
                                catch (_f) {
                                    // Silent failure
                                }
                            }
                            return result;
                        }
                        return out;
                    }
                    catch (err) {
                        span.recordException(err);
                        span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: err === null || err === void 0 ? void 0 : err.message });
                        throw err;
                    }
                    finally {
                        span.end();
                    }
                }));
            };
        }
    });
};
const wrapController = (controllerName, obj) => {
    Object.keys(obj).forEach(key => {
        const original = obj[key];
        if (typeof original === 'function') {
            obj[key] = (...args) => {
                const label = `${controllerName}.${key}`;
                try {
                    (0, requestContext_1.setControllerLabel)(label);
                }
                catch (_a) { }
                const tracer = api_1.trace.getTracer('app');
                return tracer.startActiveSpan(`Controller: ${label}`, (span) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a, _b, _c, _d;
                    const startTime = Date.now();
                    try {
                        // 🆕 NEW: Capture arguments
                        if (((_b = (_a = config_1.default.tracing) === null || _a === void 0 ? void 0 : _a.capture) === null || _b === void 0 ? void 0 : _b.enabled) && (0, captureConfig_1.shouldCapture)(label)) {
                            try {
                                const sanitized = (0, captureUtils_1.sanitize)(args, {
                                    maskPII: config_1.default.tracing.capture.maskPII,
                                });
                                const truncated = (0, captureUtils_1.truncate)(sanitized, {
                                    maxDepth: config_1.default.tracing.capture.maxDepth,
                                    maxArrayItems: config_1.default.tracing.capture.maxArrayItems,
                                    maxStringLength: config_1.default.tracing.capture.maxStringLength,
                                });
                                const serialized = (0, captureUtils_1.safeSerialize)(truncated);
                                if (!(0, captureUtils_1.exceedsSize)(serialized, config_1.default.tracing.capture.maxSizeKB)) {
                                    span.setAttribute('function.args', serialized);
                                    span.setAttribute('function.args.count', args.length);
                                }
                            }
                            catch (_e) {
                                // Silent failure
                            }
                        }
                        // Execute original function
                        const out = original(...args);
                        if (out && typeof out.then === 'function') {
                            const result = yield out;
                            // 🆕 NEW: Capture return value
                            if (((_d = (_c = config_1.default.tracing) === null || _c === void 0 ? void 0 : _c.capture) === null || _d === void 0 ? void 0 : _d.enabled) && (0, captureConfig_1.shouldCapture)(label, Date.now() - startTime)) {
                                try {
                                    const sanitized = (0, captureUtils_1.sanitize)(result, {
                                        maskPII: config_1.default.tracing.capture.maskPII,
                                    });
                                    const truncated = (0, captureUtils_1.truncate)(sanitized, {
                                        maxDepth: config_1.default.tracing.capture.maxDepth,
                                        maxArrayItems: config_1.default.tracing.capture.maxArrayItems,
                                        maxStringLength: config_1.default.tracing.capture.maxStringLength,
                                    });
                                    const serialized = (0, captureUtils_1.safeSerialize)(truncated);
                                    if (!(0, captureUtils_1.exceedsSize)(serialized, config_1.default.tracing.capture.maxSizeKB)) {
                                        span.setAttribute('function.result', serialized);
                                        span.setAttribute('function.result.type', typeof result);
                                        if (Array.isArray(result)) {
                                            span.setAttribute('function.result.length', result.length);
                                        }
                                    }
                                }
                                catch (_f) {
                                    // Silent failure
                                }
                            }
                            return result;
                        }
                        return out;
                    }
                    catch (err) {
                        span.recordException(err);
                        span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: err === null || err === void 0 ? void 0 : err.message });
                        throw err;
                    }
                    finally {
                        span.end();
                    }
                }));
            };
        }
    });
};
/**
 * Converts filename to PascalCase service/controller name
 * Examples:
 *   auth.service.ts → AuthService
 *   stripe-connect.service.ts → StripeConnectService
 */
const fileNameToExportName = (fileName, suffix) => {
    const baseName = fileName.replace(`.${suffix.toLowerCase()}.ts`, '');
    const pascalCase = baseName
        .split(/[-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    return pascalCase + suffix;
};
/**
 * Auto-discover and wrap all services and controllers
 * Scans src/app/modules/* for *.service.ts and *.controller.ts files
 */
const autoDiscoverAndWrap = () => {
    const modulesPath = (0, path_1.join)(__dirname, '../modules');
    let discoveredServices = 0;
    let discoveredControllers = 0;
    const failedFiles = [];
    try {
        // Get all module directories
        const moduleDirs = (0, fs_1.readdirSync)(modulesPath).filter(item => {
            const itemPath = (0, path_1.join)(modulesPath, item);
            try {
                return (0, fs_1.statSync)(itemPath).isDirectory();
            }
            catch (_a) {
                return false;
            }
        });
        // Process each module directory
        for (const moduleDir of moduleDirs) {
            const modulePath = (0, path_1.join)(modulesPath, moduleDir);
            let files;
            try {
                files = (0, fs_1.readdirSync)(modulePath);
            }
            catch (error) {
                continue; // Skip if can't read directory
            }
            // Auto-discover services (*.service.ts)
            const serviceFiles = files.filter(f => f.endsWith('.service.ts'));
            for (const serviceFile of serviceFiles) {
                const servicePath = (0, path_1.join)(modulePath, serviceFile);
                try {
                    // Clear require cache for hot reload support
                    delete require.cache[require.resolve(servicePath)];
                    // Dynamic runtime import (require needed for synchronous loading)
                    // Note: We use require() here instead of ES6 import because:
                    // 1. We need synchronous loading (await import() would complicate initialization)
                    // 2. We need runtime path resolution (file paths are dynamic)
                    // 3. We need cache control (delete require.cache for hot reload)
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const serviceModule = require(servicePath);
                    // Try to find the exported service object
                    const expectedName = fileNameToExportName(serviceFile, 'Service');
                    let serviceObj = serviceModule[expectedName] || serviceModule.default;
                    // Fallback: try to find any export with 'Service' in the name
                    if (!serviceObj) {
                        const keys = Object.keys(serviceModule);
                        const serviceKey = keys.find(k => k.includes('Service') && typeof serviceModule[k] === 'object');
                        serviceObj = serviceModule[serviceKey || ''];
                    }
                    // Wrap if valid object found
                    if (serviceObj && typeof serviceObj === 'object') {
                        wrapService(expectedName, serviceObj);
                        discoveredServices++;
                    }
                }
                catch (error) {
                    // Graceful error handling for auto-save scenarios
                    if (error instanceof SyntaxError) {
                        // Silently skip incomplete files during auto-save
                        // Will be re-imported on next save when code is complete
                    }
                    else if (error.code === 'MODULE_NOT_FOUND') {
                        failedFiles.push(`${serviceFile} (dependency missing)`);
                    }
                    else {
                        failedFiles.push(`${serviceFile} (${error.message})`);
                    }
                }
            }
            // Auto-discover controllers (*.controller.ts)
            const controllerFiles = files.filter(f => f.endsWith('.controller.ts'));
            for (const controllerFile of controllerFiles) {
                const controllerPath = (0, path_1.join)(modulePath, controllerFile);
                try {
                    // Clear require cache for hot reload support
                    delete require.cache[require.resolve(controllerPath)];
                    // Dynamic runtime import (same rationale as services above)
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const controllerModule = require(controllerPath);
                    // Try to find the exported controller object
                    const expectedName = fileNameToExportName(controllerFile, 'Controller');
                    let controllerObj = controllerModule[expectedName] || controllerModule.default;
                    // Fallback: try to find any export with 'Controller' in the name
                    if (!controllerObj) {
                        const keys = Object.keys(controllerModule);
                        const controllerKey = keys.find(k => k.includes('Controller') && typeof controllerModule[k] === 'object');
                        controllerObj = controllerModule[controllerKey || ''];
                    }
                    // Wrap if valid object found
                    if (controllerObj && typeof controllerObj === 'object') {
                        wrapController(expectedName, controllerObj);
                        discoveredControllers++;
                    }
                }
                catch (error) {
                    // Graceful error handling for auto-save scenarios
                    if (error instanceof SyntaxError) {
                        // Silently skip incomplete files during auto-save
                        // Will be re-imported on next save when code is complete
                    }
                    else if (error.code === 'MODULE_NOT_FOUND') {
                        failedFiles.push(`${controllerFile} (dependency missing)`);
                    }
                    else {
                        failedFiles.push(`${controllerFile} (${error.message})`);
                    }
                }
            }
        }
        // Log summary with beautiful box
        const totalModules = discoveredServices + discoveredControllers;
        console.log('\n' + colors_1.default.cyan.bold('╔═══════════════════════════════════════════════════════════╗'));
        console.log(colors_1.default.cyan.bold('║') + colors_1.default.cyan.bold('              🎉 AUTO-LABELING COMPLETE                 ') + colors_1.default.cyan.bold('║'));
        console.log(colors_1.default.cyan.bold('╠═══════════════════════════════════════════════════════════╣'));
        console.log(colors_1.default.cyan.bold('║') + `  Services Wrapped       │ ${colors_1.default.green.bold(discoveredServices.toString()).padEnd(34)}` + colors_1.default.cyan.bold('║'));
        console.log(colors_1.default.cyan.bold('║') + `  Controllers Wrapped    │ ${colors_1.default.green.bold(discoveredControllers.toString()).padEnd(34)}` + colors_1.default.cyan.bold('║'));
        console.log(colors_1.default.cyan.bold('║') + `  Total Modules          │ ${colors_1.default.green.bold(totalModules.toString()).padEnd(34)}` + colors_1.default.cyan.bold('║'));
        console.log(colors_1.default.cyan.bold('╚═══════════════════════════════════════════════════════════╝\n'));
        // Show warnings for failed files (only real errors, not syntax errors)
        if (failedFiles.length > 0) {
            console.log(colors_1.default.yellow.bold('╔═══════════════════════════════════════════════════════════╗'));
            console.log(colors_1.default.yellow.bold('║') + colors_1.default.yellow.bold('              ⚠️  FAILED TO LOAD                         ') + colors_1.default.yellow.bold('║'));
            console.log(colors_1.default.yellow.bold('╠═══════════════════════════════════════════════════════════╣'));
            failedFiles.forEach(file => {
                const truncated = file.length > 57 ? file.substring(0, 54) + '...' : file;
                console.log(colors_1.default.yellow.bold('║') + colors_1.default.gray(`  • ${truncated.padEnd(57)}`) + colors_1.default.yellow.bold('║'));
            });
            console.log(colors_1.default.yellow.bold('╚═══════════════════════════════════════════════════════════╝\n'));
        }
        // Validation: Fail startup if no modules discovered
        if (discoveredServices === 0 && discoveredControllers === 0) {
            console.error('\n❌ Auto-discovery failed: No services or controllers found!');
            console.error('   Expected structure: src/app/modules/*/{{moduleName}}.service.ts');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('\n❌ Auto-discovery error:', error);
        process.exit(1);
    }
};
// Execute auto-discovery immediately (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    autoDiscoverAndWrap();
}
