"use strict";
/**
 * Performance Metrics Utilities
 *
 * Provides utilities for capturing and formatting memory, CPU, and event loop metrics.
 * Used for performance monitoring and health status tracking in the logging system.
 *
 * Features:
 * - Memory snapshot capture (heap, RSS, external)
 * - CPU usage tracking (user, system time)
 * - Event loop lag measurement
 * - Health status calculation with thresholds
 * - Progress bar generation for visual display
 * - Color-coded status formatting
 */
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
exports.captureMemorySnapshot = captureMemorySnapshot;
exports.captureCPUUsage = captureCPUUsage;
exports.measureEventLoopLag = measureEventLoopLag;
exports.calculateMemoryGrowth = calculateMemoryGrowth;
exports.calculateMemoryGrowthPercent = calculateMemoryGrowthPercent;
exports.calculateCPUTime = calculateCPUTime;
exports.calculateCPUOverhead = calculateCPUOverhead;
exports.calculateEventLoopMetrics = calculateEventLoopMetrics;
exports.getMemoryHealth = getMemoryHealth;
exports.getCPUHealth = getCPUHealth;
exports.getEventLoopHealth = getEventLoopHealth;
exports.formatBytes = formatBytes;
exports.formatProgressBar = formatProgressBar;
exports.getHealthColor = getHealthColor;
exports.getHealthEmoji = getHealthEmoji;
exports.getHealthDescription = getHealthDescription;
exports.getOverallHealth = getOverallHealth;
const colors_1 = __importDefault(require("colors"));
// ============================================================================
// CAPTURE FUNCTIONS
// ============================================================================
/**
 * Capture current memory usage snapshot
 */
function captureMemorySnapshot() {
    const mem = process.memoryUsage();
    return {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers,
        timestamp: Date.now(),
    };
}
/**
 * Capture current CPU usage
 */
function captureCPUUsage() {
    const cpu = process.cpuUsage();
    return {
        user: cpu.user,
        system: cpu.system,
        timestamp: Date.now(),
    };
}
/**
 * Measure event loop lag (async, non-blocking)
 * Returns delay in milliseconds
 */
function measureEventLoopLag() {
    return __awaiter(this, void 0, void 0, function* () {
        const start = Date.now();
        return new Promise((resolve) => {
            setImmediate(() => {
                const lag = Date.now() - start;
                resolve(lag);
            });
        });
    });
}
// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================
/**
 * Calculate memory growth between two snapshots
 * Returns growth in MB
 */
function calculateMemoryGrowth(start, end) {
    const growthBytes = end.heapUsed - start.heapUsed;
    return Math.round((growthBytes / 1024 / 1024) * 10) / 10; // MB with 1 decimal
}
/**
 * Calculate memory growth percentage
 */
function calculateMemoryGrowthPercent(start, end) {
    if (start.heapUsed === 0)
        return 0;
    const growth = ((end.heapUsed - start.heapUsed) / start.heapUsed) * 100;
    return Math.round(growth * 10) / 10; // 1 decimal
}
/**
 * Calculate CPU time spent between two measurements
 * Returns object with user, system, and total time in milliseconds
 */
function calculateCPUTime(start, end) {
    const userMicros = end.user - start.user;
    const systemMicros = end.system - start.system;
    return {
        userMs: Math.round(userMicros / 1000), // Convert to ms
        systemMs: Math.round(systemMicros / 1000),
        totalMs: Math.round((userMicros + systemMicros) / 1000),
    };
}
/**
 * Calculate CPU overhead percentage relative to request duration
 */
function calculateCPUOverhead(cpuTimeMs, requestDurationMs) {
    if (requestDurationMs === 0)
        return 0;
    const overhead = (cpuTimeMs / requestDurationMs) * 100;
    return Math.round(overhead * 10) / 10; // 1 decimal
}
/**
 * Calculate event loop metrics from samples
 */
function calculateEventLoopMetrics(samples) {
    if (samples.length === 0) {
        return {
            samples: [],
            avgLag: 0,
            peakLag: 0,
            sampleCount: 0,
        };
    }
    const avgLag = samples.reduce((sum, lag) => sum + lag, 0) / samples.length;
    const peakLag = Math.max(...samples);
    return {
        samples,
        avgLag: Math.round(avgLag * 10) / 10, // 1 decimal
        peakLag: Math.round(peakLag * 10) / 10,
        sampleCount: samples.length,
    };
}
// ============================================================================
// HEALTH STATUS CALCULATORS
// ============================================================================
/**
 * Get memory health status based on growth
 */
function getMemoryHealth(growthMB, thresholds) {
    if (growthMB < thresholds.healthy)
        return 'Healthy';
    if (growthMB < thresholds.moderate)
        return 'Moderate';
    if (growthMB < thresholds.high)
        return 'High';
    return 'Critical';
}
/**
 * Get CPU health status based on overhead percentage
 */
