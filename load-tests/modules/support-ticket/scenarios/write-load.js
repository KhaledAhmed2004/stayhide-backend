/**
 * write-load.js — Concurrent write load test for Support-Ticket API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates concurrent ticket creation and reply operations from multiple VUs.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('support-ticket-fixtures', function () {
  return [JSON.parse(open('../fixtures/support-ticket-fixtures.json'))];
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
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  if (__ITER % 2 === 0) {
    // Create a new ticket
    const res = http.post(
      `${BASE_URL}/api/v1/support-tickets`,
      JSON.stringify({
        subject: `loadtest-write-load-ticket VU${__VU} ${Date.now()}`,
        message: `Write load test ticket message from VU${__VU} iteration ${__ITER}`,
      }),
      { headers, tags: { name: 'POST /support-tickets' } },
    );
    check(res, { 'POST /support-tickets 2xx': r => r.status >= 200 && r.status < 300 });
  } else {
    // Create a ticket first, then reply to it (ensures ownership)
    const createRes = http.post(
      `${BASE_URL}/api/v1/support-tickets`,
      JSON.stringify({
        subject: `loadtest-write-reply-base VU${__VU}`,
        message: `Base ticket for reply VU${__VU}`,
      }),
      { headers, tags: { name: 'POST /support-tickets' } },
    );
    let ticketId = null;
    try { ticketId = JSON.parse(createRes.body)?.data?.ticket?.id; } catch (_) {}
    if (!ticketId) return;

    const replyRes = http.post(
      `${BASE_URL}/api/v1/support-tickets/${ticketId}/reply`,
      JSON.stringify({ message: `Write load reply VU${__VU} ${Date.now()}` }),
      { headers, tags: { name: 'POST /support-tickets/:id/reply' } },
    );
    check(replyRes, { 'POST /support-tickets/:id/reply 2xx': r => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
