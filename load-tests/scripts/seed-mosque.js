/**
 * seed-mosque.js — Seed script for Mosque load testing
 *
 * Creates mosque documents in the load-test MongoDB database
 * and writes fixture IDs to mosque-fixtures.json for k6 to use.
 *
 * Usage: node load-tests/scripts/seed-mosque.js
 */

'use strict';

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ── Mosque Model ─────────────────────────────────────────────────────────────
const MosqueSchema = new mongoose.Schema({
  mosqueName:  { type: String, required: true },
  address:     { type: String, required: true },
  area:        { type: String, required: true },
  phoneNumber: { type: String, required: true },
  website:     { type: String },
  description: { type: String },
  image:       { type: String },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },
  prayerTimes: {
    fajr:    { type: String, required: true },
    dhuhr:   { type: String, required: true },
    asr:     { type: String, required: true },
    maghrib: { type: String, required: true },
    isha:    { type: String, required: true },
    jummah:  { type: String },
  },
}, { timestamps: true });

MosqueSchema.index({ mosqueName: 'text', area: 'text', address: 'text', description: 'text' });
MosqueSchema.index({ area: 1 });
MosqueSchema.index({ 'location.coordinates': '2dsphere' });

const Mosque = mongoose.model('Mosque', MosqueSchema);

