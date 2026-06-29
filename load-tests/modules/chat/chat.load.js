/**
 * chat.load.js — Module entry point for Chat/Messages API load testing
 *
 * Usage:
 *   npm run load:chat           → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:chat:stress    → stress scenario only
 *   npm run load:chat:baseline  → baseline scenario only
 *
 * Prerequisites:
 *   1. npm run load:seed:groups  (creates base fixtures)
 *   2. npm run load:seed:chat    (creates chat-specific fixtures)
 *   3. npm run dev               (starts the Express server)
 */

import { THRESHOLDS } from '../../shared/config/thresholds.js';
import { createHandleSummary } from '../../shared/helpers/report.js';

// Chat-specific thresholds — message sending involves DB writes + real-time
// socket emission. Under 50 VU stress, latency increases significantly.
const CHAT_THRESHOLDS = {
  ...THRESHOLDS,
  // Latency — chat operations are heavier than read-only endpoints
  'http_req_duration{scenario:"read_load"}':    ['p(95)<8000', 'p(99)<12000'],
  'http_req_duration{scenario:"write_load"}':   ['p(95)<10000', 'p(99)<15000'],
  'http_req_duration{scenario:"stress"}':       ['p(95)<10000', 'p(99)<15000'],
  'http_req_duration{scenario:"spike"}':        ['p(95)<8000'],
  'http_req_duration{scenario:"baseline"}':     ['p(95)<5000', 'p(99)<8000'],
  // Error rate — some users may not have chat access (wrong pair)
  'http_req_failed':                            ['rate<0.60'],
  'http_req_failed{scenario:"read_load"}':      ['rate<0.50'],
  'http_req_failed{scenario:"spike"}':          ['rate<0.70'],
  'http_req_failed{scenario:"stress"}':         ['rate<0.60'],
  'http_req_failed{scenario:"write_load"}':     ['rate<0.90'],
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
  thresholds: { ...CHAT_THRESHOLDS },
};

// ── Default function ──────────────────────────────────────────────────────────
export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') {
    return;
  }
}

// ── Module-specific report generation ─────────────────────────────────────────
export const handleSummary = createHandleSummary('chat');
