"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSpinner = createSpinner;
exports.getSpinnerHelper = getSpinnerHelper;
const ora_1 = __importDefault(require("ora"));
const colors_1 = __importDefault(require("colors"));
const DEFAULT_THRESHOLDS = {
    fast: 100,
    moderate: 500,
};
class SpinnerHelper {
    constructor() {
        this.spinner = null;
        this.startTime = 0;
        // Check if we're in a TTY environment (interactive terminal)
        // Disable in CI/CD environments
        this.isTTY = process.stdout.isTTY === true && !process.env.CI;
    }
    /**
     * Start a new spinner
     */
    start(options) {
        this.startTime = Date.now();
        if (this.isTTY) {
            this.spinner = (0, ora_1.default)({
                text: options.text,
                color: options.color || 'cyan',
            }).start();
        }
        else {
            // In CI/CD, just log the text
            console.log(`⠹ ${options.text}`);
        }
        return this;
    }
    /**
     * Mark spinner as successful with timing
     */
    succeed(text, showTiming = true) {
        const elapsed = Date.now() - this.startTime;
        const timingText = showTiming ? this.getTimingText(elapsed) : '';
        const finalText = text
            ? showTiming
                ? `${text} ${timingText}`
                : text
            : undefined;
        if (this.isTTY && this.spinner) {
            this.spinner.succeed(finalText);
        }
        else {
            console.log(`✔ ${finalText || 'Done'}`);
        }
        this.reset();
        return this;
    }
    /**
     * Mark spinner as failed
     */
    fail(text) {
        const elapsed = Date.now() - this.startTime;
        const finalText = text ? `${text} (${elapsed}ms)` : undefined;
        if (this.isTTY && this.spinner) {
            this.spinner.fail(finalText);
        }
        else {
            console.log(`✖ ${finalText || 'Failed'}`);
        }
        this.reset();
        return this;
    }
    /**
     * Show info message
     */
    info(text) {
        if (this.isTTY && this.spinner) {
            this.spinner.info(text);
        }
        else {
            console.log(`ℹ ${text}`);
        }
        this.reset();
        return this;
    }
    /**
     * Show warning message
     */
    warn(text) {
        if (this.isTTY && this.spinner) {
            this.spinner.warn(text);
        }
        else {
            console.log(`⚠ ${text}`);
        }
        this.reset();
        return this;
    }
    /**
     * Update spinner text (only works in TTY mode)
     */
    updateText(text) {
        if (this.isTTY && this.spinner) {
            this.spinner.text = text;
        }
        return this;
    }
    /**
     * Stop spinner without success/fail
     */
    stop() {
        if (this.isTTY && this.spinner) {
            this.spinner.stop();
        }
        this.reset();
        return this;
    }
    /**
     * Get timing text with color coding based on performance
     */
    getTimingText(elapsed, thresholds = DEFAULT_THRESHOLDS) {
        const timingMs = `(${elapsed}ms)`;
        if (!this.isTTY) {
            // No colors in CI/CD
            return timingMs;
        }
        // Color-code based on performance
        if (elapsed < thresholds.fast) {
            // Fast - green
            return colors_1.default.green(timingMs);
        }
        else if (elapsed < thresholds.moderate) {
            // Moderate - yellow
            return colors_1.default.yellow(timingMs);
        }
        else {
            // Slow - red with warning
            return colors_1.default.red(timingMs) + ' ' + colors_1.default.yellow('⚠️ Slow');
        }
    }
    /**
     * Reset spinner state
     */
    reset() {
        this.spinner = null;
        this.startTime = 0;
    }
    /**
     * Check if running in TTY mode
     */
    isInteractive() {
        return this.isTTY;
    }
}
/**
 * Create a new spinner instance
 */
function createSpinner(options) {
    const spinner = new SpinnerHelper();
    spinner.start(options);
    return spinner;
}
/**
 * Create a spinner helper without starting it
 */
function getSpinnerHelper() {
    return new SpinnerHelper();
}
exports.default = SpinnerHelper;
