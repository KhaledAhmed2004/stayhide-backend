/**
 * user-journey.js — Full user journey scenario
 *
 * Executor: constant-vus, 10 VUs, 30s
 * Simulates a complete user flow: browse → view → join → read feed →
 * create post → like → comment.
 *
 * postId from Step 5 (create post) is captured and used in Steps 6 and 7.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('group-fixtures', function () {
  return [JSON.parse(open('../fixtures/group-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5002';

export const userJourneyScenario = {
  executor: 'constant-vus',
  vus: 10,
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

  // Each VU targets a different group to avoid join conflicts
  const group = fixtures.brotherGroups[vuIndex % fixtures.brotherGroups.length];

  // ── Step 1: Browse groups ───────────────────────────────────────────────────
  const s1 = http.get(`${BASE_URL}/api/v1/groups`, {
    headers,
    tags: { name: 'journey:browse' },
  });
  step('Step1:browse', s1);
  sleep(1);

  // ── Step 2: View specific group ─────────────────────────────────────────────
  const s2 = http.get(`${BASE_URL}/api/v1/groups/${group.id}`, {
    headers,
    tags: { name: 'journey:view-group' },
  });
  step('Step2:view-group', s2);
  sleep(1);

  // ── Step 3: Join group (skip — users are pre-seeded as members) ────────────
  // join uses MongoDB transactions which require a replica set.
  // Pre-seeded users are already members, so we skip this step.
  sleep(1);

  // ── Step 4: Read group feed ─────────────────────────────────────────────────
  const s4 = http.get(`${BASE_URL}/api/v1/groups/${group.id}/posts`, {
    headers,
    tags: { name: 'journey:read-feed' },
  });
  step('Step4:read-feed', s4);
  sleep(1);

  // ── Step 5: Create post — capture postId ────────────────────────────────────
  const s5 = http.post(
    `${BASE_URL}/api/v1/groups/${group.id}/posts`,
    JSON.stringify({ content: `journey post VU${__VU} ${Date.now()}` }),
    { headers, tags: { name: 'journey:create-post' } },
  );
  step('Step5:create-post', s5);

  // Extract postId from response body (Property 3: must use this in steps 6 & 7)
  let postId = null;
  try {
    const body = JSON.parse(s5.body);
    postId = body?.data?._id || body?.data?.id || null;
  } catch (_) {}

  if (!postId) {
    // Fallback to a fixture post so steps 6 and 7 still execute
    console.error(
      `[journey] VU${__VU}: Step5 postId extraction failed (status=${s5.status}), falling back to fixture post`,
    );
    postId = fixtures.posts[vuIndex % fixtures.posts.length].id;
  }
  sleep(1);

  // ── Step 6: Like the post from Step 5 ──────────────────────────────────────
  const s6 = http.post(
    `${BASE_URL}/api/v1/groups/posts/${postId}/like`,
    null,
    { headers, tags: { name: 'journey:like' } },
  );
  step('Step6:like', s6);
  sleep(1);

  // ── Step 7: Comment on the post from Step 5 ─────────────────────────────────
  const s7 = http.post(
    `${BASE_URL}/api/v1/groups/posts/${postId}/comments`,
    JSON.stringify({ comment: `journey comment VU${__VU} ${Date.now()}` }),
    { headers, tags: { name: 'journey:comment' } },
  );
  step('Step7:comment', s7);
  sleep(1);
}
