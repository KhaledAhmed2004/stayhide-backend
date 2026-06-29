"use strict";
/**
 * Theme Exports
 *
 * All themes are exported from here.
 * To add a new theme:
 * 1. Create a new file (e.g., corporate.ts)
 * 2. Export it here
 * 3. It will automatically be available in EmailBuilder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.darkTheme = exports.defaultTheme = void 0;
var default_1 = require("./default");
Object.defineProperty(exports, "defaultTheme", { enumerable: true, get: function () { return default_1.defaultTheme; } });
var dark_1 = require("./dark");
Object.defineProperty(exports, "darkTheme", { enumerable: true, get: function () { return dark_1.darkTheme; } });
