"use strict";
/**
 * E2E tests for Prayer Time calculation module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server for clean database connectivity during app bootstrap.
 * Calculates Salat times dynamically offline.
 */
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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
let replSet;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.describe)('Prayer Time E2E Tests', () => {
    (0, vitest_1.describe)('GET /api/v1/prayer-times', () => {
        (0, vitest_1.it)('successfully retrieves prayer times for Dhaka (default parameters)', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                latitude: '23.8103',
                longitude: '90.4125',
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/prayer-times')
                .query(query);
            (0, testLogger_1.logApi)('GET', '/api/v1/prayer-times', {
                params: {},
                query,
                body: {},
            }, response.body, undefined, 'successfully retrieves prayer times for Dhaka (default parameters)');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeDefined();
            (0, vitest_1.expect)(response.body.data.weekday).toBeDefined();
            (0, vitest_1.expect)(response.body.data.hijriDate).toBeDefined();
            // Ensure hijriDate doesn't contain Gregorian month names if possible
            const gregorianMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const containsGregorian = gregorianMonths.some(month => response.body.data.hijriDate.includes(month));
            (0, vitest_1.expect)(containsGregorian).toBe(false);
            (0, vitest_1.expect)(response.body.data.location).toBe('Dhaka, Bangladesh');
            // Verify all timings are present and formatted correctly (HH:MM)
            const timings = response.body.data.timings;
            (0, vitest_1.expect)(timings).toBeDefined();
            const timeRegex = /^[0-9]{2}:[0-9]{2}$/;
            (0, vitest_1.expect)(timings.fajr).toMatch(timeRegex);
            (0, vitest_1.expect)(timings.sunrise).toMatch(timeRegex);
            (0, vitest_1.expect)(timings.dhuhr).toMatch(timeRegex);
            (0, vitest_1.expect)(timings.asr).toMatch(timeRegex);
            (0, vitest_1.expect)(timings.maghrib).toMatch(timeRegex);
            (0, vitest_1.expect)(timings.isha).toMatch(timeRegex);
        }));
        (0, vitest_1.it)('successfully calculates using custom method, madhab, date, and timezone', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                latitude: '40.7128',
                longitude: '-74.0060',
                date: '2026-06-15',
                method: 'isna',
                madhab: 'Shafi',
                timezone: 'America/New_York',
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/prayer-times')
                .query(query);
            (0, testLogger_1.logApi)('GET', '/api/v1/prayer-times', {
                params: {},
                query,
                body: {},
            }, response.body, 'CUSTOM_PARAMS', 'successfully calculates using custom method, madhab, date, and timezone');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.location).toBe('New York');
            const timings = response.body.data.timings;
            (0, vitest_1.expect)(timings).toBeDefined();
            const timeRegex = /^[0-9]{2}:[0-9]{2}$/;
            (0, vitest_1.expect)(timings.fajr).toMatch(timeRegex);
            (0, vitest_1.expect)(timings.sunrise).toMatch(timeRegex);
        }));
        (0, vitest_1.it)('returns jummah timing when the date is a Friday', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                latitude: '23.8103',
                longitude: '90.4125',
                date: '2026-06-12', // June 12, 2026 is a Friday
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/prayer-times')
                .query(query);
            (0, testLogger_1.logApi)('GET', '/api/v1/prayer-times', {
                params: {},
                query,
                body: {},
            }, response.body, 'FRIDAY_JUMMAH', 'returns jummah timing when the date is a Friday');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.timings.jummah).toBeDefined();
            (0, vitest_1.expect)(response.body.data.timings.jummah).toBe(response.body.data.timings.dhuhr);
        }));
        (0, vitest_1.it)('returns 400 bad request when latitude is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                longitude: '90.4125',
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/prayer-times')
                .query(query);
            (0, testLogger_1.logApi)('GET', '/api/v1/prayer-times', {
                params: {},
                query,
                body: {},
            }, response.body, 'MISSING_LATITUDE', 'returns 400 bad request when latitude is missing');
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body.success).toBe(false);
            (0, vitest_1.expect)(response.body.message).toContain('Validation Error');
        }));
        (0, vitest_1.it)('returns 400 bad request when coordinates are out of bounds', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                latitude: '120.0', // Out of bounds (-90 to 90)
                longitude: '90.4125',
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/prayer-times')
                .query(query);
            (0, testLogger_1.logApi)('GET', '/api/v1/prayer-times', {
                params: {},
                query,
                body: {},
            }, response.body, 'OUT_OF_BOUNDS', 'returns 400 bad request when coordinates are out of bounds');
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body.success).toBe(false);
            (0, vitest_1.expect)(response.body.message).toContain('Validation Error');
        }));
        (0, vitest_1.it)('returns 400 bad request when an invalid date is sent', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                latitude: '23.8103',
                longitude: '90.4125',
                date: 'not-a-valid-date',
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/prayer-times')
                .query(query);
            (0, testLogger_1.logApi)('GET', '/api/v1/prayer-times', {
                params: {},
                query,
                body: {},
            }, response.body, 'INVALID_DATE', 'returns 400 bad request when an invalid date is sent');
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body.success).toBe(false);
            (0, vitest_1.expect)(response.body.message).toContain('Validation Error');
        }));
        (0, vitest_1.it)('returns 400 bad request when an invalid madhab is sent', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                latitude: '23.8103',
                longitude: '90.4125',
                madhab: 'invalid-madhab',
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/prayer-times')
                .query(query);
            (0, testLogger_1.logApi)('GET', '/api/v1/prayer-times', {
                params: {},
                query,
                body: {},
            }, response.body, 'INVALID_MADHAB', 'returns 400 bad request when an invalid madhab is sent');
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body.success).toBe(false);
            (0, vitest_1.expect)(response.body.message).toContain('Validation Error');
        }));
    });
});
