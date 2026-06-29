/**
 * mongo-init.js — MongoDB replica set initialization script
 *
 * This script runs automatically when the MongoDB container starts for the
 * first time (via docker-entrypoint-initdb.d). It initializes a single-node
 * replica set named "rs0" which is required for multi-document transactions.
 *
 * Modules that require transactions:
 *   - support-ticket (ticket creation with first message)
 *   - connections (accept/reject with chat creation)
 *   - chat (message operations)
 *   - groups (join/leave with notifications)
 */

try {
  const status = rs.status();
  if (status.ok === 1) {
    print('[mongo-init] Replica set rs0 already initialized, skipping.');
  }
} catch (e) {
  // Not yet initialized — initiate now
  print('[mongo-init] Initializing replica set rs0...');
  const result = rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'mongodb:27017' }],
  });
  if (result.ok === 1) {
    print('[mongo-init] Replica set rs0 initialized successfully.');
  } else {
    print('[mongo-init] WARNING: rs.initiate() result: ' + JSON.stringify(result));
  }
}
