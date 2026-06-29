/**
 * user-journey.js — Full user journey scenario for Chat/Messages API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates a complete chat flow: create chat → send multiple messages →
 * fetch messages → mark chat as read.
 *
 * chatId from Step 1 (create chat) is captured and used in subsequent steps.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
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
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Each VU targets a different partner user to create a chat with
  const partnerUsers = fixtures.sisterUsers || fixtures.brotherUsers;
  const partner = partnerUsers[vuIndex % partnerUsers.length];

  // ── Step 1: Create or get a chat with the partner ───────────────────────────
  const s1 = http.post(`${BASE_URL}/api/v1/chats/${partner.id}`, null, {
    headers,
    tags: { name: 'journey:create-chat' },
  });
  step('Step1:create-chat', s1);

  // Extract chatId from response for subsequent steps
  let chatId = null;
  try {
    const body = JSON.parse(s1.body);
    chatId = body?.data?._id || body?.data?.id || null;
  } catch (_) {}

  if (!chatId) {
    // Fallback to a fixture chat so remaining steps still execute
    console.error(
      `[journey] VU${__VU}: Step1 chatId extraction failed (status=${s1.status}), falling back to fixture chat`,
    );
    chatId = fixtures.chatRooms[vuIndex % fixtures.chatRooms.length].chatId;
  }
  sleep(1);

  // ── Step 2: Send multiple messages to the chat ──────────────────────────────
  const messageCount = 3;
  for (let i = 0; i < messageCount; i++) {
    const s2 = http.post(
      `${BASE_URL}/api/v1/messages`,
      JSON.stringify({ chatId, text: `journey msg ${i + 1} VU${__VU} ${Date.now()}` }),
      { headers, tags: { name: 'journey:send-message' } },
    );
    step(`Step2:send-message-${i + 1}`, s2);
    sleep(0.5);
  }
  sleep(0.5);

  // ── Step 3: Fetch messages from the chat ────────────────────────────────────
  const s3 = http.get(`${BASE_URL}/api/v1/messages/chat/${chatId}`, {
    headers,
    tags: { name: 'journey:fetch-messages' },
  });
  step('Step3:fetch-messages', s3);

  // Verify messages were delivered
  try {
    const body = JSON.parse(s3.body);
    check(body, {
      'messages array is non-empty': b =>
        b && b.data && Array.isArray(b.data) && b.data.length > 0,
    });
  } catch (_) {}
  sleep(1);

  // ── Step 4: Mark chat as read ───────────────────────────────────────────────
  const s4 = http.post(`${BASE_URL}/api/v1/messages/chat/${chatId}/read`, null, {
    headers,
    tags: { name: 'journey:mark-as-read' },
  });
  step('Step4:mark-as-read', s4);
  sleep(1);
}
