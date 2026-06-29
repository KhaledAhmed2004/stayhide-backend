/**
 * profiles.js — Load profile stage definitions for stress and soak scenarios
 *
 * Pure CommonJS module — no k6 imports.
 * Works in both k6 runtime and Node.js (vitest, property tests).
 */

'use strict';

/**
 * Get stress test stages based on environment profile.
 * Local stages: 10→25→50→75→100 VUs with 1-minute ramp and 2-minute hold, then 2-minute ramp-down.
 * Production stages: 50→100→200→300 VUs with 2-minute ramp and 5-minute hold, then 10-minute ramp-down.
 *
 * @param {string|undefined} profileValue - 'production' or anything else (defaults to local)
 * @returns {Array<{duration: string, target: number}>} k6-compatible stages array
 */
function getStressProfile(profileValue) {
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
 * Get soak test stages based on environment profile.
 * Local stages: ramp to 20 VUs over 2 min, sustain 30 min, ramp down 2 min.
 * Production stages: ramp to 20 VUs over 2 min, sustain 4 hours, ramp down 2 min.
 *
 * @param {string|undefined} profileValue - 'production' or anything else (defaults to local)
 * @returns {Array<{duration: string, target: number}>} k6-compatible stages array
 */
function getSoakProfile(profileValue) {
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

module.exports = { getStressProfile, getSoakProfile };
