import fs from 'fs';
import path from 'path';
import httpStatus from 'http-status';
import { google, androidpublisher_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import config from '../../../../../config';
import ApiError from '../../../../../errors/ApiError';

// Lazy-initialized singletons — credentials are only loaded the first time
// a verify or webhook endpoint is hit, so the server can boot without the
// Google Play service account file being present yet.
let cachedAndroidPublisher: androidpublisher_v3.Androidpublisher | null = null;
let cachedOAuth2Client: OAuth2Client | null = null;

const resolveServiceAccountPath = (): string => {
  const configured =
    config.googlePlay.serviceAccountPath || './secrets/google-service-account.json';
  return path.resolve(configured);
};

// Returns an authenticated Android Publisher client. Used by verify.ts and
// webhook.ts to call purchases.subscriptionsv2.get().
export const getAndroidPublisher = (): androidpublisher_v3.Androidpublisher => {
  if (cachedAndroidPublisher) return cachedAndroidPublisher;

  if (!config.googlePlay.packageName) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'GOOGLE_PLAY_PACKAGE_NAME environment variable is not configured'
    );
  }

  const keyFile = resolveServiceAccountPath();
  if (!fs.existsSync(keyFile)) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Google Play service account key file not found: ${keyFile}. Download the JSON key from Google Cloud Console and place it at this path.`
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  cachedAndroidPublisher = google.androidpublisher({ version: 'v3', auth });
  return cachedAndroidPublisher;
};

// OAuth2 client used to verify Pub/Sub push JWTs (so we know the webhook
// request actually came from Google Cloud Pub/Sub).
export const getPubsubVerifier = (): OAuth2Client => {
  if (cachedOAuth2Client) return cachedOAuth2Client;
  cachedOAuth2Client = new OAuth2Client();
  return cachedOAuth2Client;
};

// Exposed only for tests.
export const resetGoogleClientsForTests = (): void => {
  cachedAndroidPublisher = null;
  cachedOAuth2Client = null;
};
