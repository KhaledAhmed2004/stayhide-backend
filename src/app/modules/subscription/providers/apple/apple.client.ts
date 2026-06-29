import fs from 'fs';
import path from 'path';
import httpStatus from 'http-status';
import {
  SignedDataVerifier,
  Environment,
} from '@apple/app-store-server-library';
import config from '../../../../../config';
import ApiError from '../../../../../errors/ApiError';

// Lazy-initialized singleton — only loads certificates on first use so the
// server can still boot even if Apple secrets are not yet configured.
let cachedVerifier: SignedDataVerifier | null = null;

const loadAppleRootCertificates = (): Buffer[] => {
  const dir = path.resolve(
    config.apple.rootCertsDir || './secrets/apple-root-certs'
  );

  if (!fs.existsSync(dir)) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Apple root certificates directory not found: ${dir}. Download the Apple root CAs from https://www.apple.com/certificateauthority/ and place the .cer files in this folder.`
    );
  }

  const certFiles = fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.cer') || file.endsWith('.der'));

  if (certFiles.length === 0) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `No Apple root certificates (.cer/.der) found in ${dir}`
    );
  }

  return certFiles.map(file => fs.readFileSync(path.join(dir, file)));
};

export const getAppleVerifier = (): SignedDataVerifier => {
  if (cachedVerifier) return cachedVerifier;

  const { bundleId, appAppleId, environment } = config.apple;

  if (!bundleId) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'APPLE_BUNDLE_ID environment variable is not configured'
    );
  }

  const rootCerts = loadAppleRootCertificates();

  const env =
    environment === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;

  cachedVerifier = new SignedDataVerifier(
    rootCerts,
    true, // enableOnlineChecks — OCSP revocation verification
    env,
    bundleId,
    appAppleId ? Number(appAppleId) : undefined
  );

  return cachedVerifier;
};

// Exposed only for tests — resets the cached verifier so new config can take
// effect. Not used by production code paths.
export const resetAppleVerifierForTests = (): void => {
  cachedVerifier = null;
};
