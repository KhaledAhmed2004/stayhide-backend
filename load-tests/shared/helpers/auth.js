/**
 * auth.js — Token helper for k6 load test scenarios
 *
 * Pure CommonJS module — no k6 imports.
 * Works in both k6 runtime and Node.js (seed script, tests).
 */

'use strict';

/**
 * Get a user entry from the fixture pool.
 * @param {object} fixtures - Loaded fixtures.json content
 * @param {'admin'|'brother'|'sister'} role
 * @param {number} vuIndex - VU index (0-based), used for round-robin selection
 * @returns {{ id: string, email: string, token: string }}
 */
function getUser(fixtures, role, vuIndex) {
  let pool;
  if (role === 'admin') {
    pool = [fixtures.adminUser];
  } else if (role === 'brother') {
    pool = fixtures.brotherUsers;
  } else {
    pool = fixtures.sisterUsers;
  }
  return pool[vuIndex % pool.length];
}

/**
 * Get the JWT token for a user in the fixture pool.
 * @param {object} fixtures
 * @param {'admin'|'brother'|'sister'} role
 * @param {number} vuIndex
 * @returns {string} JWT token
 */
function getToken(fixtures, role, vuIndex) {
  return getUser(fixtures, role, vuIndex).token;
}

/**
 * Get Authorization header object for a user in the fixture pool.
 * @param {object} fixtures
 * @param {'admin'|'brother'|'sister'} role
 * @param {number} vuIndex
 * @returns {{ Authorization: string }}
 */
function getAuthHeaders(fixtures, role, vuIndex) {
  return { Authorization: `Bearer ${getToken(fixtures, role, vuIndex)}` };
}

module.exports = { getUser, getToken, getAuthHeaders };
