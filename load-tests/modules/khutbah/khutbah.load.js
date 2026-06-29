/**
 * khutbah.load.js — Module entry point for Khutbah API load testing
 *
 * Usage:
 *   npm run load:khutbah           → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:khutbah:stress    → stress scenario only
 *   npm run load:khutbah:baseline  → baseline scenario only
 *
 * Prerequisites:
 *   1. npm run load:seed:groups    (creates base fixtures)
 *   2. npm run load:seed:khutbah   (creates khutbah-specific fixtures)
 *   3. npm run dev                 (starts the Express server)
 */

import { THRESHOLDS } from '../../shared/config/thresholds.js';
import { createHandleSummary } from '../../shared/helpers/report.js';

// Import exec functions from scenarios
import { runBaseline } from './scenarios/baseline.js';
import { runStress } from './scenarios/stress.js';
import { runReadLoad } from './scenarios/read-load.js';
import { runUserJourney } from './scenarios/user-journey.js';

// Re-export exec functions so k6 can find them by name
export { runBaseline, runStress, runReadLoad, runUserJourney };

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
    read_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'runReadLoad',
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
  thresholds: { ...THRESHOLDS },
};

// ── Default function ──────────────────────────────────────────────────────────
export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') {
    return;
  }
}

// ── Module-specific report generation ─────────────────────────────────────────
export const handleSummary = createHandleSummary('khutbah');
