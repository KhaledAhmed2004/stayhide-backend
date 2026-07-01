"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
exports.default = {
    ip_address: process.env.IP_ADDRESS,
    database_url: process.env.DATABASE_URL,
    node_env: process.env.NODE_ENV,
    disable_logs: String(process.env.DISABLE_LOGS).trim() === 'true',
    port: process.env.PORT,
    redis_url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
    frontend_url: process.env.FRONTEND_URL,
    // Project branding configuration
    app: {
        name: process.env.APP_NAME || 'Educoin Backend',
        tagline: process.env.APP_TAGLINE || 'Enterprise API',
        version: process.env.APP_VERSION || '1.0.0',
    },
    // Banner configuration
    banner: {
        enabled: process.env.BANNER_ENABLED !== 'false', // Default true
        style: (process.env.BANNER_STYLE || 'double'),
        asciiFont: process.env.BANNER_ASCII_FONT || 'ANSI Shadow',
        showSystemInfo: process.env.BANNER_SHOW_SYSTEM_INFO !== 'false', // Default true
    },
    // Startup summary configuration
    startupSummary: {
        enabled: process.env.STARTUP_SUMMARY_ENABLED !== 'false', // Default true
        style: (process.env.STARTUP_SUMMARY_STYLE || 'compact'),
        showTimestamp: process.env.STARTUP_SUMMARY_TIMESTAMP !== 'false', // Default true
        colors: process.env.STARTUP_SUMMARY_COLORS !== 'false', // Default true
    },
    jwt: {
        jwt_secret: process.env.JWT_SECRET,
        jwt_expire_in: process.env.JWT_EXPIRE_IN,
        jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
        jwt_refresh_expire_in: process.env.JWT_REFRESH_EXPIRE_IN,
    },
    email: {
        from: process.env.EMAIL_FROM,
        user: process.env.EMAIL_USER,
        port: process.env.EMAIL_PORT,
        host: process.env.EMAIL_HOST,
        pass: process.env.EMAIL_PASS,
    },
    super_admin: {
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
    },
    // Google OAuth client IDs (each platform gets its own in Google Cloud Console)
    google: {
        clientIdIos: process.env.GOOGLE_CLIENT_ID_IOS || '',
        clientIdAndroid: process.env.GOOGLE_CLIENT_ID_ANDROID || '',
        clientIdWeb: process.env.GOOGLE_CLIENT_ID_WEB || '',
    },
    // Apple Sign-In — audience = Bundle ID for native mobile apps
    apple_client_id: process.env.APPLE_CLIENT_ID || '',
    firebase_api_key_base64: process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64,
    firebase_web_push_credentials: process.env.FIREBASE_WEB_PUSH_CREDENTIALS,
    // Apple In-App Purchase (StoreKit 2 + App Store Server API)
    apple: {
        bundleId: process.env.APPLE_BUNDLE_ID || '',
        appAppleId: process.env.APPLE_APP_APPLE_ID,
        keyId: process.env.APPLE_KEY_ID,
        issuerId: process.env.APPLE_ISSUER_ID,
        privateKeyBase64: process.env.APPLE_PRIVATE_KEY_BASE64,
        environment: (process.env.APPLE_ENVIRONMENT || 'sandbox'),
        rootCertsDir: process.env.APPLE_ROOT_CERTS_DIR || './src/config/certs/apple-root-certs',
    },
    // Google Play Billing (Android Publisher API + RTDN via Pub/Sub)
    googlePlay: {
        packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || '',
        serviceAccountBase64: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64 || '',
        // Audience used to verify Pub/Sub push JWTs (set to your webhook URL).
        // If empty, JWT verification is skipped — only do that in dev.
        pubsubAudience: process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE || '',
        // Service account email allowed to send push messages (optional extra
        // check on the verified JWT issuer/email).
        pubsubServiceAccountEmail: process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL || '',
    },
    // 🆕 NEW: Tracing capture configuration
    tracing: {
        capture: {
            enabled: process.env.TRACE_CAPTURE_ARGS !== 'false', // Default true
            args: process.env.TRACE_CAPTURE_ARGS !== 'false',
            returns: process.env.TRACE_CAPTURE_RETURNS !== 'false',
            maxDepth: parseInt(process.env.TRACE_CAPTURE_MAX_DEPTH || '5'),
            maxArrayItems: parseInt(process.env.TRACE_CAPTURE_MAX_ARRAY_ITEMS || '10'),
            maxStringLength: parseInt(process.env.TRACE_CAPTURE_MAX_STRING_LENGTH || '500'),
            maxSizeKB: parseInt(process.env.TRACE_CAPTURE_MAX_SIZE_KB || '5'),
            maskPII: process.env.TRACE_CAPTURE_MASK_PII !== 'false', // Default true
        },
        // 🆕 NEW: Performance monitoring configuration
        performance: {
            enabled: process.env.TRACE_PERF_ENABLED !== 'false', // Default true
            captureMemory: process.env.TRACE_PERF_MEMORY !== 'false',
            captureCPU: process.env.TRACE_PERF_CPU !== 'false',
            captureEventLoop: process.env.TRACE_PERF_EVENT_LOOP !== 'false',
            eventLoopSampleInterval: parseInt(process.env.TRACE_PERF_SAMPLE_INTERVAL || '50'), // ms
            // Display options
            showProgressBars: process.env.TRACE_PERF_SHOW_BARS !== 'false',
            showStatusText: process.env.TRACE_PERF_SHOW_STATUS !== 'false',
            showDetailedBreakdown: process.env.TRACE_PERF_DETAILED !== 'false',
            // Custom thresholds (optional - sensible defaults)
            thresholds: {
                memory: {
                    healthy: parseInt(process.env.TRACE_PERF_MEM_HEALTHY || '50'), // MB - Normal operations (bcrypt, moderate queries)
                    moderate: parseInt(process.env.TRACE_PERF_MEM_MODERATE || '100'), // MB - Heavy operations (file processing)
                    high: parseInt(process.env.TRACE_PERF_MEM_HIGH || '200'), // MB - Very heavy (batch, large files)
                },
                cpu: {
                    efficient: parseInt(process.env.TRACE_PERF_CPU_EFFICIENT || '50'), // % - Simple operations
                    moderate: parseInt(process.env.TRACE_PERF_CPU_MODERATE || '150'), // % - Thread pool use (bcrypt, JWT, crypto)
                    intensive: parseInt(process.env.TRACE_PERF_CPU_INTENSIVE || '300'), // % - Heavy crypto, compression
                },
                eventLoop: {
                    excellent: parseInt(process.env.TRACE_PERF_LOOP_EXCELLENT || '5'), // ms
                    good: parseInt(process.env.TRACE_PERF_LOOP_GOOD || '15'),
                    delayed: parseInt(process.env.TRACE_PERF_LOOP_DELAYED || '30'),
                },
            },
        },
    },
    // Connection module configuration
    connection: {
        max_pending_requests: parseInt(process.env.MAX_PENDING_REQUESTS || '50'),
    },
    // OpenAI configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
    },
};
