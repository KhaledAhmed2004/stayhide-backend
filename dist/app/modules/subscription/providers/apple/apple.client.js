"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAppleVerifierForTests = exports.getAppleVerifier = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_status_1 = __importDefault(require("http-status"));
const app_store_server_library_1 = require("@apple/app-store-server-library");
const config_1 = __importDefault(require("../../../../../config"));
const ApiError_1 = __importDefault(require("../../../../../errors/ApiError"));
// Lazy-initialized singleton — only loads certificates on first use so the
// server can still boot even if Apple secrets are not yet configured.
let cachedVerifier = null;
const loadAppleRootCertificates = () => {
    const dir = path_1.default.resolve(config_1.default.apple.rootCertsDir || './secrets/apple-root-certs');
    if (!fs_1.default.existsSync(dir)) {
        throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Apple root certificates directory not found: ${dir}. Download the Apple root CAs from https://www.apple.com/certificateauthority/ and place the .cer files in this folder.`);
    }
    const certFiles = fs_1.default
        .readdirSync(dir)
        .filter(file => file.endsWith('.cer') || file.endsWith('.der'));
    if (certFiles.length === 0) {
        throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `No Apple root certificates (.cer/.der) found in ${dir}`);
    }
    return certFiles.map(file => fs_1.default.readFileSync(path_1.default.join(dir, file)));
};
const getAppleVerifier = () => {
    if (cachedVerifier)
        return cachedVerifier;
    const { bundleId, appAppleId, environment } = config_1.default.apple;
    if (!bundleId) {
        throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'APPLE_BUNDLE_ID environment variable is not configured');
    }
    const rootCerts = loadAppleRootCertificates();
    const env = environment === 'production' ? app_store_server_library_1.Environment.PRODUCTION : app_store_server_library_1.Environment.SANDBOX;
    cachedVerifier = new app_store_server_library_1.SignedDataVerifier(rootCerts, true, // enableOnlineChecks — OCSP revocation verification
    env, bundleId, appAppleId ? Number(appAppleId) : undefined);
    return cachedVerifier;
};
exports.getAppleVerifier = getAppleVerifier;
// Exposed only for tests — resets the cached verifier so new config can take
// effect. Not used by production code paths.
const resetAppleVerifierForTests = () => {
    cachedVerifier = null;
};
exports.resetAppleVerifierForTests = resetAppleVerifierForTests;
