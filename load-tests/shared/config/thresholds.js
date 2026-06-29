/**
 * thresholds.js — k6 performance threshold constants
 *
 * These thresholds are tuned for local MongoDB (standalone).
 * For production Atlas testing, tighten these values:
 *   READ_P95:    1000ms → 500ms
 *   WRITE_P95:   3000ms → 2000ms
 *   JOURNEY_P95: 5000ms → 3000ms
 *
 * Metrics covered:
 *   - Latency:    http_req_duration (p95, p99)
 *   - Error Rate: http_req_failed (rate)
 *   - RPS:        http_reqs (rate — requests per second)
 *   - Throughput:  data_received (rate — bytes/sec)
 */

export const THRESHOLDS = {
  // ── Global RPS & Throughput ─────────────────────────────────────────────────
  // Minimum sustained request rate across all scenarios (req/s)
  'http_reqs':                                  ['rate>50'],
  // Minimum data throughput (bytes/sec) — ~50KB/s minimum
  'data_received':                              ['rate>50000'],

  // ── Global Latency (all scenarios combined) ─────────────────────────────────
  'http_req_duration':                          ['p(99)<10000'],  // No request should exceed 10s

  // ── Global Error Rate ───────────────────────────────────────────────────────
  'http_req_failed':                            ['rate<0.10'],    // Overall <10% error rate

  // ── Baseline: single user, should be fast ───────────────────────────────────
  'http_req_duration{scenario:"baseline"}':     ['p(95)<500', 'p(99)<1000'],

  // ── Read load: 10 VUs ───────────────────────────────────────────────────────
  'http_req_duration{scenario:"read_load"}':    ['p(95)<3000', 'p(99)<5000'],
  'http_req_failed{scenario:"read_load"}':      ['rate<0.05'],

  // ── Write load: 5 VUs ──────────────────────────────────────────────────────
  'http_req_duration{scenario:"write_load"}':   ['p(95)<4000', 'p(99)<6000'],
  'http_req_failed{scenario:"write_load"}':     ['rate<0.10'],

  // ── Stress: ramping VUs ─────────────────────────────────────────────────────
  'http_req_duration{scenario:"stress"}':       ['p(95)<5000', 'p(99)<8000'],
  'http_req_failed{scenario:"stress"}':         ['rate<0.15'],   // Allow slightly higher under stress

  // ── User journey: 5 VUs, multi-step ─────────────────────────────────────────
  'http_req_duration{scenario:"user_journey"}': ['p(95)<6000', 'p(99)<10000'],
  'http_req_failed{scenario:"user_journey"}':   ['rate<0.05'],

  // ── Spike: burst traffic ────────────────────────────────────────────────────
  'http_req_duration{scenario:"spike"}':        ['p(95)<5000'],
  'http_req_failed{scenario:"spike"}':          ['rate<0.10'],

  // ── Geo-query: diverse coordinates ──────────────────────────────────────────
  'http_req_duration{scenario:"geo_query"}':    ['p(95)<3000', 'p(99)<5000'],
  'http_req_failed{scenario:"geo_query"}':      ['rate<0.05'],

  // ── Rate-limit: expects 429s (not counted as failures) ──────────────────────
  'checks{scenario:"rate_limit"}':              ['rate>0.80'],

  // ── Role auth: must always return 403 ───────────────────────────────────────
  'checks{scenario:"role_auth"}':               ['rate>0.95'],
};
