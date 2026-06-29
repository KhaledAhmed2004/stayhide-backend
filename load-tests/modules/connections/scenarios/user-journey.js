/**
 * user-journey.js — Full user journey scenario for Connections API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates a complete connection lifecycle:
 * send request → accept → list connections → remove connection.
 *
 * Each VU uses a unique pair of users to avoid conflicts between VUs.
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

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runUserJourney',
};

/**
 * Execute a single journey step, check the response, and log on failure.
 * @param {string} name - Step label for logging and check tag
 * @param {object|null} res - k6 HTTP response (null if request was skipped)
 * @returns {boolean} true if step succeeded (2xx)
 */
function step(name, res) {
  if (!res) {
    console.error(`[journey] VU${__VU}: ${name} — no response (request skipped)`);
    check(null, { [`${name} 2xx`]: () => false });
    return false;
  }
  const ok = check(res, {
    [`${name} 2xx`]: r => r && r.status >= 200 && r.status < 300,
  });
  if (!ok) {
    const body = res.body ? res.body.substring(0, 500) : '(empty)';
    console.error(
      `[journey] VU${__VU}: ${name} FAILED | status=${res.status} | body=${body}`,
    );
  }
  return ok;
}

export function runUserJourney() {
  const vuIndex = __VU - 1;

  // Each VU uses rotating pairs across iterations to avoid "already connected" state
  // 50 brothers = 25 possible pairs; rotate by __ITER to spread across them
  const pairOffset = (__ITER * 2) % (fixtures.brotherUsers.length - 1);
  const senderIndex = (vuIndex + pairOffset) % fixtures.brotherUsers.length;
  const receiverIndex = (vuIndex + pairOffset + 1) % fixtures.brotherUsers.length;

  const senderHeaders = {
    ...getAuthHeaders(fixtures, 'brother', senderIndex),
    'Content-Type': 'application/json',
  };
  const receiverHeaders = {
    ...getAuthHeaders(fixtures, 'brother', receiverIndex),
    'Content-Type': 'application/json',
  };
  const receiverId = fixtures.brotherUsers[receiverIndex].id;

  // ── Step 1: Send connection request ─────────────────────────────────────────
  const s1 = http.post(
    `${BASE_URL}/api/v1/connections`,
    JSON.stringify({ receiverId }),
    { headers: senderHeaders, tags: { name: 'journey:send-request' } },
  );
  step('Step1:send-request', s1);

  // Extract connectionId from response for subsequent steps
  let connectionId = null;
  try {
    const body = JSON.parse(s1.body);
    connectionId = body?.data?._id || body?.data?.id || body?.data?.connectionId || null;
  } catch (_) {}

  if (!connectionId) {
    console.error(
      `[journey] VU${__VU}: Step1 connectionId extraction failed (status=${s1.status}), aborting journey`,
    );
    return;
  }
  sleep(1);

  // ── Step 2: Accept connection request (as receiver) ─────────────────────────
  const s2 = http.post(
    `${BASE_URL}/api/v1/connections/${connectionId}/accept`,
    null,
    { headers: receiverHeaders, tags: { name: 'journey:accept-request' } },
  );
  step('Step2:accept-request', s2);
  sleep(1);

  // ── Step 3: List connections (verify connection exists) ─────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/connections`, {
    headers: senderHeaders,
    tags: { name: 'journey:list-connections' },
  });
  const s3Ok = step('Step3:list-connections', s3);

  // Verify the receiver appears in the sender's connection list
  if (s3Ok) {
    check(s3, {
      'Step3:list contains receiver': r => {
        try {
          const body = r.json();
          const connections = body.data || [];
          return JSON.stringify(connections).includes(receiverId);
        } catch (e) {
          return false;
        }
      },
    });
  }
  sleep(1);

  // ── Step 4: Remove connection ───────────────────────────────────────────────
  const s4 = http.post(
    `${BASE_URL}/api/v1/connections/${connectionId}/remove`,
    null,
    { headers: senderHeaders, tags: { name: 'journey:remove-connection' } },
  );
  step('Step4:remove-connection', s4);
  sleep(1);
}
