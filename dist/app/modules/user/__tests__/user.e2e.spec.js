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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../user.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const http_status_codes_1 = require("http-status-codes");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
// Increase timeout for E2E tests
vitest_1.vi.setConfig({ testTimeout: 30000 });
let replSet;
let adminToken;
let metroUserToken;
let targetUserId;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
    yield mongoose_1.default.model('User').init();
    // 1. Create an ADMIN user
    const adminUser = yield user_model_1.User.create({
        name: 'Admin User',
        role: user_1.USER_ROLES.ADMIN,
        email: 'admin_e2e@stayhide.com',
        password: 'AdminPassword123!',
        isVerified: true,
        status: user_1.USER_STATUS.ACTIVE,
        dateOfBirth: new Date('1985-01-01'),
    });
    adminToken = jwtHelper_1.jwtHelper.createToken({ id: adminUser._id, role: adminUser.role, tokenVersion: adminUser.tokenVersion || 0 }, config_1.default.jwt.jwt_secret, '1d');
    // 2. Create a METRO USER (Standard User)
    const metroUser = yield user_model_1.User.create({
        name: 'Metro User',
        role: user_1.USER_ROLES.USER,
        email: 'metro_e2e@stayhide.com',
        password: 'UserPassword123!',
        isVerified: true,
        status: user_1.USER_STATUS.ACTIVE,
        dateOfBirth: new Date('1995-05-05'),
    });
    targetUserId = metroUser._id.toString();
    metroUserToken = jwtHelper_1.jwtHelper.createToken({ id: metroUser._id, role: metroUser.role, tokenVersion: metroUser.tokenVersion || 0 }, config_1.default.jwt.jwt_secret, '1d');
    // 3. Create a few more dummy users for pagination testing
    for (let i = 1; i <= 5; i++) {
        yield user_model_1.User.create({
            name: `Dummy Metro User ${i}`,
            role: user_1.USER_ROLES.USER,
            email: `dummy_metro${i}@stayhide.com`,
            password: 'DummyPassword123!',
            isVerified: true,
            status: i % 2 === 0 ? user_1.USER_STATUS.PENDING : user_1.USER_STATUS.ACTIVE,
            dateOfBirth: new Date('2000-01-01'),
        });
    }
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.describe)('User Module (Admin Operations) E2E Tests', () => {
    (0, vitest_1.describe)('1. Admin User Management Flow', () => {
        (0, vitest_1.it)('should forbid a regular Metro User from accessing user metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 01. ACCESS CONTROL FOR ADMIN ENDPOINTS
Feature: Secure Admin APIs
  As a system administrator
  I want to ensure only Admins can access user management APIs
  So that Metro Users cannot view sensitive system data

  Given a Metro User is authenticated
  When they attempt to fetch system user metrics
  Then the system rejects the request with a 403 Forbidden error
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/metrics')
                .set('Authorization', `Bearer ${metroUserToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/metrics', { headers: { Authorization: `Bearer ${metroUserToken}` } }, res.body, 'GET-METRICS-FORBIDDEN', 'Metro User tries to access admin metrics');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.FORBIDDEN);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.message).toContain("You don't have permission");
        }));
        (0, vitest_1.it)('should allow an Admin to view user metrics and growth statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 02. ADMIN DASHBOARD METRICS
Feature: User Analytics
  As a system administrator
  I want to view overall user metrics
  So that I can track platform growth

  Given the Admin is authenticated
  When they request user metrics
  Then the system aggregates total, active, pending, and suspended users
  And returns the formatted data successfully
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/metrics')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/metrics', { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'GET-USER-METRICS', 'Admin fetches user metrics');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.totalUsers).toBeDefined();
            (0, vitest_1.expect)(res.body.data.activeUsers).toBeDefined();
        }));
        (0, vitest_1.it)('should allow an Admin to fetch a paginated list of all Metro Users', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 03. LIST ALL USERS
Feature: User Management
  As a system administrator
  I want to list all Metro Users
  So that I can monitor and manage accounts

  Given the Admin is authenticated
  When they fetch the user list with pagination
  Then the system returns a paginated list of all non-admin users
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/?page=1&limit=10')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/?page=1&limit=10', { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'GET-ALL-USERS', 'Admin fetches all Metro Users');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(res.body.meta).toBeDefined();
            (0, vitest_1.expect)(res.body.meta.total).toBeGreaterThanOrEqual(6); // 1 metro user + 5 dummies
        }));
        (0, vitest_1.it)('should allow an Admin to fetch specific user details by ID', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 04. VIEW USER DETAILS
Feature: User Management
  As a system administrator
  I want to view the full details of a specific user
  So that I can investigate their account

  Given the Admin is authenticated
  When they request data for a specific user ID
  Then the system returns their full profile (excluding password/auth secrets)
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/users/${targetUserId}`, { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'GET-USER-BY-ID', 'Admin fetches specific user details');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.email).toBe('metro_e2e@stayhide.com');
            (0, vitest_1.expect)(res.body.data.password).toBeUndefined(); // Sensitive info should be excluded
        }));
        (0, vitest_1.it)('should allow an Admin to update a user (e.g. suspend or restrict)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 05. ADMIN UPDATES USER STATUS
Feature: Account Moderation
  As a system administrator
  I want to update a user's status or profile
  So that I can enforce platform rules (e.g. suspend bad actors)

  Given the Admin is authenticated
  When they send a PATCH request to update a user's status to SUSPENDED
  Then the system updates the user's status in the database
  And bumps the tokenVersion to immediately invalidate their active sessions
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: user_1.USER_STATUS.SUSPENDED });
            (0, testLogger_1.logApi)('PATCH', `/api/v1/users/${targetUserId}`, { headers: { Authorization: `Bearer ${adminToken}` }, body: { status: user_1.USER_STATUS.SUSPENDED } }, res.body, 'PATCH-UPDATE-USER', 'Admin suspends a user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const updatedUser = yield user_model_1.User.findById(targetUserId).select('+status');
            (0, vitest_1.expect)(updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.status).toBe(user_1.USER_STATUS.SUSPENDED);
        }));
        (0, vitest_1.it)('should prevent the suspended Metro User from accessing protected routes', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 06. SUSPENSION ENFORCEMENT
Feature: Account Moderation
  As a system administrator
  I want a suspended user to be instantly logged out
  So that they cannot continue using the platform

  Given a Metro User has been suspended by an Admin
  When they try to use their existing access token
  Then the auth middleware detects the tokenVersion bump and rejects the request
`);
            // The user tries to access their own profile using the old token
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/me')
                .set('Authorization', `Bearer ${metroUserToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/me', { headers: { Authorization: `Bearer ${metroUserToken}` } }, res.body, 'GET-ME-SUSPENDED', 'Suspended user tries to use old token');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.FORBIDDEN);
            (0, vitest_1.expect)(res.body.success).toBe(false);
            (0, vitest_1.expect)(res.body.message).toContain('Account is suspended');
        }));
        (0, vitest_1.it)('should allow an Admin to permanently delete a user', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 07. PERMANENT ACCOUNT DELETION
Feature: Account Moderation
  As a system administrator
  I want to permanently delete a user account from the system
  So that their data is completely removed

  Given the Admin is authenticated
  When they send a DELETE request for a specific user ID
  Then the system permanently removes the user from the database
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', `/api/v1/users/${targetUserId}`, { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'DELETE-USER', 'Admin permanently deletes a user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const deletedUser = yield user_model_1.User.findById(targetUserId);
            (0, vitest_1.expect)(deletedUser).toBeNull();
        }));
    });
});
