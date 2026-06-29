"use strict";
/**
 * Notification Template Exports
 *
 * All notification templates are exported from here.
 * To add a new template:
 * 1. Create a new file (e.g., myTemplate.ts)
 * 2. Export it here
 * 3. It will automatically be available in NotificationBuilder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemAlert = exports.welcome = void 0;
var welcome_1 = require("./welcome");
Object.defineProperty(exports, "welcome", { enumerable: true, get: function () { return welcome_1.welcome; } });
var systemAlert_1 = require("./systemAlert");
Object.defineProperty(exports, "systemAlert", { enumerable: true, get: function () { return systemAlert_1.systemAlert; } });
