/**
 * pending-email.load.js — Module entry point for Pending-Email API load testing
 *
 * Usage:
 *   npm run load:pending-email          → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:pending-email:stress   → stress scenario only
 *   npm run load:pending-email:baseline → baseline scenario only
 *
 * Prerequisites:
 *   1. npm run load:seed:groups         (creates base fixtures)
 *   2. npm run load:seed:pending-email  (creates pending-email-specific fixtures)
 *   3. npm run dev                      (starts the Express server)
 */

import { THRESHOLDS } from '../../shared/config/thresholds.js';
import { createHandleSummary } from '../../shared/helpers/report.js';

// pending-email write_load uses responseCallback to mark 400 as expected.
const PENDING_EMAIL_THRESHOLDS = {
  ...THRESHOLDS,
  'http_req_failed{scenario:"write_load"}': ['rate<0.10'],
};

// Import exec functions from scenarios
import { runBaseline } from './scenarios/baseline.js';
import { runStress } from './scenarios/stress.js';
import { runWriteLoad } from './scenarios/write-load.js';

// Re-export exec functions so k6 can find them by name
export { runBaseline, runStress, runWriteLoad };

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
    write_load: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'runWriteLoad',
      startTime: '5s',
    },
  },
  thresholds: { ...PENDING_EMAIL_THRESHOLDS },
};

// ── Default function ──────────────────────────────────────────────────────────
export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') {
    return;
  }
}

// ── Module-specific report generation ─────────────────────────────────────────
export const handleSummary = createHandleSummary('pending-email');
