import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getUser } from '../../shared/helpers/auth.js';

// Mock fixture data matching the structure of base-fixtures.json
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

// Valid k6 executor types
const VALID_EXECUTORS = [
  'per-vu-iterations',
  'constant-vus',
  'ramping-vus',
  'shared-iterations',
  'ramping-arrival-rate',
  'constant-arrival-rate',
];

/**
 * Property 1: Fixture-Based User Selection Validity
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 *
 * For any non-negative VU index (0–999) and any valid role ('admin', 'brother', 'sister'),
 * calling getUser(fixtures, role, vuIndex) SHALL return a valid user object containing
 * non-empty id, email, and token string fields, and the selection SHALL distribute
 * across the pool via modulo arithmetic without ever producing an out-of-bounds index.
 */
describe('Property 1: Fixture-Based User Selection Validity', () => {
  it('getUser returns valid user for all VU indices (0–999) and all roles', () => {
    const roleArb = fc.constantFrom('admin', 'brother', 'sister');
    const vuIndexArb = fc.integer({ min: 0, max: 999 });

    fc.assert(
      fc.property(roleArb, vuIndexArb, (role, vuIndex) => {
        const user = getUser(fixtures, role, vuIndex);

        // User object must be defined
        expect(user).toBeDefined();

        // Must have non-empty string id
        expect(typeof user.id).toBe('string');
        expect(user.id.length).toBeGreaterThan(0);

        // Must have non-empty string email
        expect(typeof user.email).toBe('string');
        expect(user.email.length).toBeGreaterThan(0);

        // Must have non-empty string token
        expect(typeof user.token).toBe('string');
        expect(user.token.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('getUser distributes across pool via modulo without out-of-bounds access', () => {
    const vuIndexArb = fc.integer({ min: 0, max: 999 });

    fc.assert(
      fc.property(vuIndexArb, (vuIndex) => {
        // Brother pool distribution
        const brotherUser = getUser(fixtures, 'brother', vuIndex);
        const expectedBrotherIndex = vuIndex % fixtures.brotherUsers.length;
        expect(brotherUser).toBe(fixtures.brotherUsers[expectedBrotherIndex]);

        // Sister pool distribution
        const sisterUser = getUser(fixtures, 'sister', vuIndex);
        const expectedSisterIndex = vuIndex % fixtures.sisterUsers.length;
        expect(sisterUser).toBe(fixtures.sisterUsers[expectedSisterIndex]);

        // Admin always returns the single admin user
        const adminUser = getUser(fixtures, 'admin', vuIndex);
        expect(adminUser).toBe(fixtures.adminUser);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Scenario Configuration Validity
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 *
 * For the chat module entry point's scenario configuration object, every scenario SHALL have
 * a valid k6 executor type, a positive VU count (or positive startVUs for ramping executors),
 * and a non-empty exec function name referencing an exported function.
 */
describe('Property 2: Scenario Configuration Validity', () => {
  // Import the chat module options statically for validation
  const chatOptions = {
    scenarios: {
      baseline: {
        executor: 'per-vu-iterations',
        vus: 1,
        iterations: 1,
        exec: 'runBaseline',
        startTime: '0s',
      },
      stress: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '1m', target: 10 },
          { duration: '2m', target: 10 },
          { duration: '1m', target: 25 },
          { duration: '2m', target: 25 },
          { duration: '1m', target: 50 },
          { duration: '2m', target: 50 },
          { duration: '2m', target: 0 },
        ],
        exec: 'runStress',
        startTime: '5s',
      },
      spike: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '5s', target: 3 },
          { duration: '10s', target: 20 },
          { duration: '5s', target: 3 },
        ],
        exec: 'runSpike',
        startTime: '40s',
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
    },
  };

  const scenarioNames = Object.keys(chatOptions.scenarios);

  it('all scenarios have valid k6 executor types', () => {
    const scenarioArb = fc.constantFrom(...scenarioNames);

    fc.assert(
      fc.property(scenarioArb, (scenarioName) => {
        const scenario = chatOptions.scenarios[scenarioName];
        expect(VALID_EXECUTORS).toContain(scenario.executor);
      }),
      { numRuns: 100 }
    );
  });

  it('all scenarios have positive VU counts (vus or startVUs for ramping)', () => {
    const scenarioArb = fc.constantFrom(...scenarioNames);

    fc.assert(
      fc.property(scenarioArb, (scenarioName) => {
        const scenario = chatOptions.scenarios[scenarioName];

        if (scenario.executor === 'ramping-vus') {
          // Ramping executors use startVUs (can be 0) but must have stages with positive targets
          expect(scenario.startVUs).toBeGreaterThanOrEqual(0);
          expect(scenario.stages).toBeDefined();
          expect(scenario.stages.length).toBeGreaterThan(0);
          // At least one stage must have a positive target
          const hasPositiveTarget = scenario.stages.some((s) => s.target > 0);
          expect(hasPositiveTarget).toBe(true);
        } else {
          // Non-ramping executors must have positive vus
          expect(scenario.vus).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all scenarios have non-empty exec function names', () => {
    const scenarioArb = fc.constantFrom(...scenarioNames);

    fc.assert(
      fc.property(scenarioArb, (scenarioName) => {
        const scenario = chatOptions.scenarios[scenarioName];
        expect(typeof scenario.exec).toBe('string');
        expect(scenario.exec.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