// ── Mosque data ───────────────────────────────────────────────────────────────
// Spread across different cities/areas for geo-query testing
const MOSQUES = [
  {
    mosqueName: 'Loadtest Masjid Al-Noor',
    address: '123 Islamic Center Rd, Dhaka',
    area: 'Dhaka',
    phoneNumber: '+8801700000001',
    website: 'https://example.com/masjid-al-noor',
    description: 'A beautiful mosque for load testing purposes',
    image: 'https://example.com/mosque1.jpg',
    location: { type: 'Point', coordinates: [90.4125, 23.8103] }, // Dhaka
    prayerTimes: { fajr: '05:00', dhuhr: '12:30', asr: '15:45', maghrib: '18:10', isha: '19:30', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Al-Rahman',
    address: '456 Mosque Street, Chittagong',
    area: 'Chittagong',
    phoneNumber: '+8801700000002',
    website: 'https://example.com/masjid-al-rahman',
    description: 'Test mosque in Chittagong',
    image: 'https://example.com/mosque2.jpg',
    location: { type: 'Point', coordinates: [91.8348, 22.3569] }, // Chittagong
    prayerTimes: { fajr: '05:05', dhuhr: '12:25', asr: '15:40', maghrib: '18:05', isha: '19:25', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Al-Amin',
    address: '789 Prayer Lane, Sylhet',
    area: 'Sylhet',
    phoneNumber: '+8801700000003',
    description: 'Test mosque in Sylhet',
    location: { type: 'Point', coordinates: [91.8681, 24.8949] }, // Sylhet
    prayerTimes: { fajr: '04:55', dhuhr: '12:35', asr: '15:50', maghrib: '18:15', isha: '19:35', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Al-Taqwa',
    address: '101 Jummah Ave, Rajshahi',
    area: 'Rajshahi',
    phoneNumber: '+8801700000004',
    description: 'Test mosque in Rajshahi',
    location: { type: 'Point', coordinates: [88.5635, 24.3745] }, // Rajshahi
    prayerTimes: { fajr: '05:10', dhuhr: '12:40', asr: '15:55', maghrib: '18:20', isha: '19:40', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Al-Furqan',
    address: '202 Minaret Blvd, Khulna',
    area: 'Khulna',
    phoneNumber: '+8801700000005',
    description: 'Test mosque in Khulna',
    location: { type: 'Point', coordinates: [89.5644, 22.8456] }, // Khulna
    prayerTimes: { fajr: '05:08', dhuhr: '12:38', asr: '15:52', maghrib: '18:18', isha: '19:38', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Central Mosque Dhaka',
    address: '303 Gulshan Circle, Dhaka',
    area: 'Dhaka',
    phoneNumber: '+8801700000006',
    website: 'https://example.com/central-mosque',
    description: 'Central test mosque in Dhaka for high-traffic testing',
    image: 'https://example.com/mosque6.jpg',
    location: { type: 'Point', coordinates: [90.4152, 23.7937] }, // Gulshan, Dhaka
    prayerTimes: { fajr: '05:00', dhuhr: '12:30', asr: '15:45', maghrib: '18:10', isha: '19:30', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Al-Barakah',
    address: '404 Comilla Road, Cumilla',
    area: 'Cumilla',
    phoneNumber: '+8801700000007',
    description: 'Test mosque in Cumilla',
    location: { type: 'Point', coordinates: [91.1896, 23.4607] }, // Cumilla
    prayerTimes: { fajr: '05:02', dhuhr: '12:32', asr: '15:47', maghrib: '18:12', isha: '19:32', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Al-Hidayah',
    address: '505 Bogura Highway, Bogura',
    area: 'Bogura',
    phoneNumber: '+8801700000008',
    description: 'Test mosque in Bogura',
    location: { type: 'Point', coordinates: [89.3673, 24.8500] }, // Bogura
    prayerTimes: { fajr: '05:12', dhuhr: '12:42', asr: '15:57', maghrib: '18:22', isha: '19:42', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Al-Ikhlas',
    address: '606 Mecca Street, Mymensingh',
    area: 'Mymensingh',
    phoneNumber: '+8801700000009',
    description: 'Test mosque in Mymensingh',
    location: { type: 'Point', coordinates: [90.4018, 24.7471] }, // Mymensingh
    prayerTimes: { fajr: '04:58', dhuhr: '12:28', asr: '15:43', maghrib: '18:08', isha: '19:28', jummah: '13:00' },
  },
  {
    mosqueName: 'Loadtest Masjid Baitul Mukarram',
    address: '707 Topkhana Road, Dhaka',
    area: 'Dhaka',
    phoneNumber: '+8801700000010',
    website: 'https://example.com/baitul-mukarram',
    description: 'National Mosque test replica for load testing',
    image: 'https://example.com/mosque10.jpg',
    location: { type: 'Point', coordinates: [90.4074, 23.7275] }, // Motijheel, Dhaka
    prayerTimes: { fajr: '05:00', dhuhr: '12:30', asr: '15:45', maghrib: '18:10', isha: '19:30', jummah: '12:30' },
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const dbUrl = process.env.LOAD_TEST_DB || process.env.DATABASE_URL;
  await mongoose.connect(dbUrl);
  console.log('[seed-mosque] Connected to database.');

  // Clean up previous seed data
  await Mosque.deleteMany({ mosqueName: /^Loadtest/ });
  console.log('[seed-mosque] Cleaned up previous seed data.');

  // Create mosques
  console.log(`[seed-mosque] Creating ${MOSQUES.length} mosques...`);
  const created = await Mosque.insertMany(MOSQUES);
  console.log(`[seed-mosque] Created ${created.length} mosques.`);

  // Write fixture file
  const fixturesPath = path.resolve(
    __dirname,
    '../modules/mosque/fixtures/mosque-fixtures.json',
  );

  const fixtures = {
    mosques: created.map(m => ({
      id: m._id.toString(),
      name: m.mosqueName,
      area: m.area,
      latitude: m.location.coordinates[1],
      longitude: m.location.coordinates[0],
    })),
    dhakaCoords: { latitude: 23.8103, longitude: 90.4125 },
    chittagongCoords: { latitude: 22.3569, longitude: 91.8348 },
  };

  fs.writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2));
  console.log(`[seed-mosque] Wrote fixtures to ${fixturesPath}`);

  console.log('[seed-mosque] Summary:');
  console.log(`  - ${created.length} mosques created`);
  console.log(`  - Areas: ${[...new Set(created.map(m => m.area))].join(', ')}`);
  console.log('[seed-mosque] Done.');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[seed-mosque] Error:', err.message);
  process.exit(1);
});
