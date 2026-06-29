/**
 * notifications.load.js — Module entry point for Notifications API load testing
 *
 * Usage:
 *   npm run load:notifications           → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:notifications:baseline  → baseline scenario only
 *   npm run load:notifications:stress    → stress scenario only
 *   npm run load:notifications:spike     → spike scenario only
 *
 * Prerequisites:
 *   1. npm run load:seed:groups          (creates base fixtures)
 *   2. npm run load:seed:notifications   (creates notification fixtures)
 *   3. npm run dev                       (starts the Express server)
 */

import { createHandleSummary } from '../../shared/helpers/report.js';
import { THRESHOLDS } from '../../shared/config/thresholds.js';

// Notifications-specific thresholds — heavier than typical because
// notification queries aggregate across all user notifications and
// broadcast events cause "thundering herd" read amplification.
const NOTIFICATIONS_THRESHOLDS = {
  ...THRESHOLDS,
  // Override global error rate — higher is acceptable for notification heavy queries
  'http_req_failed':                            ['rate<0.25'],
  // Override latency thresholds — notification queries are DB-heavy
  'http_req_duration{scenario:"read_load"}':    ['p(95)<8000', 'p(99)<12000'],
  'http_req_duration{scenario:"stress"}':       ['p(95)<10000', 'p(99)<15000'],
  'http_req_duration{scenario:"user_journey"}': ['p(95)<10000', 'p(99)<15000'],
  'http_req_duration{scenario:"write_load"}':   ['p(95)<10000', 'p(99)<15000'],
  // Allow higher error rate under spike (broadcast thundering herd)
  'http_req_failed{scenario:"spike"}':          ['rate<0.25'],
  'http_req_failed{scenario:"stress"}':         ['rate<0.30'],
  'http_req_failed{scenario:"user_journey"}':   ['rate<0.30'],
  'http_req_failed{scenario:"write_load"}':     ['rate<0.30'],
};

// Import exec functions from scenarios
import { runBaseline } from './scenarios/baseline.js';
import { runStress } from './scenarios/stress.js';
import { runSpike } from './scenarios/spike.js';
import { runReadLoad } from './scenarios/read-load.js';
import { runWriteLoad } from './scenarios/write-load.js';
import { runUserJourney } from './scenarios/user-journey.js';

// Re-export exec functions so k6 can find them by name
export { runBaseline, runStress, runSpike, runReadLoad, runWriteLoad, runUserJourney };

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
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
  thresholds: { ...NOTIFICATIONS_THRESHOLDS },
};

// ── Default function ──────────────────────────────────────────────────────────
export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') {
    return;
  }
}

// ── Module-specific report generation ─────────────────────────────────────────
export const handleSummary = createHandleSummary('notifications');
