/**
 * Trigger an Apple App Store Server Notifications V2 TEST notification.
 *
 * Apple does NOT expose a "Send Test Notification" button in App Store Connect.
 * This is the only way to fire a TEST event — via the App Store Server API
 * `requestTestNotification` endpoint, signed with an ES256 JWT (handled by
 * the @apple/app-store-server-library client internally).
 *
 * Usage:
 *   npx ts-node scripts/send-apple-test-notification.ts
 *
 * Prerequisites:
 *   - .env: APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY_PATH,
 *           APPLE_BUNDLE_ID, APPLE_ENVIRONMENT
 *   - App Store Connect → App Information → "App Store Server Notifications"
 *     section me Sandbox Server URL set kora (ngrok URL +
 *     /api/v1/subscription/apple/webhook), Version 2
 *   - Backend running (npm run dev) ar ngrok up
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  AppStoreServerAPIClient,
  Environment,
} from '@apple/app-store-server-library';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`✗ Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
};

const main = async (): Promise<void> => {
  const keyId = required('APPLE_KEY_ID');
  const issuerId = required('APPLE_ISSUER_ID');
  const privateKeyPath = required('APPLE_PRIVATE_KEY_PATH');
  const bundleId = required('APPLE_BUNDLE_ID');
  const envName = (process.env.APPLE_ENVIRONMENT || 'sandbox').toLowerCase();

  const resolvedKeyPath = path.resolve(privateKeyPath);
  if (!fs.existsSync(resolvedKeyPath)) {
    console.error(`✗ Private key file not found: ${resolvedKeyPath}`);
    process.exit(1);
  }

  const signingKey = fs.readFileSync(resolvedKeyPath, 'utf8');
  const environment =
    envName === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;

  console.log(`→ Environment: ${envName}`);
  console.log(`→ Bundle ID:   ${bundleId}`);
  console.log(`→ Issuer ID:   ${issuerId}`);
  console.log(`→ Key ID:      ${keyId}`);
  console.log(`→ Calling Apple requestTestNotification()...\n`);

  const client = new AppStoreServerAPIClient(
    signingKey,
    keyId,
    issuerId,
    bundleId,
    environment
  );

  try {
    const response = await client.requestTestNotification();
    console.log('✓ Apple accepted the test notification request');
    console.log(`  testNotificationToken: ${response.testNotificationToken}`);
    console.log(
      '\nApple will now POST a JWS-signed TEST notification to your configured Server URL.'
    );
    console.log('Check your backend logs for:');
    console.log('  "Apple TEST notification received — webhook reachable"\n');
    console.log(
      'To check delivery status later, call client.getTestNotificationStatus(token).'
    );
  } catch (err) {
    console.error('✗ requestTestNotification failed');
    console.error(err);
    process.exit(1);
  }
};

main();
