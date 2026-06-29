"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetGoogleClientsForTests = exports.getPubsubVerifier = exports.getAndroidPublisher = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_status_1 = __importDefault(require("http-status"));
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const config_1 = __importDefault(require("../../../../../config"));
const ApiError_1 = __importDefault(require("../../../../../errors/ApiError"));
// Lazy-initialized singletons — credentials are only loaded the first time
// a verify or webhook endpoint is hit, so the server can boot without the
// Google Play service account file being present yet.
let cachedAndroidPublisher = null;
let cachedOAuth2Client = null;
const resolveServiceAccountPath = () => {
    const configured = config_1.default.googlePlay.serviceAccountPath || './secrets/google-service-account.json';
    return path_1.default.resolve(configured);
};
// Returns an authenticated Android Publisher client. Used by verify.ts and
// webhook.ts to call purchases.subscriptionsv2.get().
const getAndroidPublisher = () => {
    if (cachedAndroidPublisher)
        return cachedAndroidPublisher;
    if (!config_1.default.googlePlay.packageName) {
        throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'GOOGLE_PLAY_PACKAGE_NAME environment variable is not configured');
    }
    const keyFile = resolveServiceAccountPath();
    if (!fs_1.default.existsSync(keyFile)) {
        throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Google Play service account key file not found: ${keyFile}. Download the JSON key from Google Cloud Console and place it at this path.`);
    }
    const auth = new googleapis_1.google.auth.GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    cachedAndroidPublisher = googleapis_1.google.androidpublisher({ version: 'v3', auth });
    return cachedAndroidPublisher;
};
exports.getAndroidPublisher = getAndroidPublisher;
// OAuth2 client used to verify Pub/Sub push JWTs (so we know the webhook
// request actually came from Google Cloud Pub/Sub).
const getPubsubVerifier = () => {
    if (cachedOAuth2Client)
        return cachedOAuth2Client;
    cachedOAuth2Client = new google_auth_library_1.OAuth2Client();
    return cachedOAuth2Client;
};
exports.getPubsubVerifier = getPubsubVerifier;
// Exposed only for tests.
const resetGoogleClientsForTests = () => {
    cachedAndroidPublisher = null;
    cachedOAuth2Client = null;
};
exports.resetGoogleClientsForTests = resetGoogleClientsForTests;
