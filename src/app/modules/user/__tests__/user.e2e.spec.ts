import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../user.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { StatusCodes } from 'http-status-codes';
import { logApi } from '../../../../helpers/__tests__/testLogger';

// Increase timeout for E2E tests
vi.setConfig({ testTimeout: 30000 });

let replSet: MongoMemoryReplSet;
let adminToken: string;
let metroUserToken: string;
let targetUserId: string;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await mongoose.model('User').init();

  // 1. Create an ADMIN user
  const adminUser = await User.create({
    name: 'Admin User',
    role: USER_ROLES.ADMIN,
    email: 'admin_e2e@stayhide.com',
    password: 'AdminPassword123!',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    dateOfBirth: new Date('1985-01-01'),
  });

  adminToken = jwtHelper.createToken(
    { id: adminUser._id, role: adminUser.role, tokenVersion: adminUser.tokenVersion || 0 },
    config.jwt.jwt_secret as Secret,
    '1d'
  );

  // 2. Create a METRO USER (Standard User)
  const metroUser = await User.create({
    name: 'Metro User',
    role: USER_ROLES.USER,
    email: 'metro_e2e@stayhide.com',
    password: 'UserPassword123!',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    dateOfBirth: new Date('1995-05-05'),
  });
  targetUserId = metroUser._id.toString();

  metroUserToken = jwtHelper.createToken(
    { id: metroUser._id, role: metroUser.role, tokenVersion: metroUser.tokenVersion || 0 },
    config.jwt.jwt_secret as Secret,
    '1d'
  );

  // 3. Create a few more dummy users for pagination testing
  for (let i = 1; i <= 5; i++) {
    await User.create({
      name: `Dummy Metro User ${i}`,
      role: USER_ROLES.USER,
      email: `dummy_metro${i}@stayhide.com`,
      password: 'DummyPassword123!',
      isVerified: true,
      status: i % 2 === 0 ? USER_STATUS.PENDING : USER_STATUS.ACTIVE,
      dateOfBirth: new Date('2000-01-01'),
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('User Module (Admin Operations) E2E Tests', () => {

  describe('1. Admin User Management Flow', () => {

    it('should forbid a regular Metro User from accessing user metrics', async () => {
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
      const res = await request(app)
        .get('/api/v1/users/metrics')
        .set('Authorization', `Bearer ${metroUserToken}`);

      logApi('GET', '/api/v1/users/metrics', { headers: { Authorization: `Bearer ${metroUserToken}` } }, res.body, 'GET-METRICS-FORBIDDEN', 'Metro User tries to access admin metrics');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("You don't have permission");
    });

    it('should allow an Admin to view user metrics and growth statistics', async () => {
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
      const res = await request(app)
        .get('/api/v1/users/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/users/metrics', { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'GET-USER-METRICS', 'Admin fetches user metrics');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBeDefined();
      expect(res.body.data.activeUsers).toBeDefined();
    });

    it('should allow an Admin to fetch a paginated list of all Metro Users', async () => {
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
      const res = await request(app)
        .get('/api/v1/users/?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/users/?page=1&limit=10', { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'GET-ALL-USERS', 'Admin fetches all Metro Users');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(6); // 1 metro user + 5 dummies
    });

    it('should allow an Admin to fetch specific user details by ID', async () => {
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
      const res = await request(app)
        .get(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', `/api/v1/users/${targetUserId}`, { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'GET-USER-BY-ID', 'Admin fetches specific user details');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('metro_e2e@stayhide.com');
      expect(res.body.data.password).toBeUndefined(); // Sensitive info should be excluded
    });

    it('should allow an Admin to update a user (e.g. suspend or restrict)', async () => {
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
      const res = await request(app)
        .patch(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: USER_STATUS.SUSPENDED });

      logApi('PATCH', `/api/v1/users/${targetUserId}`, { headers: { Authorization: `Bearer ${adminToken}` }, body: { status: USER_STATUS.SUSPENDED } }, res.body, 'PATCH-UPDATE-USER', 'Admin suspends a user');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const updatedUser = await User.findById(targetUserId).select('+status');
      expect(updatedUser?.status).toBe(USER_STATUS.SUSPENDED);
    });

    it('should prevent the suspended Metro User from accessing protected routes', async () => {
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
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${metroUserToken}`);

      logApi('GET', '/api/v1/users/me', { headers: { Authorization: `Bearer ${metroUserToken}` } }, res.body, 'GET-ME-SUSPENDED', 'Suspended user tries to use old token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Account is suspended');
    });

    it('should allow an Admin to permanently delete a user', async () => {
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
      const res = await request(app)
        .delete(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('DELETE', `/api/v1/users/${targetUserId}`, { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'DELETE-USER', 'Admin permanently deletes a user');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const deletedUser = await User.findById(targetUserId);
      expect(deletedUser).toBeNull();
    });

  });
});
