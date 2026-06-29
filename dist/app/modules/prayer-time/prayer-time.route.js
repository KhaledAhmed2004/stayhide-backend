"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrayerTimeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const prayer_time_controller_1 = require("./prayer-time.controller");
const prayer_time_validation_1 = require("./prayer-time.validation");
const router = express_1.default.Router();
router.get('/', (0, validateRequest_1.default)(prayer_time_validation_1.PrayerTimeValidation.getPrayerTimesZodSchema), prayer_time_controller_1.PrayerTimeController.getPrayerTimes);
exports.PrayerTimeRoutes = router;