function getCPUHealth(overheadPercent, thresholds) {
    if (overheadPercent < thresholds.efficient)
        return 'Efficient';
    if (overheadPercent < thresholds.moderate)
        return 'Moderate';
    if (overheadPercent < thresholds.intensive)
        return 'Intensive';
    return 'Overloaded';
}
/**
 * Get event loop health status based on average lag
 */
function getEventLoopHealth(avgLagMs, thresholds) {
    if (avgLagMs < thresholds.excellent)
        return 'Excellent';
    if (avgLagMs < thresholds.good)
        return 'Good';
    if (avgLagMs < thresholds.delayed)
        return 'Delayed';
    return 'Blocked';
}
// ============================================================================
// VISUAL FORMATTING
// ============================================================================
/**
 * Format bytes to human-readable string (KB, MB, GB)
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    const rounded = Math.round(value * 10) / 10; // 1 decimal
    return `${rounded} ${sizes[i]}`;
}
/**
 * Generate progress bar visualization
 * @param value - Current value
 * @param max - Maximum value (100% point)
 * @param width - Total width of bar in characters (default: 10)
 * @returns String like "████░░░░░░"
 */
function formatProgressBar(value, max, width = 10) {
    if (max === 0)
        return '░'.repeat(width);
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
/**
 * Get color function based on health status
 */
function getHealthColor(status) {
    switch (status) {
        case 'Healthy':
        case 'Efficient':
        case 'Excellent':
            return colors_1.default.green.bold;
        case 'Moderate':
        case 'Good':
            return colors_1.default.yellow.bold;
        case 'High':
        case 'Intensive':
        case 'Delayed':
            return colors_1.default.magenta.bold; // Orange-ish
        case 'Critical':
        case 'Overloaded':
        case 'Blocked':
            return colors_1.default.red.bold;
        default:
            return colors_1.default.white;
    }
}
/**
 * Get emoji indicator for health status
 */
function getHealthEmoji(status) {
    switch (status) {
        case 'Healthy':
        case 'Efficient':
        case 'Excellent':
            return '✅';
        case 'Moderate':
        case 'Good':
            return '⚠️';
        case 'High':
        case 'Intensive':
        case 'Delayed':
            return '🟠';
        case 'Critical':
        case 'Overloaded':
        case 'Blocked':
            return '🔴';
        default:
            return '';
    }
}
/**
 * Get health status description/recommendation
 */
function getHealthDescription(status, type) {
    if (type === 'memory') {
        switch (status) {
            case 'Healthy':
                return 'Normal memory usage';
            case 'Moderate':
                return 'Expected for complex operations';
            case 'High':
                return 'High allocation - monitor if persistent';
            case 'Critical':
                return 'Very high allocation - check for leaks if sustained across requests';
        }
    }
    if (type === 'cpu') {
        switch (status) {
            case 'Efficient':
                return 'Low CPU consumption';
            case 'Moderate':
                return 'Normal CPU usage (may use thread pool)';
            case 'Intensive':
                return 'CPU-intensive operation (crypto/compression/bcrypt)';
            case 'Overloaded':
                return 'Very high CPU - expected for crypto ops, investigate if sustained';
        }
    }
    if (type === 'eventLoop') {
        switch (status) {
            case 'Excellent':
                return 'Event loop healthy';
            case 'Good':
                return 'Some delay detected';
            case 'Delayed':
                return 'Event loop under pressure';
            case 'Blocked':
                return 'Event loop seriously delayed!';
        }
    }
    return '';
}
/**
 * Get overall health status from all metrics
 */
function getOverallHealth(memoryStatus, cpuStatus, eventLoopStatus) {
    // Priority: Critical > High/Overloaded/Blocked > Moderate/Good > Healthy/Efficient/Excellent
    if (memoryStatus === 'Critical' ||
        cpuStatus === 'Overloaded' ||
        eventLoopStatus === 'Blocked') {
        return {
            status: 'Critical',
            emoji: '🔴',
            message: 'Immediate attention required!',
        };
    }
    if (memoryStatus === 'High' ||
        cpuStatus === 'Intensive' ||
        eventLoopStatus === 'Delayed') {
        return {
            status: 'Warning',
            emoji: '🟠',
            message: 'Performance issues detected',
        };
    }
    if (memoryStatus === 'Moderate' ||
        cpuStatus === 'Moderate' ||
        eventLoopStatus === 'Good') {
        let message = 'Monitor ';
        const issues = [];
        if (memoryStatus === 'Moderate')
            issues.push('memory usage');
        if (cpuStatus === 'Moderate')
            issues.push('CPU usage');
        if (eventLoopStatus === 'Good')
            issues.push('event loop');
        message += issues.join(' and ');
        return {
            status: 'Moderate',
            emoji: '⚠️',
            message,
        };
    }
    return {
        status: 'Excellent',
        emoji: '✅',
        message: 'All metrics healthy',
    };
}
