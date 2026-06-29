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
exports.PRAYER_STEPS = void 0;
exports.runSeed = runSeed;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const seedNamaz_1 = require("../DB/seedNamaz");
Object.defineProperty(exports, "PRAYER_STEPS", { enumerable: true, get: function () { return seedNamaz_1.PRAYER_STEPS; } });
function runSeed(steps, model) {
    return __awaiter(this, void 0, void 0, function* () {
        const succeeded = [];
        for (const step of steps) {
            const op = {
                updateOne: {
                    filter: { stepKey: step.stepKey },
                    update: { $set: step },
                    upsert: true,
                },
            };
            try {
                yield model.bulkWrite([op]);
                succeeded.push(step.stepKey);
            }
            catch (err) {
                // continue to next step — Requirement 1.4
            }
        }
        return succeeded;
    });
}
function runStandaloneSeed() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connect(config_1.default.database_url);
            console.log('[seed-namaz] Connected to MongoDB');
            yield (0, seedNamaz_1.seedNamaz)();
            console.log('[seed-namaz] Seeding complete');
        }
        catch (err) {
            console.error('[seed-namaz] Unexpected error during seeding:', err);
            process.exit(1);
        }
        finally {
            yield mongoose_1.default.disconnect();
        }
    });
}
// Only run when this file is executed directly (not when imported by tests)
if (require.main === module) {
    runStandaloneSeed().catch(err => {
        console.error('[seed-namaz] Unexpected error:', err);
        process.exit(1);
    });
}
