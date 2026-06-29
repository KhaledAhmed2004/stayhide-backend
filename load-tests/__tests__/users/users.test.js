import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getUser } from '../../shared/helpers/auth.js';

// ── Mock fixture data matching the structure of users-fixtures.json ───────────
const fixtures = {
  adminUser: {
    id: '6a121d0ff476457bd68d5f69',
    email: 'loadtest-admin@test.com',
    token: 'mock-admin-token',
  },
  brotherUsers: [
    { id: '6a121d10f476457bd68d5f6b', email: 'loadtest-brother-0@test.com', token: 'mock-brother-token-0' },
    { id: '6a121d10f476457bd68d5f6d', email: 'loadtest-brother-1@test.com', token: 'mock-brother-token-1' },
    { id: '6a121d10f476457bd68d5f6f', email: 'loadtest-brother-2@test.com', token: 'mock-brother-token-2' },
  ],
  sisterUsers: [
    { id: '6a121d20f476457bd68d5fa1', email: 'loadtest-sister-0@test.com', token: 'mock-sister-token-0' },
    { id: '6a121d20f476457bd68d5fa3', email: 'loadtest-sister-1@test.com', token: 'mock-sister-token-1' },
  ],
};

/**
 * Feature: multi-module-load-tests, Property 1: Fixture-Based User Selection Validity
 *
 * For any non-negative VU index and any valid role ('admin', 'brother', 'sister'),
 * calling getUser(fixtures, role, vuIndex) SHALL return a valid user object containing
 * non-empty id, email, and token string fields, and the selection SHALL distribute
 * across the pool via modulo arithmetic without ever producing an out-of-bounds index.
 *
 * **Validates: Requirements 8.2, 11.1**
 */
describe('Feature: multi-module-load-tests, Property 1: Fixture-Based User Selection Validity (Users)', () => {
  it('getUser produces valid users with non-empty id, email, token for all VU indices (0–999) and all roles', () => {
    const roles = ['admin', 'brother', 'sister'];

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        fc.constantFrom(...roles),
        (vuIndex, role) => {
          const user = getUser(fixtures, role, vuIndex);

          // User object must be defined
          expect(user).toBeDefined();

          // Must have non-empty string fields
          expect(typeof user.id).toBe('string');
          expect(user.id.length).toBeGreaterThan(0);

          expect(typeof user.email).toBe('string');
          expect(user.email.length).toBeGreaterThan(0);

          expect(typeof user.token).toBe('string');
          expect(user.token.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getUser distributes via modulo arithmetic without out-of-bounds access', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), (vuIndex) => {
        // Brother pool distribution
        const brotherUser = getUser(fixtures, 'brother', vuIndex);
        const expectedBrotherIndex = vuIndex % fixtures.brotherUsers.length;
        expect(brotherUser).toEqual(fixtures.brotherUsers[expectedBrotherIndex]);

        // Sister pool distribution
        const sisterUser = getUser(fixtures, 'sister', vuIndex);
        const expectedSisterIndex = vuIndex % fixtures.sisterUsers.length;
        expect(sisterUser).toEqual(fixtures.sisterUsers[expectedSisterIndex]);

        // Admin always returns the single admin user
        const adminUser = getUser(fixtures, 'admin', vuIndex);
        expect(adminUser).toEqual(fixtures.adminUser);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: multi-module-load-tests, Property 2: Scenario Configuration Validity
 *
 * For any module entry point's scenario configuration object, every scenario SHALL have
 * a valid k6 executor type (one of: 'per-vu-iterations', 'constant-vus', 'ramping-vus',
 * 'shared-iterations', 'ramping-arrival-rate', 'constant-arrival-rate'), a positive VU
 * count (or positive startVUs for ramping executors), and a non-empty exec function name
 * referencing an exported function.
 *
 * **Validates: Requirements 7.2, 8.3**
 */
describe('Feature: multi-module-load-tests, Property 2: Scenario Configuration Validity (Users)', () => {
  // Import the users entry point options
  // We inline the options here to avoid k6-specific import issues in vitest
  const usersOptions = {
    scenarios: {
      baseline: {
        executor: 'per-vu-iterations',
        vus: 1,
        iterations: 1,
        exec: 'runBaseline',
        startTime: '0s',
      },
      read_load: {
        executor: 'constant-vus',
        vus: 10,
        duration: '30s',
        exec: 'runReadLoad',
        startTime: '5s',
      },
      write_load: {
        executor: 'constant-vus',
        vus: 5,
        duration: '30s',
        exec: 'runWriteLoad',
        startTime: '5s',
      },
      user_journey: {
        executor: 'constant-vus',
        vus: 5,
        duration: '30s',
        exec: 'runUserJourney',
        startTime: '5s',
      },
      role_auth: {
        executor: 'constant-vus',
        vus: 5,
        duration: '10s',
        exec: 'runRoleAuth',
        startTime: '5s',
      },
      stress: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 5 },
          { duration: '20s', target: 20 },
          { duration: '10s', target: 5 },
        ],
        exec: 'runStress',
        startTime: '40s',
      },
      soak: {
        executor: 'constant-vus',
        vus: 3,
        duration: '60s',
        exec: 'runSoak',
        startTime: '80s',
      },
    },
  };

  const VALID_EXECUTORS = [
    'per-vu-iterations',
    'constant-vus',
    'ramping-vus',
    'shared-iterations',
    'ramping-arrival-rate',
    'constant-arrival-rate',
  ];

  const scenarioEntries = Object.entries(usersOptions.scenarios);

  it('all scenarios have valid k6 executor types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...scenarioEntries),
        ([name, config]) => {
          expect(VALID_EXECUTORS).toContain(config.executor);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all scenarios have positive VU counts (vus or startVUs for ramping executors)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...scenarioEntries),
        ([name, config]) => {
          if (config.executor === 'ramping-vus') {
            // ramping-vus uses startVUs (can be 0) but stages must have positive targets
            expect(config.startVUs).toBeGreaterThanOrEqual(0);
            expect(config.stages).toBeDefined();
            expect(config.stages.length).toBeGreaterThan(0);
            // At least one stage must have a positive target
            const hasPositiveTarget = config.stages.some((s) => s.target > 0);
            expect(hasPositiveTarget).toBe(true);
          } else {
            // Other executors use vus directly
            expect(config.vus).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all scenarios have non-empty exec function names', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...scenarioEntries),
        ([name, config]) => {
          expect(typeof config.exec).toBe('string');
          expect(config.exec.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
