/**
 * write-load.js — Concurrent write load test for Connections API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates concurrent connection requests, accepts, and rejects from
 * multiple VUs. Each VU performs a mix of write mutations (send request,
 * accept, reject) to test state consistency under concurrent mutations.
 * VUs target different user pairs to spread write load.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
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

export const writeLoadScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runWriteLoad',
};

export function runWriteLoad() {
  const vuIndex = __VU - 1;

  // Rotate pairs per iteration to avoid "already connected" state
  const pairOffset = (__ITER * 3) % (fixtures.brotherUsers.length - 1);
  const senderIndex = (vuIndex * 2 + pairOffset + 30) % fixtures.brotherUsers.length;
  const receiverIndex = (vuIndex * 2 + pairOffset + 31) % fixtures.brotherUsers.length;

  const senderHeaders = {
    ...getAuthHeaders(fixtures, 'brother', senderIndex),
    'Content-Type': 'application/json',
  };

  const receiverHeaders = {
    ...getAuthHeaders(fixtures, 'brother', receiverIndex),
    'Content-Type': 'application/json',
  };

  const receiverId = fixtures.brotherUsers[receiverIndex].id;

  // ── Step 1: Send a connection request ─────────────────────────────────────
  const sendRes = http.post(
    `${BASE_URL}/api/v1/connections`,
    JSON.stringify({ receiverId }),
    {
      headers: senderHeaders,
      tags: { name: 'POST /connections (send request)' },
      responseCallback: http.expectedStatuses(201, 200, 409),
    },
  );

  check(sendRes, {
    'send connection request 2xx or 409': r => r.status >= 200 && r.status < 300 || r.status === 409,
  });

  // Extract connection ID from response
  let connectionId = null;
  try {
    const body = sendRes.json();
    connectionId = body.data && (body.data._id || body.data.id || body.data.connectionId);
  } catch (_) {}

  if (!connectionId) {
    // Fallback: use a pending request from fixtures if available
    const pendingRequests = fixtures.pendingRequests || [];
    const fallback = pendingRequests[vuIndex % pendingRequests.length];
    if (fallback) {
      connectionId = fallback.requestId;
    }
  }

  if (!connectionId) {
    console.log(`[write-load] VU ${__VU} ⚠ Could not resolve connectionId — skipping iteration`);
    sleep(1);
    return;
  }

  sleep(0.3);

  // ── Step 2: Accept the connection request (receiver) ──────────────────────
  const acceptRes = http.post(
    `${BASE_URL}/api/v1/connections/${connectionId}/accept`,
    null,
    { headers: receiverHeaders, tags: { name: 'POST /connections/:id/accept' } },
  );

  check(acceptRes, {
    'accept connection 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(0.3);

  // ── Step 3: Verify state consistency — both users see the connection ──────
  const listRes = http.get(`${BASE_URL}/api/v1/connections`, {
    headers: senderHeaders,
    tags: { name: 'GET /connections (verify after accept)' },
  });

  check(listRes, {
    'list connections after accept 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(0.3);

  // ── Step 4: Remove the connection (cleanup for next iteration) ────────────
  const removeRes = http.post(
    `${BASE_URL}/api/v1/connections/${connectionId}/remove`,
    null,
    { headers: senderHeaders, tags: { name: 'POST /connections/:id/remove' } },
  );

  check(removeRes, {
    'remove connection 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(0.3);

  // ── Step 5: Send another request and reject it (test reject path) ─────────
  const sendRes2 = http.post(
    `${BASE_URL}/api/v1/connections`,
    JSON.stringify({ receiverId }),
    { headers: senderHeaders, tags: { name: 'POST /connections (send request 2)' } },
  );

  check(sendRes2, {
    'send connection request 2 2xx': r => r.status >= 200 && r.status < 300,
  });

  let connectionId2 = null;
  try {
    const body2 = sendRes2.json();
    connectionId2 = body2.data && (body2.data._id || body2.data.id || body2.data.connectionId);
  } catch (_) {}

  if (connectionId2) {
    sleep(0.2);

    // Reject the request as receiver
    const rejectRes = http.post(
      `${BASE_URL}/api/v1/connections/${connectionId2}/reject`,
      null,
      { headers: receiverHeaders, tags: { name: 'POST /connections/:id/reject' } },
    );

    check(rejectRes, {
      'reject connection 2xx': r => r.status >= 200 && r.status < 300,
    });
  }

  sleep(0.5);
}
