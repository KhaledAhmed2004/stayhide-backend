/**
 * scenario-utils.js — Pure utility functions for advanced load test scenarios
 *
 * Pure CommonJS module — no k6 imports.
 * Works in both k6 runtime and Node.js (vitest, property tests).
 */

'use strict';

/**
 * Get stress test stages based on profile value.
 * Local stages: 10→25→50→75→100 VUs with 1-minute ramp and 2-minute hold, then 2-minute ramp-down.
 * Production stages: 50→100→200→300 VUs with 2-minute ramp and 5-minute hold, then 10-minute ramp-down.
 *
 * @param {string|undefined} profileValue - Value of STRESS_PROFILE env var
 * @returns {Array<{duration: string, target: number}>} k6 stages array
 */
function getStressStages(profileValue) {
  if (profileValue === 'production') {
    return [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '10m', target: 0 },
    ];
  }

  return [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '2m', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 75 },
    { duration: '2m', target: 75 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 0 },
  ];
}

/**
 * Get soak test stages based on profile value.
 * Local stages: ramp to 20 VUs over 2 min, sustain 30 min, ramp down 2 min.
 * Production stages: ramp to 20 VUs over 2 min, sustain 4 hours, ramp down 2 min.
 *
 * @param {string|undefined} profileValue - Value of SOAK_PROFILE env var
 * @returns {Array<{duration: string, target: number}>} k6 stages array
 */
function getSoakStages(profileValue) {
  if (profileValue === 'production') {
    return [
      { duration: '2m', target: 20 },
      { duration: '4h', target: 20 },
      { duration: '2m', target: 0 },
    ];
  }

  return [
    { duration: '2m', target: 20 },
    { duration: '30m', target: 20 },
    { duration: '2m', target: 0 },
  ];
}

/**
 * Classify the current phase of a soak test based on elapsed seconds.
 *
 * Phase boundaries (local profile):
 *   sustainStart = 2 * 60 = 120s (after 2-min ramp)
 *   sustainEnd   = 32 * 60 = 1920s (before 2-min ramp-down)
 *   earlyEnd     = sustainStart + 5 * 60 = 420s
 *   lateStart    = sustainEnd - 5 * 60 = 1620s
 *
 * Returns:
 *   'early'  — if elapsedSeconds >= sustainStart && < earlyEnd
 *   'late'   — if elapsedSeconds >= lateStart && < sustainEnd
 *   'middle' — otherwise
 *
 * @param {number} elapsedSeconds - Seconds elapsed since test start
 * @returns {'early'|'late'|'middle'} Phase classification
 */
function classifyPhase(elapsedSeconds) {
  const sustainStart = 2 * 60;
  const sustainEnd = 32 * 60;
  const earlyEnd = sustainStart + 5 * 60;
  const lateStart = sustainEnd - 5 * 60;

  if (elapsedSeconds >= sustainStart && elapsedSeconds < earlyEnd) {
    return 'early';
  }
  if (elapsedSeconds >= lateStart && elapsedSeconds < sustainEnd) {
    return 'late';
  }
  return 'middle';
}

/**
 * Resolve the base URL for HTTP requests.
 * Uses the provided env value if truthy, otherwise defaults to http://localhost:5002.
 *
 * @param {string|undefined} envValue - Value of BASE_URL env var
 * @returns {string} Resolved base URL
 */
function resolveBaseUrl(envValue) {
  return envValue || 'http://localhost:5002';
}

module.exports = { getStressStages, getSoakStages, classifyPhase, resolveBaseUrl };
