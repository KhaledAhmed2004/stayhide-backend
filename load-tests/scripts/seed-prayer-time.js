/**
 * seed-prayer-time.js — Load test fixture generator for Prayer-Time
 *
 * Usage: node load-tests/scripts/seed-prayer-time.js
 *
 * Unlike other seed scripts, this module does NOT require a database connection.
 * Prayer-Time is a pure calculation endpoint — we only need to generate diverse
 * geographic coordinate sets and calculation method configurations as fixture data.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────
const MODULE_NAME = 'prayer-time';
const MODULE_FIXTURES_PATH = path.join(__dirname, `../modules/${MODULE_NAME}/fixtures/${MODULE_NAME}-fixtures.json`);

function seed() {
  console.log(`[seed-${MODULE_NAME}] Generating fixture data (no database needed).`);

  // ── Step 1: Define diverse geographic coordinate sets ─────────────────────────
  // Covers multiple continents, hemispheres, and edge cases (high latitudes, equator)
  const coordinates = [
    { latitude: 21.4225, longitude: 39.8262, label: 'Mecca, Saudi Arabia' },
    { latitude: 24.4539, longitude: 54.3773, label: 'Abu Dhabi, UAE' },
    { latitude: 51.5074, longitude: -0.1278, label: 'London, UK' },
    { latitude: 40.7128, longitude: -74.0060, label: 'New York, USA' },
    { latitude: -33.8688, longitude: 151.2093, label: 'Sydney, Australia' },
    { latitude: 41.0082, longitude: 28.9784, label: 'Istanbul, Turkey' },
    { latitude: 31.9454, longitude: 35.9284, label: 'Amman, Jordan' },
    { latitude: 33.8938, longitude: 35.5018, label: 'Beirut, Lebanon' },
    { latitude: 23.8103, longitude: 90.4125, label: 'Dhaka, Bangladesh' },
    { latitude: 24.8607, longitude: 67.0011, label: 'Karachi, Pakistan' },
    { latitude: 3.1390, longitude: 101.6869, label: 'Kuala Lumpur, Malaysia' },
    { latitude: 1.3521, longitude: 103.8198, label: 'Singapore' },
    { latitude: -6.2088, longitude: 106.8456, label: 'Jakarta, Indonesia' },
    { latitude: 36.7538, longitude: 3.0588, label: 'Algiers, Algeria' },
    { latitude: 30.0444, longitude: 31.2357, label: 'Cairo, Egypt' },
    { latitude: 59.3293, longitude: 18.0686, label: 'Stockholm, Sweden' },
    { latitude: 64.1466, longitude: -21.9426, label: 'Reykjavik, Iceland' },
    { latitude: -1.2921, longitude: 36.8219, label: 'Nairobi, Kenya' },
    { latitude: 35.6762, longitude: 139.6503, label: 'Tokyo, Japan' },
    { latitude: 25.2048, longitude: 55.2708, label: 'Dubai, UAE' },
  ];

  // ── Step 2: Define calculation methods ────────────────────────────────────────
  // All methods supported by the prayer-time service
  const calculationMethods = [
    'MuslimWorldLeague',
    'Egyptian',
    'Karachi',
    'UmmAlQura',
    'NorthAmerica',
    'Qatar',
    'Singapore',
    'Dubai',
    'Kuwait',
    'Turkey',
    'ISNA',
  ];

  // ── Step 3: Define test dates ─────────────────────────────────────────────────
  // Covers solstices, equinoxes, and mid-year for varied daylight patterns
  const dates = [
    '2024-01-15',
    '2024-03-20',
    '2024-06-21',
    '2024-09-22',
    '2024-12-21',
    '2025-01-01',
    '2025-06-15',
  ];

  // ── Step 4: Define madhab options ─────────────────────────────────────────────
  const madhabs = ['Hanafi', 'Shafi'];

  // ── Step 5: Define timezone samples ───────────────────────────────────────────
  const timezones = [
    'Asia/Riyadh',
    'Asia/Dubai',
    'Europe/London',
    'America/New_York',
    'Australia/Sydney',
    'Europe/Istanbul',
    'Asia/Dhaka',
    'Asia/Karachi',
    'Asia/Kuala_Lumpur',
    'Asia/Singapore',
    'Asia/Jakarta',
    'Africa/Cairo',
    'Europe/Stockholm',
    'Africa/Nairobi',
    'Asia/Tokyo',
  ];

  // ── Step 6: Write module fixtures ─────────────────────────────────────────────
  const moduleFixtures = {
    coordinates,
    calculationMethods,
    dates,
    madhabs,
    timezones,
  };

  fs.mkdirSync(path.dirname(MODULE_FIXTURES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_FIXTURES_PATH, JSON.stringify(moduleFixtures, null, 2));
  console.log(`[seed-${MODULE_NAME}] Wrote module fixtures to ${MODULE_FIXTURES_PATH}`);
  console.log(`[seed-${MODULE_NAME}] Generated ${coordinates.length} coordinate sets, ${calculationMethods.length} calculation methods, ${dates.length} dates.`);
  console.log(`[seed-${MODULE_NAME}] Done.`);
}

try {
  seed();
  process.exit(0);
} catch (err) {
  console.error(`[seed-${MODULE_NAME}] FATAL:`, err.message);
  process.exit(1);
}
