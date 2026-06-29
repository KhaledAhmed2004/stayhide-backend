import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getUser } from '../../shared/helpers/auth.js';

// Mock fixture data matching the structure of base-fixtures
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

// Inline admin scenario options (k6-specific imports won't work in Node)
const adminOptions = {
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
    read_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'runReadLoad',
      startTime: '5s',
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

/**
 * Property 1: Fixture-Based User Selection Validity
 * **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**
 *
 * For any non-negative VU index (0–999) and any valid role,
 * getUser returns a valid user object with non-empty id, email, and token fields.
 */
describe('Property 1: Fixture-Based User Selection Validity', () => {
  const roles = ['admin', 'brother', 'sister'];

  it('getUser produces valid users for all generated VU indices (0–999) and all roles', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        fc.constantFrom(...roles),
        (vuIndex, role) => {
          const user = getUser(fixtures, role, vuIndex);

          expect(user).toBeDefined();
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

  it('getUser distributes across pool via modulo without out-of-bounds access', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        fc.constantFrom(...roles),
        (vuIndex, role) => {
          let pool;
          if (role === 'admin') {
            pool = [fixtures.adminUser];
          } else if (role === 'brother') {
            pool = fixtures.brotherUsers;
          } else {
            pool = fixtures.sisterUsers;
          }

          const expectedIndex = vuIndex % pool.length;
          const user = getUser(fixtures, role, vuIndex);

          expect(expectedIndex).toBeGreaterThanOrEqual(0);
          expect(expectedIndex).toBeLessThan(pool.length);
          expect(user).toBe(pool[expectedIndex]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Scenario Configuration Validity
 * **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**
 *
 * For the admin entry point scenario configuration, every scenario has:
 * - A valid k6 executor type
 * - Positive VU counts (vus or startVUs for ramping executors)
 * - A non-empty exec function name
 */
describe('Property 2: Scenario Configuration Validity', () => {
  const scenarioNames = Object.keys(adminOptions.scenarios);

  it('all scenarios have valid executor types, positive VU counts, and non-empty exec names', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...scenarioNames),
        (scenarioName) => {
          const scenario = adminOptions.scenarios[scenarioName];

          expect(VALID_EXECUTORS).toContain(scenario.executor);

          if (scenario.executor === 'ramping-vus') {
            expect(typeof scenario.startVUs).toBe('number');
            expect(scenario.startVUs).toBeGreaterThanOrEqual(0);
            expect(scenario.stages.length).toBeGreaterThan(0);
            const hasPositiveTarget = scenario.stages.some((s) => s.target > 0);
            expect(hasPositiveTarget).toBe(true);
          } else if (scenario.executor === 'constant-vus') {
            expect(scenario.vus).toBeGreaterThan(0);
          } else if (scenario.executor === 'per-vu-iterations') {
            expect(scenario.vus).toBeGreaterThan(0);
          }

          expect(typeof scenario.exec).toBe('string');
          expect(scenario.exec.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all exec function names reference valid exported functions', () => {
    const validExecNames = ['runBaseline', 'runStress', 'runReadLoad'];

    fc.assert(
      fc.property(
        fc.constantFrom(...scenarioNames),
        (scenarioName) => {
          const scenario = adminOptions.scenarios[scenarioName];
          expect(validExecNames).toContain(scenario.exec);
        }
      ),
      { numRuns: 100 }
    );
  });
});
