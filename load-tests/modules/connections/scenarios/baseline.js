/**
 * baseline.js — Single-user baseline latency measurement for Connections API
 *
 * Executor: per-vu-iterations, 1 VU, 1 iteration
 * Exercises the connection request lifecycle: send request → accept → verify
 * both users appear in each other's connection lists under zero concurrency
 * to establish a performance baseline.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('connections-fixtures', function () {
  return [JSON.parse(open('../fixtures/connections-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const baselineScenario = {
  executor: 'per-vu-iterations',
  vus: 1,
  iterations: 1,
  exec: 'runBaseline',
};

export function runBaseline() {
  // User A (sender) — brother user index 0
  const senderHeaders = {
    ...getAuthHeaders(fixtures, 'brother', 0),
    'Content-Type': 'application/json',
  };
  const senderId = fixtures.brotherUsers[0].id;

  // User B (receiver) — brother user index 1
  const receiverHeaders = {
    ...getAuthHeaders(fixtures, 'brother', 1),
    'Content-Type': 'application/json',
  };
  const receiverId = fixtures.brotherUsers[1].id;

  // Step 1: Send a connection request from User A to User B
  const sendRes = http.post(
    `${BASE_URL}/api/v1/connections`,
    JSON.stringify({ receiverId }),
    { headers: senderHeaders, tags: { name: 'POST /connections (send request)' } },
  );

  const sendOk = check(sendRes, {
    'POST /connections (send request) status 2xx': r => r.status >= 200 && r.status < 300,
  });

  console.log(
    `[baseline] POST /connections (send request) → HTTP ${sendRes.status} | ${sendRes.timings.duration.toFixed(1)}ms${sendOk ? '' : ' ⚠ FAILED'}`,
  );

  // Extract connection ID from response
  let connectionId;
  try {
    const sendBody = sendRes.json();
    connectionId = sendBody.data && (sendBody.data._id || sendBody.data.id || sendBody.data.connectionId);
  } catch (e) {
    console.log('[baseline] ⚠ Could not parse send response body');
  }

  if (!connectionId) {
    console.log('[baseline] ⚠ No connectionId returned, skipping accept/verify steps');
    return;
  }

  // Step 2: Accept the connection request as User B (receiver)
  const acceptRes = http.post(
    `${BASE_URL}/api/v1/connections/${connectionId}/accept`,
    null,
    { headers: receiverHeaders, tags: { name: 'POST /connections/:id/accept' } },
  );

  const acceptOk = check(acceptRes, {
    'POST /connections/:id/accept status 2xx': r => r.status >= 200 && r.status < 300,
  });

  console.log(
    `[baseline] POST /connections/:id/accept → HTTP ${acceptRes.status} | ${acceptRes.timings.duration.toFixed(1)}ms${acceptOk ? '' : ' ⚠ FAILED'}`,
  );

  // Step 3: Verify User B appears in User A's connection list
  const senderListRes = http.get(`${BASE_URL}/api/v1/connections`, {
    headers: senderHeaders,
    tags: { name: 'GET /connections (sender list)' },
  });

  const senderListOk = check(senderListRes, {
    'GET /connections (sender list) status 2xx': r => r.status >= 200 && r.status < 300,
    'sender list contains receiver': r => {
      try {
        const body = r.json();
        const connections = body.data || body.data?.connections || [];
        return JSON.stringify(connections).includes(receiverId);
      } catch (e) {
        return false;
      }
    },
  });

  console.log(
    `[baseline] GET /connections (sender list) → HTTP ${senderListRes.status} | ${senderListRes.timings.duration.toFixed(1)}ms${senderListOk ? '' : ' ⚠ FAILED'}`,
  );

  // Step 4: Verify User A appears in User B's connection list
  const receiverListRes = http.get(`${BASE_URL}/api/v1/connections`, {
    headers: receiverHeaders,
    tags: { name: 'GET /connections (receiver list)' },
  });

  const receiverListOk = check(receiverListRes, {
    'GET /connections (receiver list) status 2xx': r => r.status >= 200 && r.status < 300,
    'receiver list contains sender': r => {
      try {
        const body = r.json();
        const connections = body.data || body.data?.connections || [];
        return JSON.stringify(connections).includes(senderId);
      } catch (e) {
        return false;
      }
    },
  });

  console.log(
    `[baseline] GET /connections (receiver list) → HTTP ${receiverListRes.status} | ${receiverListRes.timings.duration.toFixed(1)}ms${receiverListOk ? '' : ' ⚠ FAILED'}`,
  );
}
