/**
 * connections.load.js — Module entry point for Connections API load testing
 *
 * Usage:
 *   npm run load:connections           → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:connections:baseline  → k6 run with only baseline scenario
 *   npm run load:connections:stress    → k6 run with only stress scenario
 *   npm run load:connections:chaos     → k6 run with only chaos scenario
 *
 * Prerequisites:
 *   1. npm run load:seed:groups       (creates base fixtures)
 *   2. npm run load:seed:connections  (creates connection-specific fixtures)
 *   3. npm run dev                    (starts the Express server)
 */

import { THRESHOLDS } from '../../shared/config/thresholds.js';
import { createHandleSummary } from '../../shared/helpers/report.js';

// Connections-specific thresholds — write operations (send/accept/reject/remove)
// involve MongoDB transactions and Socket.IO emissions, so they're heavier.
const CONNECTIONS_THRESHOLDS = {
  ...THRESHOLDS,
  // Connection write operations produce 409 (already connected/pending) under concurrency.
  // This is CORRECT business logic — the API enforces state correctly.
  // We relax failure thresholds to allow these expected 4xx responses.
  'http_req_failed':                            ['rate<0.40'],
  'http_req_duration{scenario:"baseline"}':     ['p(95)<3000', 'p(99)<5000'],
  'http_req_duration{scenario:"stress"}':       ['p(95)<8000', 'p(99)<12000'],
  'http_req_duration{scenario:"write_load"}':   ['p(95)<6000', 'p(99)<10000'],
  'http_req_duration{scenario:"user_journey"}': ['p(95)<8000', 'p(99)<12000'],
  'http_req_failed{scenario:"stress"}':         ['rate<0.40'],
  'http_req_failed{scenario:"user_journey"}':   ['rate<0.70'],
  'http_req_failed{scenario:"write_load"}':     ['rate<0.30'],
};

// Import exec functions from scenarios
import { runBaseline } from './scenarios/baseline.js';
import { runStress } from './scenarios/stress.js';
import { runReadLoad } from './scenarios/read-load.js';
import { runWriteLoad } from './scenarios/write-load.js';
import { runUserJourney } from './scenarios/user-journey.js';
import { runChaos } from './scenarios/chaos.js';

// Re-export exec functions so k6 can find them by name
export { runBaseline, runStress, runReadLoad, runWriteLoad, runUserJourney, runChaos };

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
  thresholds: { ...CONNECTIONS_THRESHOLDS },
};

// ── Default function ──────────────────────────────────────────────────────────
export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') {
    return;
  }
}

// ── Module-specific report generation ─────────────────────────────────────────
export const handleSummary = createHandleSummary('connections');
