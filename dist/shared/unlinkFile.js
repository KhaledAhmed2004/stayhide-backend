"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryPendingUnlinks = void 0;
/**
 * Safe async file unlink with retry tracking.
 *
 * The stored value on a User document can be one of:
 *   - An absolute URL produced by fileHandler, e.g.
 *       `http://localhost:5000/uploads/users/profiles/2026-pic.jpg`
 *   - A relative path like `uploads/users/profiles/2026-pic.jpg`
 *     (some older / migrated rows)
 *   - The self-hosted default `/default-avatar.svg`
 *   - An external URL (legacy `https://i.ibb.co/...` rows)
 *
 * Only paths that resolve to files under the local `uploads/` directory
 * are deleted. External URLs and the system default are skipped.
 *
 * Failures (permission, file busy) are queued for retry by the
 * companion orphan-cleanup cron at `src/shared/orphanFileCleaner.ts`.
 */
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
const UPLOADS_DIR = path_1.default.resolve(process.cwd(), 'uploads');
const failedUnlinks = new Map(); // absolutePath -> attempt count
const MAX_RETRY_ATTEMPTS = 3;
/**
 * Resolve a stored file reference to an absolute path on disk, or null
 * if the reference points outside the local uploads tree (external URL,
 * system default).
 */
const resolveStoredPath = (stored) => {
    if (!stored)
        return null;
    // System default SVG — never delete.
    if (stored === '/default-avatar.svg')
        return null;
    // External URLs (legacy i.ibb.co rows, third-party CDN).
    // Match http:// or https:// hosts whose URL does NOT contain /uploads/.
    if (/^https?:\/\//i.test(stored) && !/\/uploads\//i.test(stored)) {
        return null;
    }
    // Extract the `uploads/...` suffix from either an absolute URL or a
    // relative path. Match the LAST occurrence to be safe.
    const idx = stored.lastIndexOf('uploads/');
    const relative = idx >= 0 ? stored.slice(idx + 'uploads/'.length) : stored.replace(/^\/+/, '');
    const absolute = path_1.default.resolve(UPLOADS_DIR, relative);
    // Path-traversal guard — refuse to delete anything outside the
    // uploads tree even if the stored value contains `..` sequences.
    if (!absolute.startsWith(UPLOADS_DIR + path_1.default.sep) && absolute !== UPLOADS_DIR) {
        logger_1.errorLogger.error(`unlinkFile: refusing path-traversal-suspect '${stored}' -> '${absolute}'`);
        return null;
    }
    return absolute;
};
const unlinkFile = (stored) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const absolute = resolveStoredPath(stored);
    if (!absolute)
        return;
    try {
        yield promises_1.default.unlink(absolute);
        failedUnlinks.delete(absolute);
        (_a = logger_1.logger.debug) === null || _a === void 0 ? void 0 : _a.call(logger_1.logger, `unlinkFile: removed ${absolute}`);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.code) === 'ENOENT') {
            // Already gone — that's a successful end state.
            failedUnlinks.delete(absolute);
            return;
        }
        const attempts = ((_b = failedUnlinks.get(absolute)) !== null && _b !== void 0 ? _b : 0) + 1;
        if (attempts >= MAX_RETRY_ATTEMPTS) {
            failedUnlinks.delete(absolute);
            logger_1.errorLogger.error(`unlinkFile: giving up after ${attempts} attempts on ${absolute}: ${err === null || err === void 0 ? void 0 : err.message}. Orphan cron will catch it.`);
        }
        else {
            failedUnlinks.set(absolute, attempts);
            logger_1.logger.warn(`unlinkFile: attempt ${attempts}/${MAX_RETRY_ATTEMPTS} failed on ${absolute}: ${err === null || err === void 0 ? void 0 : err.message}`);
        }
    }
});
/**
 * Retry all queued unlinks. Called by the orphan-cleanup cron before
 * its sweep so transient-failure paths get one more shot before being
 * treated as true orphans.
 */
const retryPendingUnlinks = () => __awaiter(void 0, void 0, void 0, function* () {
    const targets = Array.from(failedUnlinks.keys());
    let succeeded = 0;
    for (const absolute of targets) {
        try {
            yield promises_1.default.unlink(absolute);
            failedUnlinks.delete(absolute);
            succeeded++;
        }
        catch (err) {
            if ((err === null || err === void 0 ? void 0 : err.code) === 'ENOENT') {
                failedUnlinks.delete(absolute);
                succeeded++;
            }
            // else leave in the queue for the next pass / orphan cron
        }
    }
    return { retried: targets.length, succeeded };
});
exports.retryPendingUnlinks = retryPendingUnlinks;
exports.default = unlinkFile;
