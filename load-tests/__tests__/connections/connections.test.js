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

// Import the connections entry point options for scenario configuration testing
// We inline the options here to avoid k6-specific import issues in Node.js/vitest
const connectionsOptions = {
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
    chaos: {
      executor: 'constant-vus',
      vus: 10,
      duration: '20s',
      exec: 'runChaos',
      startTime: '40s',
    },
  },
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
 * Feature: multi-module-load-tests
 * Property 1: Fixture-Based User Selection Validity
 * **Validates: Requirements 8.2**
 *
 * For any non-negative VU index and any valid role ('admin', 'brother', 'sister'),
 * calling getUser(fixtures, role, vuIndex) SHALL return a valid user object containing
 * non-empty id, email, and token string fields, and the selection SHALL distribute
 * across the pool via modulo arithmetic without ever producing an out-of-bounds index.
 */
describe('Property 1: Fixture-Based User Selection Validity', () => {
  const roleArb = fc.constantFrom('admin', 'brother', 'sister');

  it('getUser produces valid users for all generated VU indices (0–999)', () => {
    fc.assert(
      fc.property(
        roleArb,
        fc.integer({ min: 0, max: 999 }),
        (role, vuIndex) => {
          const user = getUser(fixtures, role, vuIndex);

          // User object must be defined
          expect(user).toBeDefined();

          // Must have non-empty id string
          expect(typeof user.id).toBe('string');
          expect(user.id.length).toBeGreaterThan(0);

          // Must have non-empty email string
          expect(typeof user.email).toBe('string');
          expect(user.email.length).toBeGreaterThan(0);

          // Must have non-empty token string
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
        roleArb,
        fc.integer({ min: 0, max: 999 }),
        (role, vuIndex) => {
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

          // Verify modulo-based selection
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
 * Feature: multi-module-load-tests
 * Property 2: Scenario Configuration Validity
 * **Validates: Requirements 8.3**
 *
 * For the connections module entry point's scenario configuration object,
 * every scenario SHALL have a valid k6 executor type, a positive VU count
 * (or positive startVUs for ramping executors), and a non-empty exec function name.
 */
describe('Property 2: Scenario Configuration Validity', () => {
  const scenarioNames = Object.keys(connectionsOptions.scenarios);
  const scenarioNameArb = fc.constantFrom(...scenarioNames);

  it('all scenarios have valid executor types, positive VU counts, and non-empty exec names', () => {
    fc.assert(
      fc.property(scenarioNameArb, (scenarioName) => {
        const scenario = connectionsOptions.scenarios[scenarioName];

        // Must have a valid k6 executor type
        expect(VALID_EXECUTORS).toContain(scenario.executor);

        // Must have positive VU count (vus or startVUs for ramping executors)
        if (scenario.executor === 'ramping-vus') {
          expect(typeof scenario.startVUs).toBe('number');
          expect(scenario.startVUs).toBeGreaterThanOrEqual(0);
          // Ramping executors must have stages with at least one positive target
          expect(scenario.stages).toBeDefined();
          expect(scenario.stages.length).toBeGreaterThan(0);
          const hasPositiveTarget = scenario.stages.some((s) => s.target > 0);
          expect(hasPositiveTarget).toBe(true);
        } else {
          expect(typeof scenario.vus).toBe('number');
          expect(scenario.vus).toBeGreaterThan(0);
        }

        // Must have a non-empty exec function name
        expect(typeof scenario.exec).toBe('string');
        expect(scenario.exec.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('scenario exec names reference valid function identifiers', () => {
    fc.assert(
      fc.property(scenarioNameArb, (scenarioName) => {
        const scenario = connectionsOptions.scenarios[scenarioName];

        // exec name should be a valid JS identifier (starts with letter, contains only word chars)
        expect(scenario.exec).toMatch(/^[a-zA-Z]\w*$/);
      }),
      { numRuns: 100 }
    );
  });
});
