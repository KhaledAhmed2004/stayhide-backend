/**
 * stress.js — Stress test scenario for Connections API
 *
 * Executor: ramping-vus, progressive VU increase to find throughput limits.
 * Ramps VUs performing mixed connection operations (send, accept, reject,
 * cancel, remove) to identify the point where response times degrade
 * and error rates increase.
 * Uses pre-seeded fixture data for pending requests and existing connections.
 *
 * Run: k6 run --out web-dashboard load-tests/modules/connections/scenarios/stress.js
 * Production profile: STRESS_PROFILE=production k6 run load-tests/modules/connections/scenarios/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { getStressStages, resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('connections-fixtures', function () {
  return [JSON.parse(open('../fixtures/connections-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: getStressStages(__ENV.STRESS_PROFILE),
      exec: 'runStress',
    },
  },
  thresholds: {
    http_req_duration: [
      { threshold: 'p(50)<1000', abortOnFail: false },
      { threshold: 'p(95)<2000', abortOnFail: false },
      { threshold: 'p(99)<5000', abortOnFail: false },
    ],
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
};

export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressStages(__ENV.STRESS_PROFILE),
  exec: 'runStress',
};

export function runStress() {
  const vuIndex = __VU - 1;

  // Use well-separated user pairs — stride of 5 to avoid overlap across VUs
  // With 50 brothers, 25 non-overlapping pairs available
  const stride = 5;
  const senderIndex = (vuIndex * stride) % fixtures.brotherUsers.length;
  const receiverIndex = (vuIndex * stride + 1) % fixtures.brotherUsers.length;

  const senderHeaders = {
    ...getAuthHeaders(fixtures, 'brother', senderIndex),
    'Content-Type': 'application/json',
  };
  const receiverHeaders = {
    ...getAuthHeaders(fixtures, 'brother', receiverIndex),
    'Content-Type': 'application/json',
  };
  const receiverId = fixtures.brotherUsers[receiverIndex].id;

  // ── Operation 1: Send a connection request ──────────────────────────────────
  const sendRes = http.post(
    `${BASE_URL}/api/v1/connections`,
    JSON.stringify({ receiverId }),
    { headers: senderHeaders, tags: { name: 'POST /connections (send)' } },
  );
  // 201 = new request, 409 = already exists (both acceptable)
  check(sendRes, {
    'POST /connections (send) 2xx or 409': (r) => r.status >= 200 && r.status < 300 || r.status === 409,
  });

  let connectionId = null;
  try {
    const body = sendRes.json();
    connectionId = body.data && (body.data._id || body.data.id || body.data.connectionId);
  } catch (_) {}

  // ── Operation 2: Read connections list ──────────────────────────────────────
  const listRes = http.get(`${BASE_URL}/api/v1/connections`, {
    headers: senderHeaders,
    tags: { name: 'GET /connections (list)' },
  });
  check(listRes, {
    'GET /connections 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // ── Operation 3: Cancel the request (cleanup) if newly created ──────────────
  if (connectionId && sendRes.status === 201) {
    const cancelRes = http.post(
      `${BASE_URL}/api/v1/connections/${connectionId}/cancel`,
      null,
      { headers: senderHeaders, tags: { name: 'POST /connections/:id/cancel' } },
    );
    check(cancelRes, {
      'POST /connections/:id/cancel 2xx': (r) => r.status >= 200 && r.status < 300,
    });
  }

  sleep(1);
}

export default runStress;

export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
