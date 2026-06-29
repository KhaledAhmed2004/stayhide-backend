"use strict";
/**
 * Component Exports
 *
 * All email components are exported from here.
 * To add a new component:
 * 1. Create a new file (e.g., myComponent.ts)
 * 2. Export it here
 * 3. It will automatically be available in EmailBuilder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.otp = exports.divider = exports.table = exports.card = exports.footer = exports.header = exports.button = void 0;
var button_1 = require("./button");
Object.defineProperty(exports, "button", { enumerable: true, get: function () { return button_1.button; } });
var header_1 = require("./header");
Object.defineProperty(exports, "header", { enumerable: true, get: function () { return header_1.header; } });
var footer_1 = require("./footer");
Object.defineProperty(exports, "footer", { enumerable: true, get: function () { return footer_1.footer; } });
var card_1 = require("./card");
Object.defineProperty(exports, "card", { enumerable: true, get: function () { return card_1.card; } });
var table_1 = require("./table");
Object.defineProperty(exports, "table", { enumerable: true, get: function () { return table_1.table; } });
var divider_1 = require("./divider");
Object.defineProperty(exports, "divider", { enumerable: true, get: function () { return divider_1.divider; } });
var otp_1 = require("./otp");
Object.defineProperty(exports, "otp", { enumerable: true, get: function () { return otp_1.otp; } });
