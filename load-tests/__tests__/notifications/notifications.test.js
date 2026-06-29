import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getUser } from '../../shared/helpers/auth.js';

// ── Mock fixture data matching the structure of notifications-fixtures.json + base-fixtures ──
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
  notifications: [
    { notificationId: '6a121d30f476457bd68d6001', userId: '6a121d10f476457bd68d5f6b', type: 'connection_request', isRead: false },
    { notificationId: '6a121d30f476457bd68d6003', userId: '6a121d10f476457bd68d5f6d', type: 'message', isRead: false },
    { notificationId: '6a121d30f476457bd68d6005', userId: '6a121d20f476457bd68d5fa1', type: 'broadcast', isRead: true },
  ],
  broadcastIds: ['6a121d30f476457bd68d6007', '6a121d30f476457bd68d6009'],
};

// ── Notifications entry point scenario configuration (mirrors notifications.load.js) ──
const scenarioOptions = {
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
        { duration: '10s', target: 5 },
        { duration: '20s', target: 15 },
        { duration: '10s', target: 25 },
        { duration: '10s', target: 0 },
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
      startTime: '60s',
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

const VALID_EXECUTORS = [
  'per-vu-iterations',
  'constant-vus',
  'ramping-vus',
  'shared-iterations',
  'ramping-arrival-rate',
  'constant-arrival-rate',
];

// ── Property 1: Fixture-Based User Selection Validity ──────────────────────────
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
describe('Property 1: Fixture-Based User Selection Validity', () => {
  const roleArb = fc.constantFrom('admin', 'brother', 'sister');

  it('getUser produces valid users for all generated VU indices (0–999)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        roleArb,
        (vuIndex, role) => {
          const user = getUser(fixtures, role, vuIndex);

          // User must be defined
          expect(user).toBeDefined();

          // User must have non-empty id string
          expect(typeof user.id).toBe('string');
          expect(user.id.length).toBeGreaterThan(0);

          // User must have non-empty email string
          expect(typeof user.email).toBe('string');
          expect(user.email.length).toBeGreaterThan(0);

          // User must have non-empty token string
          expect(typeof user.token).toBe('string');
          expect(user.token.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('selection distributes via modulo without out-of-bounds access', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        roleArb,
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
          expect(expectedIndex).toBeGreaterThanOrEqual(0);
          expect(expectedIndex).toBeLessThan(pool.length);

          const user = getUser(fixtures, role, vuIndex);
          expect(user).toBe(pool[expectedIndex]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 2: Scenario Configuration Validity ────────────────────────────────
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
describe('Property 2: Scenario Configuration Validity', () => {
  const scenarioNames = Object.keys(scenarioOptions.scenarios);
  const scenarioNameArb = fc.constantFrom(...scenarioNames);

  it('every scenario has a valid k6 executor type', () => {
    fc.assert(
      fc.property(scenarioNameArb, (name) => {
        const scenario = scenarioOptions.scenarios[name];
        expect(VALID_EXECUTORS).toContain(scenario.executor);
      }),
      { numRuns: 100 },
    );
  });

  it('every scenario has positive VU counts', () => {
    fc.assert(
      fc.property(scenarioNameArb, (name) => {
        const scenario = scenarioOptions.scenarios[name];

        if (scenario.executor === 'ramping-vus') {
          // ramping-vus uses startVUs (can be 0) and stages with positive targets
          expect(scenario.startVUs).toBeGreaterThanOrEqual(0);
          expect(scenario.stages.length).toBeGreaterThan(0);
          // At least one stage must have a positive target
          const hasPositiveTarget = scenario.stages.some((s) => s.target > 0);
          expect(hasPositiveTarget).toBe(true);
        } else if (scenario.executor === 'per-vu-iterations') {
          expect(scenario.vus).toBeGreaterThan(0);
          expect(scenario.iterations).toBeGreaterThan(0);
        } else {
          // constant-vus, shared-iterations, etc.
          expect(scenario.vus).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('every scenario has a non-empty exec function name', () => {
    fc.assert(
      fc.property(scenarioNameArb, (name) => {
        const scenario = scenarioOptions.scenarios[name];
        expect(typeof scenario.exec).toBe('string');
        expect(scenario.exec.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
