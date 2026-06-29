"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeUnlinkDiff = void 0;
const unlinkFile_1 = __importDefault(require("./unlinkFile"));
// Normalize leading slashes so path.join('uploads', file) works cross-platform
const normalize = (p) => (p ? p.replace(/^\/+/, '') : '');
/**
 * Remove files that exist in `oldList` but not in `newList`.
 * Returns number of files removed.
 */
const safeUnlinkDiff = (oldList = [], newList = []) => {
    const oldSet = new Set((oldList || []).filter(Boolean));
    const newSet = new Set((newList || []).filter(Boolean));
    let removed = 0;
    for (const file of oldSet) {
        if (!newSet.has(file)) {
            (0, unlinkFile_1.default)(normalize(file));
            removed += 1;
        }
    }
    return removed;
};
exports.safeUnlinkDiff = safeUnlinkDiff;
exports.default = exports.safeUnlinkDiff;
