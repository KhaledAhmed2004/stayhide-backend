/**
 * write-load.js — Concurrent write load test for Pending-Email API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates concurrent requeue operations from admin users.
 * Admin authentication required.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('pending-email-fixtures', function () {
  return [JSON.parse(open('../fixtures/pending-email-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const writeLoadScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runWriteLoad',
};

export function runWriteLoad() {
  const headers = {
    ...getAuthHeaders(fixtures, 'admin', 0),
    'Content-Type': 'application/json',
  };

  // Alternate between requeue and status update to avoid hammering the same endpoint
  if (__ITER % 3 === 0) {
    // Fetch stats (read operation as write warmup)
    const statsRes = http.get(
      `${BASE_URL}/api/v1/admin/pending-emails/stats`,
      { headers, tags: { name: 'GET /admin/pending-emails/stats' } },
    );
    check(statsRes, {
      'GET /admin/pending-emails/stats 2xx': r => r.status >= 200 && r.status < 300,
    });
  } else {
    // Requeue a DEAD or PENDING email — accept 200 (requeued) or 400 (not requeueable)
    const email = fixtures.pendingEmails[__ITER % fixtures.pendingEmails.length];
    const res = http.post(
      `${BASE_URL}/api/v1/admin/pending-emails/${email.id}/requeue`,
      null,
      {
        headers,
        tags: { name: 'POST /admin/pending-emails/:id/requeue' },
        // Tell k6 that 400 is also an "expected" response (not a failure)
        responseCallback: http.expectedStatuses(200, 201, 400),
      },
    );
    check(res, {
      'POST /pending-emails/:id/requeue 2xx or 400': r => r.status >= 200 && r.status < 300 || r.status === 400,
    });
  }

  sleep(1);
}
