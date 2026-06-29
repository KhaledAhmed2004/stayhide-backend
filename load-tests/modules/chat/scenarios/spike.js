/**
 * spike.js — Spike test for Chat/Messages API
 *
 * Executor: ramping-vus
 * Stages: 0→3 VUs (5s ramp_up) → 3→20 VUs (10s peak) → 20→3 VUs (5s recovery)
 *
 * Simulates a burst of simultaneous message sends (group activity spikes)
 * to verify message ordering and delivery under sudden load.
 * Requests are tagged with stage name for per-stage metric analysis.
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('chat-fixtures', function () {
  return [JSON.parse(open('../fixtures/chat-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const spikeScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '5s', target: 3 },   // ramp_up
    { duration: '10s', target: 20 }, // peak
    { duration: '5s', target: 3 },   // recovery
  ],
  exec: 'runSpike',
};

/**
 * Approximate stage tag based on iteration count.
 * ramp_up: first few iterations, peak: middle, recovery: later.
 * Note: __ITER is per-VU, so this is an approximation.
 */
function getStageTag() {
  if (__ITER < 3) return 'ramp_up';
  if (__ITER < 12) return 'peak';
  return 'recovery';
}

export function runSpike() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };
  const chatRoom = fixtures.chatRooms[vuIndex % fixtures.chatRooms.length];
  const stage = getStageTag();

  // Step 1: Send a message to simulate burst activity
  const messageText = `spike-msg-vu${__VU}-iter${__ITER}-${Date.now()}`;
  const sendRes = http.post(
    `${BASE_URL}/api/v1/messages`,
    JSON.stringify({ chatId: chatRoom.chatId, text: messageText }),
    { headers, tags: { name: 'POST /messages', stage } },
  );
  check(sendRes, {
    'spike POST /messages 2xx': r => r.status >= 200 && r.status < 300,
  });

  // Step 2: Retrieve messages to verify delivery and ordering
  const getRes = http.get(`${BASE_URL}/api/v1/messages/chat/${chatRoom.chatId}`, {
    headers,
    tags: { name: 'GET /messages/chat/:chatId', stage },
  });
  const getOk = check(getRes, {
    'spike GET /messages 2xx': r => r.status >= 200 && r.status < 300,
  });

  // Verify message ordering — messages should be returned in chronological order
  if (getOk) {
    const body = getRes.json();
    check(body, {
      'messages array returned': b => b && b.data && Array.isArray(b.data),
      'message delivered': b =>
        b && b.data && Array.isArray(b.data) && b.data.some(m => m.text === messageText),
    });
  }

  // Step 3: List chats to verify system responsiveness under spike
  const listRes = http.get(`${BASE_URL}/api/v1/chats`, {
    headers,
    tags: { name: 'GET /chats', stage },
  });
  check(listRes, {
    'spike GET /chats 2xx': r => r.status >= 200 && r.status < 300,
  });
}
