"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const chalk_1 = __importDefault(require("chalk"));
(0, vitest_1.describe)('Colorful Console Log Demo', () => {
    (0, vitest_1.it)('prints logs in different vibrant colors', () => {
        console.log('\n');
        console.log(chalk_1.default.bold.green('🟢 SUCCESS: ') + chalk_1.default.green('Database connection established successfully.'));
        console.log(chalk_1.default.bold.yellow('🟡 WARNING: ') + chalk_1.default.yellow('Memory usage is slightly high (78%).'));
        console.log(chalk_1.default.bold.red('🔴 ERROR:   ') + chalk_1.default.red('Failed to fetch resource from API.'));
        console.log(chalk_1.default.bold.cyan('🔵 INFO:    ') + chalk_1.default.cyan('Server started on port 5002.'));
        console.log(chalk_1.default.bold.magenta('🟣 DEBUG:   ') + chalk_1.default.magenta('Payload received: { id: 100, active: true }\n'));
        // Multi-color styles
        console.log(chalk_1.default.bgBlue.white.bold(' PREMIUM ') +
            chalk_1.default.blue(' Custom styled console logs are extremely clean!\n'));
    });
});
