import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import { User } from '../modules/user/user.model';
import { jwtHelper } from '../../helpers/jwtHelper';
import config from '../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../enums/user';
import { StatusCodes } from 'http-status-codes';
import { logApi } from '../../helpers/__tests__/testLogger';
import dayjs from 'dayjs';
import { SymptomLog } from '../modules/symptom-log/symptom-log.model';

// Increase timeout for E2E tests
vi.setConfig({ testTimeout: 30000 });

let replSet: MongoMemoryReplSet;
let userToken: string;
let refreshToken: string;
let testUserId: string;
let testUserEmail: string;
let TEST_PASSWORD = 'TestPassword123!';

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Ensure indexes are built
  await mongoose.model('User').init();

  testUserEmail = 'stayhide_e2e@test.com';
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Master System Flow E2E Tests', () => {

  describe('0. Authentication & Profile Flow', () => {

    it('should successfully register a new user account', async () => {
      console.info(`
📖 BDD SCENARIO: 01. USER REGISTRATION
Feature: Account Creation
  As a new user
  I want to register an account
  So that my data is securely saved

  Given the user provides valid registration details
  When they submit the registration form
  Then the backend creates a PENDING account and sends an OTP
`);
      const payload = {
        name: 'E2E Tester',
        email: testUserEmail,
        password: TEST_PASSWORD,
        dateOfBirth: '1990-01-01T00:00:00.000Z'
      };
      const res = await request(app)
        .post('/api/v1/users/')
        .send(payload);

      logApi('POST', '/api/v1/users/', { body: { ...payload, password: '***' } }, res.body, 'POST-REGISTER', 'User signs up');

      expect([StatusCodes.CREATED, StatusCodes.OK]).toContain(res.status);
      expect(res.body.success).toBe(true);

      const newlyRegisteredUser = await User.findOne({ email: testUserEmail }).select('+authentication');
      testUserId = newlyRegisteredUser!._id.toString();
      expect(newlyRegisteredUser).toBeDefined();
      expect(newlyRegisteredUser?.status).toBe(USER_STATUS.PENDING);
    });

    it('should verify OTP and activate account', async () => {
      console.info(`
📖 BDD SCENARIO: 02. VERIFY ACCOUNT OTP
Feature: Account Verification
  As a pending user
  I want to verify my email with the OTP I received
  So my account becomes ACTIVE and I can log in

  Given the user has a pending account
  When they submit the correct OTP
  Then their account becomes ACTIVE
  And the backend automatically issues an 'accessToken' for instant login
`);
      const user = await User.findOne({ email: testUserEmail }).select('+authentication');
      const otp = user?.authentication?.oneTimeCode;
      expect(otp).toBeDefined();

      const payload = { email: testUserEmail, otp };
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send(payload);

      logApi('POST', '/api/v1/auth/verify-otp', { body: payload }, verifyRes.body, 'POST-VERIFY-OTP', 'User verifies account');

      expect(verifyRes.status).toBe(StatusCodes.OK);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.accessToken).toBeDefined();

      // Ensure user is now active
      const activeUser = await User.findById(testUserId);
      expect(activeUser?.status).toBe(USER_STATUS.ACTIVE);
    });

    it('should successfully login and obtain a valid auth token (Standard Login)', async () => {
      console.info(`
📖 BDD SCENARIO: 03. STANDARD LOGIN
Feature: Authentication
  As a returning user
  I want to log in
  So I can access my account

  Given the user has an active account
  When they enter their correct email and password
  Then the system verifies the credentials
  And returns a JWT access token
`);
      const payload = {
        email: testUserEmail,
        password: TEST_PASSWORD,
      };
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(payload);

      logApi('POST', '/api/v1/auth/login', { body: { ...payload, password: '***' } }, res.body, 'POST-AUTH-LOGIN', 'User logs in to the system');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      userToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should allow an authenticated user to update their profile information', async () => {
      console.info(`
📖 BDD SCENARIO: 04. UPDATE USER PROFILE
Feature: Profile Management
  As a logged-in user
  I want to update my personal information (name)
  So that my profile remains accurate

  Given the user is authenticated
  When they submit a request to update their name
  Then the system validates the input
  And updates the user's profile in the database
  And returns the updated user object
`);
      const updatedInfo = {
        name: 'Updated E2E User Name',
      };

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatedInfo);

      logApi('PATCH', '/api/v1/users/me', { headers: { Authorization: `Bearer ${userToken}` }, body: updatedInfo }, res.body, 'PATCH-UPDATE-PROFILE', 'User updates their profile');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updatedInfo.name);
    });

    it('should initiate the forgot-password flow and send an OTP', async () => {
      console.info(`
📖 BDD SCENARIO: 05. FORGOT PASSWORD (REQUEST OTP)
Feature: Password Recovery
  As a user who forgot their password
  I want to request an OTP
  So I can reset it

  Given the user enters their registered email
  When they request a password reset
  Then the backend generates a 6-digit OTP
`);
      const payload = { email: testUserEmail };
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(payload);

      logApi('POST', '/api/v1/auth/forgot-password', { body: payload }, res.body, 'POST-FORGOT-PASSWORD', 'User requests OTP');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should verify OTP and reset the password using the generated token', async () => {
      console.info(`
📖 BDD SCENARIO: 06. VERIFY OTP & RESET PASSWORD
Feature: Secure Password Recovery
  As a user who received an OTP
  I want to securely verify my OTP and reset my password
  So I can regain access to my account

  Given the user received a 6-digit OTP in their email
  When they submit the OTP to the verification endpoint
  Then the backend issues a temporary 'resetToken'

  Given the user has obtained the temporary 'resetToken'
  When they submit a new password
  Then the backend securely updates the password hash
`);
      const updatedUser = await User.findOne({ email: testUserEmail }).select('+authentication');
      const otp = updatedUser?.authentication?.oneTimeCode;
      
      expect(otp).toBeDefined();

      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: testUserEmail, otp });

      expect(verifyRes.status).toBe(StatusCodes.OK);
      const resetToken = verifyRes.body.data.resetToken;
      expect(resetToken).toBeDefined();

      const newPassword = 'BrandNewPassword123!';
      const payload = { newPassword };
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .set('Authorization', `Bearer ${resetToken}`)
        .send(payload);

      logApi('POST', '/api/v1/auth/reset-password', { headers: { Authorization: `Bearer ${resetToken}` }, body: { ...payload, newPassword: '***' } }, res.body, 'POST-RESET-PASSWORD', 'User resets password');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      TEST_PASSWORD = newPassword;

      // Re-login to get valid token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: TEST_PASSWORD });
      userToken = loginRes.body.data.accessToken;
    });

    it('should allow an authenticated user to change their password', async () => {
      console.info(`
📖 BDD SCENARIO: 07. CHANGE PASSWORD (IN-APP)
Feature: Account Management
  As a logged-in user
  I want to change my password
  So I can keep my account secure

  Given the user is authenticated
  When they provide their current password and a new password
  Then the backend verifies the current password
  And updates the hash and refreshes their session
`);
      const finalPassword = 'FinalPassword123!';
      const payload = { currentPassword: TEST_PASSWORD, newPassword: finalPassword };
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('POST', '/api/v1/auth/change-password', { headers: { Authorization: `Bearer ${userToken}` }, body: { ...payload, currentPassword: '***', newPassword: '***' } }, res.body, 'POST-CHANGE-PASSWORD', 'User changes password');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      TEST_PASSWORD = finalPassword;

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: TEST_PASSWORD });
      userToken = loginRes.body.data.accessToken;
    });

    it('should allow a user to soft-delete their account', async () => {
      console.info(`
📖 BDD SCENARIO: 08. ACCOUNT DELETION
Feature: Account Settings
  As a logged-in user
  I want to delete my account when I no longer need it
  So that my data is removed securely (with a 30-day grace period)

  Given the user provides their valid password
  When they submit a request to delete their account
  Then the system validates the password
  And sets the account status to DELETED
  And invalidates their current session
`);
      const payload = { password: TEST_PASSWORD };
      const deleteRes = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('DELETE', '/api/v1/users/me', { headers: { Authorization: `Bearer ${userToken}` }, body: { ...payload, password: '***' } }, deleteRes.body, 'DELETE-ACCOUNT', 'User deletes their account');

      expect(deleteRes.status).toBe(StatusCodes.OK);
      expect(deleteRes.body.success).toBe(true);

      const deletedUser = await User.findById(testUserId).select('+status');
      expect(deletedUser?.status).toBe(USER_STATUS.DELETED);
    });

    it('should allow a user to restore a soft-deleted account within the grace period', async () => {
      console.info(`
📖 BDD SCENARIO: 09. ACCOUNT RESTORATION
Feature: Account Recovery
  As a user who recently deleted my account
  I want to easily restore my account via the frontend prompt
  So that I can regain access to my profile without creating a new one

  Given the user's account is DELETED
  When they request to restore it with their credentials
  Then the backend validates their credentials
  And changes the account status back to ACTIVE
  And immediately issues new access tokens
`);
      const payload = { email: testUserEmail, password: TEST_PASSWORD };
      const restoreRes = await request(app)
        .post('/api/v1/auth/restore-account')
        .send(payload);

      logApi('POST', '/api/v1/auth/restore-account', { body: { ...payload, password: '***' } }, restoreRes.body, 'POST-RESTORE-ACCOUNT', 'User restores their deleted account');

      expect(restoreRes.status).toBe(StatusCodes.OK);
      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.data.accessToken).toBeDefined();
      expect(restoreRes.body.data.refreshToken).toBeDefined();

      userToken = restoreRes.body.data.accessToken;
      refreshToken = restoreRes.body.data.refreshToken;

      const restoredUser = await User.findOne({ email: testUserEmail }).select('+status');
      expect(restoredUser?.status).toBe(USER_STATUS.ACTIVE);
    });

  });

  describe('1. Session Management & Advanced Profile Flow', () => {
    let emailChangeOtp: string;
    let newEmailAddress = 'stayhide_updated_e2e@test.com';

    beforeAll(async () => {
      if (!userToken || !refreshToken) {
        // If running in isolation, create a dummy user and generate tokens
        const user = await User.create({
          name: 'Isolated User',
          email: 'isolated@test.com',
          password: 'TestPassword123!', // This will be hashed by pre-save hook
          role: USER_ROLES.USER,
          status: USER_STATUS.ACTIVE,
          isVerified: true,
          dateOfBirth: new Date('1990-01-01'),
        });
        testUserId = user._id.toString();
        testUserEmail = user.email;

        userToken = jwtHelper.createToken(
          { id: testUserId, role: user.role, email: user.email, tokenVersion: user.tokenVersion ?? 0 },
          config.jwt.jwt_secret as Secret,
          config.jwt.jwt_expire_in as string
        );
        refreshToken = jwtHelper.createToken(
          { id: testUserId, role: user.role, email: user.email, tokenVersion: user.tokenVersion ?? 0 },
          config.jwt.jwt_refresh_secret as Secret,
          config.jwt.jwt_refresh_expire_in as string
        );
      }
    });

    it('should allow the user to view their active sessions', async () => {
      console.info(`
📖 BDD SCENARIO: 10. VIEW ACTIVE SESSIONS
Feature: Session Management
  As a security-conscious user
  I want to see all my active logged-in devices
  So that I can verify my account security

  Given the user is authenticated
  When they request their session list
  Then the system returns a list of active sessions
`);
      const res = await request(app)
        .get('/api/v1/users/me/sessions')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/users/me/sessions', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SESSIONS', 'User views their active sessions');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
      expect(res.body.data.sessions.length).toBeGreaterThanOrEqual(0);
    });

    it('should allow the user to silently refresh their access token', async () => {
      console.info(`
📖 BDD SCENARIO: 11. SILENT TOKEN REFRESH
Feature: Authentication
  As a user with an expired access token
  I want to use my refresh token
  So I can securely get a new token without logging in again

  Given the user has a valid refresh token
  When they submit it to the refresh endpoint
  Then the system issues a new accessToken
`);
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken });

      logApi('POST', '/api/v1/auth/refresh-token', { body: { refreshToken: '***' } }, res.body, 'POST-REFRESH-TOKEN', 'User refreshes access token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      // Update the userToken for subsequent tests
      userToken = res.body.data.accessToken;
    });

    it('should allow the user to export their personal data', async () => {
      console.info(`
📖 BDD SCENARIO: 12. GDPR DATA EXPORT
Feature: Privacy & Data Ownership
  As a privacy-conscious user
  I want to export all my personal data
  So that I have a local copy of my information

  Given the user is authenticated
  When they request a data export
  Then the system returns all their data in JSON format
`);
      const res = await request(app)
        .post('/api/v1/users/me/data-export')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('POST', '/api/v1/users/me/data-export', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-DATA-EXPORT', 'User exports personal data');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile).toBeDefined();
    });

    it('should initiate the email change flow', async () => {
      console.info(`
📖 BDD SCENARIO: 13. REQUEST EMAIL CHANGE
Feature: Account Settings
  As a logged-in user
  I want to change my email address
  So that I can use a different inbox

  Given the user provides their password and a new email
  When they submit the request
  Then the system sends an OTP to the new email
`);
      const payload = { password: TEST_PASSWORD, newEmail: newEmailAddress };
      const res = await request(app)
        .post('/api/v1/users/me/email-change/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('POST', '/api/v1/users/me/email-change/request', { headers: { Authorization: `Bearer ${userToken}` }, body: { ...payload, password: '***' } }, res.body, 'POST-EMAIL-CHANGE-REQ', 'User requests email change');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should verify the email change OTP and update the email', async () => {
      console.info(`
📖 BDD SCENARIO: 14. CONFIRM NEW EMAIL
Feature: Account Settings
  As a user who received the email change OTP
  I want to verify it
  So my primary email gets updated

  Given the user has the OTP sent to their new email
  When they submit it
  Then the system updates their email address
`);
      // Retrieve the OTP directly from the database for testing purposes
      const userDoc = await User.findById(testUserId).select('+emailChange');
      emailChangeOtp = userDoc?.emailChange?.otp as string;
      expect(emailChangeOtp).toBeDefined();

      const payload = { otp: emailChangeOtp };
      const res = await request(app)
        .post('/api/v1/users/me/email-change/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('POST', '/api/v1/users/me/email-change/confirm', { headers: { Authorization: `Bearer ${userToken}` }, body: payload }, res.body, 'POST-EMAIL-CHANGE-CONFIRM', 'User confirms new email');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      // Verify the database has the new email
      const updatedUser = await User.findById(testUserId);
      expect(updatedUser?.email).toBe(newEmailAddress);

      // Re-login with the new email to get a valid token (since tokenVersion was bumped)
      const loginRes = await request(app).post('/api/v1/auth/login').send({ email: newEmailAddress, password: TEST_PASSWORD });
      userToken = loginRes.body.data.accessToken;
      refreshToken = loginRes.body.data.refreshToken;
    });

    it('should update user preferences for daily reminders', async () => {
      console.info(`
📖 BDD SCENARIO: 35. UPDATE SYMPTOM REMINDER PREFERENCES
Feature: User Settings
  As a user
  I want to opt-in to daily symptom tracking reminders
  So that I never forget to log my health

  Given the user updates their preferences
  When they enable daily symptom reminders and set their timezone
  Then the backend should save this preference
`);
      const payload = {
        isDailySymptomReminderEnabled: true,
        timezone: 'America/New_York',
      };

      const res = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('PATCH', '/api/v1/users/me/preferences', { headers: { Authorization: `Bearer ${userToken}` }, body: payload }, res.body, 'PATCH-USER-PREFS', 'Update reminder preferences');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDailySymptomReminderEnabled).toBe(true);
      expect(res.body.data.timezone).toBe('America/New_York');
    });

    it('should log the user out securely', async () => {
      console.info(`
📖 BDD SCENARIO: 15. SECURE LOGOUT
Feature: Authentication
  As a logged-in user
  I want to log out
  So that my current session is securely invalidated

  Given the user is authenticated
  When they submit a logout request
  Then the system destroys their session
`);
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('POST', '/api/v1/auth/logout', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-LOGOUT', 'User securely logs out');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

  });

  describe('2. Medicine Addition & Validation Flow', () => {
    let addMedUserToken: string;

    beforeAll(async () => {
      // Always create a separate isolated user for validation tests to avoid polluting the main test user's schedule
      const user = await User.create({
        name: 'Isolated Add Med User',
        email: `isolated_add_med_${Date.now()}@test.com`,
        password: 'TestPassword123!',
        role: USER_ROLES.USER,
        status: USER_STATUS.ACTIVE,
        isVerified: true,
        dateOfBirth: new Date('1990-01-01'),
      });
      addMedUserToken = jwtHelper.createToken(
        { id: user._id.toString(), role: user.role, email: user.email, tokenVersion: user.tokenVersion ?? 0 },
        config.jwt.jwt_secret as Secret,
        config.jwt.jwt_expire_in as string
      );
    });

    const basePayload = {
      name: 'Test Med',
      dosage: { amount: 500, unit: 'mg' },
      type: 'TABLET',
      startDate: '2026-06-24',
      isOngoing: true,
      dosingTimes: ['08:00'],
    };

    it('should successfully create a WEEKLY medication with daysOfWeek', async () => {
      console.info(`
📖 BDD SCENARIO: 20-A. CREATE WEEKLY MEDICATION
Feature: Medicine Addition
  As a user
  I want to add a weekly medication
  So I can take it on specific days

  Given I provide valid details with WEEKLY frequency
  When I submit the form
  Then the system saves it successfully
`);
      const payload = {
        ...basePayload,
        name: 'Weekly Med',
        frequency: { frequencyType: 'WEEKLY', daysOfWeek: [1, 3, 5] },
      };
      const res = await request(app).post('/api/v1/medicines').set('Authorization', `Bearer ${addMedUserToken}`).send(payload);
      logApi('POST', '/api/v1/medicines [POST-MEDICINE-WEEKLY]', { headers: { Authorization: `Bearer ${addMedUserToken}` }, body: payload }, res.body, 'POST-MEDICINE-WEEKLY', 'User adds a WEEKLY medicine');
      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
    });

    it('should successfully create a CUSTOM interval medication', async () => {
      console.info(`
📖 BDD SCENARIO: 20-B. CREATE CUSTOM MEDICATION
Feature: Medicine Addition
  As a user
  I want to add a custom medication
  So I can take it every few days

  Given I provide valid details with CUSTOM frequency
  When I submit the form
  Then the system saves it successfully
`);
      const payload = {
        ...basePayload,
        name: 'Custom Med',
        frequency: { frequencyType: 'CUSTOM', interval: 2, intervalUnit: 'DAY' },
      };
      const res = await request(app).post('/api/v1/medicines').set('Authorization', `Bearer ${addMedUserToken}`).send(payload);
      logApi('POST', '/api/v1/medicines [POST-MEDICINE-CUSTOM]', { headers: { Authorization: `Bearer ${addMedUserToken}` }, body: payload }, res.body, 'POST-MEDICINE-CUSTOM', 'User adds a CUSTOM medicine');
      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
    });

    it('should successfully create a TABLET medication with isOngoing false and endDate', async () => {
      console.info(`
📖 BDD SCENARIO: 20-C. CREATE SHORT-TERM TABLET
Feature: Medicine Addition
  As a user
  I want to add a short-term tablet medication
  So I know when my prescription ends

  Given I provide isOngoing as false and an endDate
  When I submit the form
  Then the system saves it successfully and validates the end date
`);
      const payload = {
        ...basePayload,
        name: 'Short Term Tablet',
        type: 'TABLET',
        isOngoing: false,
        endDate: '2026-06-30',
        frequency: { frequencyType: 'DAILY' },
      };
      const res = await request(app).post('/api/v1/medicines').set('Authorization', `Bearer ${addMedUserToken}`).send(payload);
      logApi('POST', '/api/v1/medicines [POST-MEDICINE-TABLET-SHORT-TERM]', { headers: { Authorization: `Bearer ${addMedUserToken}` }, body: payload }, res.body, 'POST-MEDICINE-TABLET-SHORT-TERM', 'User adds a short-term TABLET medicine');
      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOngoing).toBe(false);
      expect(res.body.data.endDate).toBeDefined();
    });

  });

  describe('3. Medicine Tracking & Logs Flow', () => {
    let newMedicationId: string;

    beforeAll(async () => {
      if (!userToken) {
        // If running in isolation, create a dummy user and generate tokens
        const user = await User.create({
          name: 'Isolated Med User',
          email: 'isolated_med@test.com',
          password: 'TestPassword123!',
          role: USER_ROLES.USER,
          status: USER_STATUS.ACTIVE,
          isVerified: true,
          dateOfBirth: new Date('1990-01-01'),
        });
        userToken = jwtHelper.createToken(
          { id: user._id.toString(), role: user.role, email: user.email, tokenVersion: user.tokenVersion ?? 0 },
          config.jwt.jwt_secret as Secret,
          config.jwt.jwt_expire_in as string
        );
      } else {
        // Login again because previous test logged the user out
        const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'stayhide_updated_e2e@test.com', password: TEST_PASSWORD });
        userToken = loginRes.body.data.accessToken;
      }
    });

    it('should create a new medication successfully with strict real-world frontend payload', async () => {
      console.info(`
📖 BDD SCENARIO: 20. CREATE MEDICATION
Feature: Medicine Tracking
  As a logged-in user
  I want to add a new medication
  So I can track my daily doses

  Given the user submits valid medicine details
  When the request is sent to the backend
  Then the system validates and saves the medicine
`);
      const payload = {
        name: 'Vitamin D',
        dosage: { amount: 2000, unit: 'IU' },
        type: 'CAPSULE',
        startDate: '2026-06-24', // Real world frontend ISO format
        isOngoing: true,
        frequency: {
          frequencyType: 'DAILY'
        },
        dosingTimes: ['08:00', '20:00'],
        inventory: {
          totalQuantity: 60,
          remainingQuantity: 60,
          quantityPerDose: 1
        }
      };

      const res = await request(app)
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('POST', '/api/v1/medicines', { headers: { Authorization: `Bearer ${userToken}` }, body: payload }, res.body, 'POST-MEDICINE', 'User adds a new medicine');

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id || res.body.data.id).toBeDefined();
      newMedicationId = res.body.data._id || res.body.data.id;
    });

    it('should create additional medicines for the list view', async () => {
      const payloads = [
        {
          name: 'Napa Extend',
          dosage: { amount: 665, unit: 'mg' },
          type: 'TABLET',
          startDate: '2026-06-24',
          isOngoing: true,
          frequency: { frequencyType: 'AS_NEEDED' },
          dosingTimes: ['08:00']
        },
        {
          name: 'Cough Syrup',
          dosage: { amount: 10, unit: 'ml' },
          type: 'SYRUP',
          startDate: '2026-06-24',
          isOngoing: false,
          endDate: '2026-06-30',
          frequency: { frequencyType: 'DAILY' },
          dosingTimes: ['22:00']
        }
      ];

      for (const p of payloads) {
        await request(app)
          .post('/api/v1/medicines')
          .set('Authorization', `Bearer ${userToken}`)
          .send(p);
      }
    });

    it('should fetch all medicines for the user', async () => {
      console.info(`
📖 BDD SCENARIO: 20-D. GET ALL MEDICINES
Feature: Medicine Tracking
  As a user
  I want to see all my medicines
  So I can manage them from my pill box
`);
      const res = await request(app)
        .get('/api/v1/medicines')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/medicines', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-ALL-MEDICINES', 'User views all their medicines');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      const names = res.body.data.map((m: any) => m.name);
      expect(names).toContain('Vitamin D');
      expect(names).toContain('Napa Extend');
      expect(names).toContain('Cough Syrup');
    });

    it('should search and filter medicines by name and status', async () => {
      console.info(`
📖 BDD SCENARIO: 20-D.2 SEARCH & FILTER MEDICINES
Feature: Medicine Tracking
  As a user
  I want to search my medicines by name and filter by status
  So I can quickly find a specific prescription
`);
      // Search for "Vitamin D"
      const resSearch = await request(app)
        .get('/api/v1/medicines')
        .query({ searchTerm: 'Vitamin D' })
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/medicines', { headers: { Authorization: `Bearer ${userToken}` }, query: { searchTerm: 'Vitamin D' } }, resSearch.body, 'GET-SEARCH-MEDICINES', 'User searches medicines by name');

      expect(resSearch.status).toBe(StatusCodes.OK);
      expect(resSearch.body.success).toBe(true);
      const searchNames = resSearch.body.data.map((m: any) => m.name);
      expect(searchNames).toContain('Vitamin D');
      expect(searchNames).not.toContain('Cough Syrup');
      
      // Filter by ACTIVE status (which is default anyway)
      const resFilter = await request(app)
        .get('/api/v1/medicines')
        .query({ status: 'ACTIVE' })
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/medicines', { headers: { Authorization: `Bearer ${userToken}` }, query: { status: 'ACTIVE' } }, resFilter.body, 'GET-FILTER-MEDICINES', 'User filters medicines by status');

      expect(resFilter.status).toBe(StatusCodes.OK);
      expect(resFilter.body.success).toBe(true);
      expect(resFilter.body.data.length).toBeGreaterThanOrEqual(1);
      // Filter by Frequency (using the new alias freqType)
      const resFreq = await request(app)
        .get('/api/v1/medicines')
        .query({ freqType: 'DAILY' })
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/medicines', { headers: { Authorization: `Bearer ${userToken}` }, query: { freqType: 'DAILY' } }, resFreq.body, 'GET-FILTER-FREQ-MEDICINES', 'User filters medicines by frequency type');

      expect(resFreq.status).toBe(StatusCodes.OK);
      expect(resFreq.body.success).toBe(true);
      expect(resFreq.body.data.length).toBeGreaterThanOrEqual(1);
    });
    it('should update an existing medicine', async () => {
      console.info(`
📖 BDD SCENARIO: 20-E. UPDATE MEDICINE
Feature: Medicine Management
  As a user
  I want to edit the details of my medicine
  So I can keep my prescription and schedule up to date
`);
      const updatedPayload = {
        name: 'Vitamin D (Updated)',
        dosage: { amount: 3000, unit: 'IU' }
      };

      const res = await request(app)
        .patch(`/api/v1/medicines/${newMedicationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatedPayload);

      logApi('PATCH', '/api/v1/medicines/:medicineId', { headers: { Authorization: `Bearer ${userToken}` }, body: updatedPayload }, res.body, 'PATCH-MEDICINE', 'User updates a medicine');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updatedPayload.name);
      expect(res.body.data.dosage.amount).toBe(updatedPayload.dosage.amount);
    });
    it('should fetch today schedule correctly matching real-world frontend queries', async () => {
      console.info(`
📖 BDD SCENARIO: 21. GET TODAY SCHEDULE
Feature: Medicine Tracking
  As a user
  I want to see my schedule for today
  So I know what to take

  * Note: The response includes a 'compliment' string in the progress object based on taken/total:
    - "Perfect!" (if all taken)
    - "Enjoy your day!" (if none scheduled)
    - "Time for meds!" (if none taken yet)
    - "Good work!" (if partially taken)
`);
      // Frontend typically sends 'YYYY-MM-DD' and 'HH:MM'
      const date = '2026-06-24';
      const currentTime = '12:00'; // Assuming query at noon

      const res = await request(app)
        .get(`/api/v1/medicines/today?date=${date}&currentTime=${currentTime}`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/medicines/today', { headers: { Authorization: `Bearer ${userToken}` }, query: { date, currentTime } }, res.body, 'GET-TODAY-SCHEDULE', 'User views today schedule');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      // At noon, 08:00 is overdue, 20:00 and 22:00 are upcoming
      expect(res.body.data.overdue.length).toBe(1);
      expect(res.body.data.upcoming.length).toBe(2);
      expect(res.body.data.taken.length).toBe(0);
      expect(res.body.data.progress.total).toBe(3);
      expect(res.body.data.progress.compliment).toBeDefined();
    });

    it('should mark a dose as TAKEN and deduct inventory', async () => {
      console.info(`
📖 BDD SCENARIO: 22. MARK DOSE TAKEN (OR RETROACTIVE LOGGING)
Feature: Medicine Tracking & Logs
  As a user
  I want to accurately mark my medicine dose as TAKEN, SKIPPED, or MISSED
  So the system precisely tracks my history and deducts inventory.

  * UX Context & API Design Justification:
    - Why 'dateString' & 'scheduledTime'?: A user might take a medicine late, 
      or realize the next day they forgot to click "Take" in the app. 
      Sending the specific 'dateString' and 'scheduledTime' ensures the backend 
      logs the exact dose they meant to interact with, rather than guessing based on current time.
    - Retroactive Logging: This design allows users to navigate to past days in their history 
      and fix missed doses, creating a highly forgiving and robust UX.
    - Inventory Sync: Marking a dose as 'TAKEN' dynamically reduces 'remainingQuantity' by 'quantityPerDose'.
`);
      const payload = {
        medicationId: newMedicationId,
        dateString: '2026-06-24',
        scheduledTime: '08:00',
        status: 'TAKEN'
      };

      const res = await request(app)
        .post('/api/v1/medicines/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('POST', '/api/v1/medicines/logs', { headers: { Authorization: `Bearer ${userToken}` }, body: payload }, res.body, 'POST-MEDICINE-LOG-TAKEN', 'User marks dose as TAKEN');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('TAKEN');

      // Verify inventory deducted
      const medRes = await request(app).get(`/api/v1/medicines/${newMedicationId}`).set('Authorization', `Bearer ${userToken}`);
      expect(medRes.body.data.inventory.remainingQuantity).toBe(59); // 60 - 1
    });

    it('should refund inventory when user undoes TAKEN to SKIPPED', async () => {
      console.info(`
📖 BDD SCENARIO: 23. UNDO TAKEN TO SKIPPED
Feature: Medicine Tracking
  As a user
  I want to change a taken dose to skipped
  So the system refunds the inventory
`);
      const payload = {
        medicationId: newMedicationId,
        dateString: '2026-06-24',
        scheduledTime: '08:00',
        status: 'SKIPPED'
      };

      const res = await request(app)
        .post('/api/v1/medicines/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('POST', '/api/v1/medicines/logs (UNDO)', { headers: { Authorization: `Bearer ${userToken}` }, body: payload }, res.body, 'POST-MEDICINE-LOG-SKIPPED', 'User changes TAKEN to SKIPPED');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SKIPPED');

      // Verify inventory refunded
      const medRes = await request(app).get(`/api/v1/medicines/${newMedicationId}`).set('Authorization', `Bearer ${userToken}`);
      expect(medRes.body.data.inventory.remainingQuantity).toBe(60); // 59 + 1
    });

    it('should add logs for a different date to demonstrate multi-day history', async () => {
      const payload = {
        medicationId: newMedicationId,
        dateString: '2026-06-25', // Next day
        scheduledTime: '08:00',
        status: 'TAKEN'
      };

      await request(app)
        .post('/api/v1/medicines/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);
    });

    it('should fetch history properly grouped by date', async () => {
      console.info(`
📖 BDD SCENARIO: 24. GET HISTORY
Feature: Medicine Tracking
  As a user
  I want to see my medication history
`);
      const res = await request(app)
        .get(`/api/v1/medicines/history?startDate=2026-06-01&endDate=2026-06-30`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/medicines/history', { headers: { Authorization: `Bearer ${userToken}` }, query: { startDate: '2026-06-01', endDate: '2026-06-30' } }, res.body, 'GET-MEDICINE-HISTORY', 'User views history');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].logs).toBeDefined();
      }
    });

    it('should archive a medication and hide it from the active list', async () => {
      console.info(`
📖 BDD SCENARIO: 25. ARCHIVE MEDICATION
Feature: Medicine Tracking
  As a user
  I want to archive my medication
  So it no longer appears in my active list
`);
      const res = await request(app)
        .patch(`/api/v1/medicines/${newMedicationId}/archive`)
        .set('Authorization', `Bearer ${userToken}`);
      logApi('PATCH', '/api/v1/medicines/:medicineId/archive', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'PATCH-MEDICINE-ARCHIVE', 'User archives a medication');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ARCHIVED'); // assuming the status changes to ARCHIVED, or it sets isArchived to true

      // Verify it's not in the main list anymore
      const getRes = await request(app)
        .get('/api/v1/medicines')
        .set('Authorization', `Bearer ${userToken}`);
      
      const archivedMed = getRes.body.data.find((m: any) => m._id === newMedicationId || m.id === newMedicationId);
      expect(archivedMed).toBeUndefined(); // Assuming GET /api/v1/medicines filters out archived meds
    });

    it('should automatically mark missed doses via cron endpoint', async () => {
      console.info(`
📖 BDD SCENARIO: 26. AUTOMATED MISSED DOSES (CRON)
Feature: Medicine Tracking
  As a system administrator
  I want to run a nightly cron job
  So that any active medicines that were not taken are automatically marked as MISSED
`);
      // Create a dedicated SUPER_ADMIN user for this test to avoid conflicts
      const adminUser = await mongoose.model('User').create({
        name: 'Cron Admin',
        email: `cron_admin_${Date.now()}@test.com`,
        password: 'AdminPassword123!',
        role: USER_ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
        isVerified: true,
        dateOfBirth: new Date('1980-01-01'),
      });

      const adminToken = jwtHelper.createToken(
        { id: adminUser._id.toString(), role: adminUser.role, email: adminUser.email, tokenVersion: adminUser.tokenVersion ?? 0 },
        config.jwt.jwt_secret as Secret,
        config.jwt.jwt_expire_in as string
      );

      const payload = {
        dateString: '2026-06-23' // Pick a past date
      };

      const res = await request(app)
        .post('/api/v1/medicines/cron/mark-missed')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      logApi('POST', '/api/v1/medicines/cron/mark-missed', { headers: { Authorization: `Bearer ${adminToken}` }, body: payload }, res.body, 'POST-CRON-MISSED', 'System automatically marks missed doses');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.missedLogsCreated).toBeDefined();
    });

  });

  describe('4. Legal Pages Flow', () => {
    let adminToken: string;
    let createdSlug = '';

    beforeAll(async () => {
      // Create admin for legal pages
      const adminUser = await mongoose.model('User').create({
        name: 'Legal Admin',
        email: `legal_admin_${Date.now()}@test.com`,
        password: 'AdminPassword123!',
        role: USER_ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
        isVerified: true,
        dateOfBirth: new Date('1980-01-01'),
      });

      adminToken = jwtHelper.createToken(
        { id: adminUser._id.toString(), role: adminUser.role, email: adminUser.email, tokenVersion: adminUser.tokenVersion ?? 0 },
        config.jwt.jwt_secret as Secret,
        config.jwt.jwt_expire_in as string
      );
    });

    it('should create a new legal page (Admin)', async () => {
      console.info(`
📖 BDD SCENARIO: 25. CREATE LEGAL PAGE
Feature: Legal Pages
  As an admin
  I want to create a legal page (e.g., Privacy Policy)
  So that users can read it
`);
      const payload = {
        title: 'Privacy Policy',
        content: '<p>This is our privacy policy...</p>',
        status: 'PUBLISHED'
      };

      const res = await request(app)
        .post('/api/v1/legal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      logApi('POST', '/api/v1/legal', { headers: { Authorization: `Bearer ${adminToken}` }, body: payload }, res.body, 'POST-LEGAL', 'Admin creates a legal page');

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('privacy-policy');
      createdSlug = res.body.data.slug;
    });

    it('should fetch all legal pages', async () => {
      console.info(`
📖 BDD SCENARIO: 26. GET ALL LEGAL PAGES
Feature: Legal Pages
  As a user
  I want to see all legal pages available
  So that I can read the policies
`);
      const res = await request(app)
        .get('/api/v1/legal');

      logApi('GET', '/api/v1/legal', {}, res.body, 'GET-LEGAL-ALL', 'Fetch all legal pages');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should fetch a single legal page by slug', async () => {
      console.info(`
📖 BDD SCENARIO: 27. GET LEGAL PAGE BY SLUG
Feature: Legal Pages
  As a user
  I want to fetch a specific legal page by its slug
  So that I can read its content
`);
      const res = await request(app)
        .get(`/api/v1/legal/${createdSlug}`);

      logApi('GET', '/api/v1/legal/:slug', {}, res.body, 'GET-LEGAL-SINGLE', 'Fetch single legal page by slug');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Privacy Policy');
    });

    it('should update a legal page (Admin)', async () => {
      console.info(`
📖 BDD SCENARIO: 28. UPDATE LEGAL PAGE
Feature: Legal Pages
  As an admin
  I want to update an existing legal page
  So that the policies remain up to date
`);
      const payload = {
        content: '<p>Updated privacy policy content...</p>'
      };

      const res = await request(app)
        .patch(`/api/v1/legal/${createdSlug}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      logApi('PATCH', '/api/v1/legal/:slug', { headers: { Authorization: `Bearer ${adminToken}` }, body: payload }, res.body, 'PATCH-LEGAL', 'Admin updates a legal page');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe(payload.content);
    });

    it('should delete a legal page (Admin)', async () => {
      console.info(`
📖 BDD SCENARIO: 29. DELETE LEGAL PAGE
Feature: Legal Pages
  As an admin
  I want to delete a legal page
  So that outdated policies are removed
`);
      const res = await request(app)
        .delete(`/api/v1/legal/${createdSlug}`)
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('DELETE', '/api/v1/legal/:slug', { headers: { Authorization: `Bearer ${adminToken}` } }, res.body, 'DELETE-LEGAL', 'Admin deletes a legal page');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

  });

  describe('6. Symptom Tracker Flow', () => {
    beforeAll(async () => {
      if (!userToken) {
        // If running in isolation, create a dummy user and generate tokens
        const user = await User.create({
          name: 'Isolated Symptom User',
          email: 'isolated_symptom@test.com',
          password: TEST_PASSWORD,
          role: USER_ROLES.USER,
          status: USER_STATUS.ACTIVE,
          isVerified: true,
          dateOfBirth: new Date('1990-01-01'),
        });
        testUserId = user._id.toString();
        testUserEmail = user.email;

        userToken = jwtHelper.createToken(
          { id: testUserId, role: user.role, email: user.email, tokenVersion: user.tokenVersion ?? 0 },
          config.jwt.jwt_secret as Secret,
          config.jwt.jwt_expire_in as string
        );
      } else {
        // Login again because a previous test might have logged the user out
        const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'stayhide_updated_e2e@test.com', password: TEST_PASSWORD });
        if (loginRes.body.success) {
          userToken = loginRes.body.data.accessToken;
        }
      }
    });


    it("should upsert today's symptom log", async () => {
      console.info(`
📖 BDD SCENARIO: 30. UPSERT SYMPTOM LOG
Feature: Symptom Tracking
  As a user
  I want to log my symptoms for today
  So that I can monitor my health patterns over time

  Given the user submits a valid symptom log
  When the backend receives the log for the current date
  Then it should create or overwrite the log for that date
`);
      const todayDate = dayjs().format('YYYY-MM-DD');
      const logData = {
        hotFlashes: { count: 3, severity: 4 },
        nightSweats: { severity: 5 },
        mood: { value: 'bad', severity: 4 },
        sleep: { hours: 6.5, quality: 2 },
        brainFog: { severity: 3 },
        jointPain: { severity: 2 },
        fatigue: { severity: 4 },
        anxiety: { severity: 3 },
        additionalNotes: 'Felt very tired today.',
      };

      const res = await request(app)
        .put(`/api/v1/symptom-logs/${todayDate}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(logData);

      logApi('PUT', '/api/v1/symptom-logs/:date', { headers: { Authorization: `Bearer ${userToken}` }, body: logData }, res.body, 'PUT-SYMPTOM-LOG', 'Upsert symptom log');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.date).toBe(todayDate);
      expect(res.body.data.hotFlashes.count).toBe(3);
    });



    it("should fetch a specific day's log", async () => {
      console.info(`
📖 BDD SCENARIO: 32. FETCH SYMPTOM LOG
Feature: Symptom Tracking
  As a user
  I want to fetch my symptom log for a specific date
  So that I can review my past entries

  Given the user has previously logged symptoms for a date
  When they request that specific date
  Then the backend should return the correct log details
`);
      const todayDate = dayjs().format('YYYY-MM-DD');
      const res = await request(app)
        .get(`/api/v1/symptom-logs/${todayDate}`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/symptom-logs/:date', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SYMPTOM-LOG', 'Fetch single symptom log');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.date).toBe(todayDate);
    });

    it('should fetch symptom trends dynamically (7, 14, or 30 days)', async () => {
      console.info(`
📖 BDD SCENARIO: 33. FETCH SYMPTOM TRENDS
Feature: Symptom Trend Analysis
  As a user
  I want to view my symptom trends over a specific time range (7, 14, or 30 days)
  So that I can see how my health is changing over short and long periods

  Given the user has multiple logs in the system
  When they request their trends with a specific 'days' parameter (e.g., ?days=7, ?days=14, ?days=30)
  Then the backend should return the logs for that exact period, sorted chronologically
`);
      // Seed some past data to ensure trends return the right records
      await SymptomLog.create([
        {
          user: testUserId,
          date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
          hotFlashes: { count: 1, severity: 1 },
          sleep: { hours: 7, quality: 4 },
          mood: { value: 'good' },
        },
        {
          user: testUserId,
          date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
          sleep: { hours: 6, quality: 3 },
          fatigue: { severity: 2 },
          mood: { value: 'neutral' },
        },
        {
          user: testUserId,
          date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
          nightSweats: { severity: 3 },
          anxiety: { severity: 4 },
          mood: { value: 'bad' },
        },
        {
          user: testUserId,
          date: dayjs().subtract(4, 'day').format('YYYY-MM-DD'),
          jointPain: { severity: 1 },
          brainFog: { severity: 2 },
          mood: { value: 'good' },
        },
        {
          user: testUserId,
          date: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
          hotFlashes: { count: 2, severity: 2 },
          sleep: { hours: 8, quality: 5 },
          mood: { value: 'excellent' },
        },
        {
          user: testUserId,
          date: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
          fatigue: { severity: 1 },
          mood: { value: 'neutral' },
        },
        {
          user: testUserId,
          date: dayjs().subtract(15, 'day').format('YYYY-MM-DD'), // Older than 7 days
          hotFlashes: { count: 10, severity: 5 },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/symptom-logs/trends?days=7')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/symptom-logs/trends?days=7', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SYMPTOM-TRENDS', 'Fetch symptom trends');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs.length).toBeGreaterThanOrEqual(3); // Today, 1 day ago, 5 days ago
    });




  });

  describe('7. Diet Food Tracking Flow', () => {
    let testDietLogId: string;
    const testDate = dayjs().format('YYYY-MM-DD');

    beforeAll(async () => {
      if (!userToken) {
        // Fallback login for isolated test runs
        const fallbackUser = await User.create({
          name: 'Diet Tester',
          email: 'diet_isolation@test.com',
          password: 'Password123!',
          dateOfBirth: '1990-01-01T00:00:00.000Z',
          status: 'ACTIVE',
          tokenVersion: 0,
        });
        userToken = jwtHelper.createToken(
          {
            id: fallbackUser._id.toString(),
            role: 'USER',
            email: fallbackUser.email,
            tokenVersion: fallbackUser.tokenVersion,
          },
          config.jwt.jwt_secret as Secret,
          config.jwt.jwt_expire_in as string
        );
      }
    });

    it('should create a new diet log', async () => {
      console.info(`
📖 BDD SCENARIO: 34. CREATE DIET LOG
Feature: Diet Food Tracking
  As a user
  I want to log my daily meals
  So that I can keep track of my nutrition

  Given I provide valid meal details
  When I submit the request to create a diet log
  Then the system saves the meal and returns success
`);
      const payload = {
        date: testDate,
        mealType: 'BREAKFAST',
        name: 'Oatmeal and Banana',
        note: 'Healthy start'
      };

      const res = await request(app)
        .post('/api/v1/diet-logs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('POST', '/api/v1/diet-logs', { headers: { Authorization: `Bearer ${userToken}` }, body: payload }, res.body, 'CREATE-DIET-LOG', 'Create a diet log entry');

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(payload.name);
      testDietLogId = res.body.data.id;
    });

    it('should fetch diet logs for a specific date', async () => {
      console.info(`
📖 BDD SCENARIO: 35. FETCH DIET LOGS BY DATE
Feature: Diet Food Tracking
  As a user
  I want to see what I ate on a specific day
  So that I can review my daily intake

  Given I have logged meals for a date
  When I request GET /api/v1/diet-logs?date=YYYY-MM-DD
  Then the system returns a list of meals exclusively for that date
`);
      const res = await request(app)
        .get(`/api/v1/diet-logs?date=${testDate}`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/diet-logs?date=YYYY-MM-DD', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-DIET-LOGS-BY-DATE', 'Fetch diet logs for a date');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should fetch diet history', async () => {
      console.info(`
📖 BDD SCENARIO: 36. FETCH DIET HISTORY (DATE RANGE)
Feature: Diet Food Tracking
  As a user
  I want to see my meal history over a period of time
  So that I can track my long-term eating habits

  Given I have logged meals over several days
  When I request GET /api/v1/diet-logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  Then the system returns my past meals chronologically within that date range
  And if no dates are provided, it defaults to the last 7 days
`);
      const res = await request(app)
        .get(`/api/v1/diet-logs`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/diet-logs', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-DIET-HISTORY', 'Fetch diet log history');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should update a diet log', async () => {
      console.info(`
📖 BDD SCENARIO: 37. UPDATE DIET LOG
Feature: Diet Food Tracking
  As a user
  I want to edit a past meal entry
  So that I can fix any mistakes in my log

  Given I have an existing diet log
  When I submit updated details for the meal
  Then the system updates the record and returns the new data
`);
      const payload = {
        name: 'Oatmeal with Blueberries',
      };

      const res = await request(app)
        .put(`/api/v1/diet-logs/${testDietLogId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      logApi('PUT', '/api/v1/diet-logs/:dietLogId', { headers: { Authorization: `Bearer ${userToken}` }, body: payload }, res.body, 'UPDATE-DIET-LOG', 'Update a diet log entry');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(payload.name);
    });

    it('should delete a diet log', async () => {
      console.info(`
📖 BDD SCENARIO: 38. DELETE DIET LOG
Feature: Diet Food Tracking
  As a user
  I want to remove a meal entry
  So that I can delete accidental or duplicate logs

  Given I have an existing diet log
  When I send a delete request for that meal
  Then the system removes the record from my history
`);
      const res = await request(app)
        .delete(`/api/v1/diet-logs/${testDietLogId}`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('DELETE', '/api/v1/diet-logs/:dietLogId', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'DELETE-DIET-LOG', 'Delete a diet log entry');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });
    it('should generate diet insights', async () => {
      console.info(`
📖 BDD SCENARIO: 39. GENERATE DIET INSIGHTS
Feature: Diet Food Tracking (Statistical Correlation Algorithm)
  As a user
  I want to see mathematical insights about my diet and symptoms
  So that I can identify super accurate food triggers

  Background Details (Why 30 Days?):
    - 7 or 14 days is mathematically insufficient to prove a correlation and filter out noise. 
    - Therefore, the algorithm strictly analyzes the last 30 days of data.
    - A keyword/food must be eaten at least 3 times in 30 days to be considered (Noise Reduction).
  
  Algorithm Logic (Trigger Power):
    - System calculates the Average Symptom Severity on days the food was EATEN.
    - System calculates the Average Symptom Severity on days the food was NOT EATEN.
    - Trigger Power = (Avg With Food) - (Avg Without Food)
    - If Trigger Power > 1.5, it is a HIGH RISK TRIGGER.
    - If Trigger Power < -1.5, it is a SAFE SOOTHING FOOD.

  Given I have logged meals and symptoms over the last 30 days
  When I request diet insights
  Then the system tokenizes the food names, removing stop words
  And calculates the Trigger Power for each food and symptom
  And returns high risk triggers and safe foods
`);

      // Seed 30 days of data
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        // Let's add coffee on 5 specific days (e.g. i = 1, 5, 10, 15, 20)
        const isCoffeeDay = [1, 5, 10, 15, 20].includes(i);
        
        await request(app)
          .post('/api/v1/diet-logs')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            date: dateStr,
            mealType: 'BREAKFAST',
            name: isCoffeeDay ? 'Coffee with milk' : 'Oatmeal',
            note: 'Test data'
          });

        // Add corresponding symptom log. High anxiety if coffee was consumed today or yesterday
        // Let's just put high anxiety on the coffee day itself.
        const symRes = await request(app)
          .put(`/api/v1/symptom-logs/${dateStr}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            anxiety: { severity: isCoffeeDay ? 5 : 1 },
            fatigue: { severity: 1 }
          });
        
        if (symRes.status !== 200) {
          console.error('Failed to create symptom log:', symRes.body);
        }
      }

      const res = await request(app)
        .get(`/api/v1/diet-logs/insights`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/diet-logs/insights', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-DIET-INSIGHTS', 'Generate statistical insights for diet vs symptoms');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('timeframe');
      expect(res.body.data).toHaveProperty('highRiskTriggers');
      expect(res.body.data).toHaveProperty('safeFoods');

      // Assert that coffee is a high risk trigger for anxiety
      const triggers = res.body.data.highRiskTriggers;
      const coffeeTrigger = triggers.find((t: any) => t.food === 'coffee' && t.symptom === 'anxiety');
      
      expect(coffeeTrigger).toBeDefined();
      expect(coffeeTrigger.type).toBe('HIGH_RISK_TRIGGER');
    });
    it('should generate a daily symptom summary', async () => {
      console.info(`
📖 BDD SCENARIO: 40. GET DAILY SYMPTOM SUMMARY
Feature: Symptom Log Daily Summary
  As a user
  I want to see a daily summary of my symptoms
  So that I can quickly assess my wellness score and top symptoms for a specific day

  Background Details (Scoring Logic):
    - Wellness Score is calculated out of 10.
    - It factors in Sleep Quality, Mood, and the combined severity of physical symptoms.
    - The API isolates the data for a single specific date.
    - It identifies the top 3 most severe symptoms.
    - Generates dynamic text insights based on the score and symptoms.

  Given I have logged symptoms for today
  When I request the daily summary
  Then the system calculates my wellness score (out of 10)
  And returns the top symptoms sorted by severity
  And returns personalized insights
`);

      const today = new Date().toISOString().split('T')[0];

      // Ensure a symptom log exists for today
      await request(app)
        .put(`/api/v1/symptom-logs/${today}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          anxiety: { severity: 5 },
          fatigue: { severity: 3 },
          mood: { value: 'bad' },
          sleep: { hours: 4, quality: 2 }
        });

      const res = await request(app)
        .get(`/api/v1/symptom-logs/summary/${today}`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', `/api/v1/symptom-logs/summary/${today}`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-DAILY-SUMMARY', 'Get daily symptom summary and wellness score');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const data = res.body.data;
      expect(data.date).toBe(today);
      expect(data).toHaveProperty('wellnessScore');
      expect(data).toHaveProperty('topSymptoms');
      expect(data.insights.length).toBeGreaterThan(0);
      
      // Since anxiety was 5, it should be the top symptom
      expect(data.topSymptoms[0].name).toBe('anxiety');
      expect(data.topSymptoms[0].severity).toBe(5);
    });
  });
  
  describe('8. AI Coach Flow', () => {
    beforeAll(async () => {
      if (!userToken) {
        // Create an isolated user and token if this test suite is run independently
        const mockUser = await User.create({
          name: 'AI Test User',
          email: `ai_isolated_${Date.now()}@test.com`,
          password: TEST_PASSWORD,
          dateOfBirth: new Date('1990-01-01'), // Add required field
          role: USER_ROLES.USER,
          status: USER_STATUS.ACTIVE,
        });
        testUserId = mockUser._id.toString();
        userToken = jwtHelper.createToken(
          { id: testUserId, role: USER_ROLES.USER, email: mockUser.email },
          config.jwt.jwt_secret as string,
          config.jwt.jwt_expire_in as string
        );
      }
    });

    let aiSessionId: string;

    it('should send a message to Miranda and create a new session', async () => {
      console.info(`
📖 BDD SCENARIO: 41. START NEW CHAT WITH MIRANDA
Feature: AI Menopause Coach
  As a user
  I want to start a new chat with an AI coach
  So that I can get advice on a new topic

  Given I have a new question
  When I send a message without a sessionId
  Then a new session is created and she responds empathetically
`);

      const res = await request(app)
        .post('/api/v1/ai-coach/message')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: "What's different about surgical menopause?" });

      logApi('POST', '/api/v1/ai-coach/message', { body: { message: "What's different about surgical menopause?" }, headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-AI-MESSAGE-NEW', 'Start a new chat with Miranda');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('sessionId');
      expect(res.body.data.isNewSession).toBe(true);
      expect(res.body.data.message.role).toBe('assistant');
      expect(res.body.data.message.content).toBeDefined();

      aiSessionId = res.body.data.sessionId; // Save for next tests
    });

    it('should continue an existing chat with Miranda', async () => {
      console.info(`
📖 BDD SCENARIO: 42. CONTINUE CHAT WITH MIRANDA
Feature: AI Menopause Coach
  As a user
  I want to continue my existing chat
  So that Miranda remembers the context

  Given I have an ongoing chat session
  When I send a message with a sessionId
  Then she should respond considering previous context
`);

      const res = await request(app)
        .post('/api/v1/ai-coach/message')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: "How do I manage it?", sessionId: aiSessionId });

      logApi('POST', '/api/v1/ai-coach/message', { body: { message: "How do I manage it?", sessionId: aiSessionId }, headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-AI-MESSAGE-CONTINUE', 'Continue chat with Miranda');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isNewSession).toBe(false);
      expect(res.body.data.sessionId).toBe(aiSessionId);
    });

    it('should retrieve all chat sessions', async () => {
      console.info(`
📖 BDD SCENARIO: 43. GET ALL CHAT SESSIONS
Feature: AI Menopause Coach
  As a user
  I want to view my past conversation threads
  So that I can see the list of topics I discussed

  Given I have previously chatted with Miranda
  When I request my chat sessions
  Then I should see a list of session titles and IDs
`);

      const res = await request(app)
        .get('/api/v1/ai-coach/sessions')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/ai-coach/sessions', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-AI-SESSIONS', 'Retrieve list of chat sessions');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const sessions = res.body.data;
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions[0].title).toBeDefined();
      expect(sessions[0]._id || sessions[0].id).toBe(aiSessionId);
    });

    it('should retrieve the full chat history of a specific session', async () => {
      console.info(`
📖 BDD SCENARIO: 44. GET CHAT HISTORY BY ID
Feature: AI Menopause Coach
  As a user
  I want to open a specific past conversation
  So that I can read the detailed advice

  Given I have a specific chat session ID
  When I request the session details
  Then I should see the full list of messages in that thread
`);

      const res = await request(app)
        .get(`/api/v1/ai-coach/sessions/${aiSessionId}`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', `/api/v1/ai-coach/sessions/:sessionId`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-AI-SESSION-BY-ID', 'Retrieve full chat history');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const session = res.body.data;
      expect(session._id || session.id).toBe(aiSessionId);
      expect(Array.isArray(session.messages)).toBe(true);
      // System prompt + 2 user messages + 2 AI responses = 5 messages
      expect(session.messages.length).toBeGreaterThanOrEqual(5);
    });
  });

});
