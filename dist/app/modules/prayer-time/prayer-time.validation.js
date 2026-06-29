"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrayerTimeValidation = void 0;
const zod_1 = require("zod");
const getPrayerTimesZodSchema = zod_1.z.object({
    query: zod_1.z.object({
        latitude: zod_1.z.preprocess((val) => (val ? parseFloat(val) : undefined), zod_1.z.number({
            required_error: 'Latitude is required',
            invalid_type_error: 'Latitude must be a valid number',
        })
            .min(-90, 'Latitude must be between -90 and 90')
            .max(90, 'Latitude must be between -90 and 90')),
        longitude: zod_1.z.preprocess((val) => (val ? parseFloat(val) : undefined), zod_1.z.number({
            required_error: 'Longitude is required',
            invalid_type_error: 'Longitude must be a valid number',
        })
            .min(-180, 'Longitude must be between -180 and 180')
            .max(180, 'Longitude must be between -180 and 180')),
        date: zod_1.z.string().optional().refine((val) => {
            if (!val)
                return true;
            return !isNaN(Date.parse(val));
        }, {
            message: 'Invalid date format. Please use a valid date string (e.g., YYYY-MM-DD)',
        }),
        timezone: zod_1.z.string().optional(),
        method: zod_1.z.string().optional(),
        madhab: zod_1.z.enum(['Hanafi', 'Shafi']).optional(),
    }),
});
exports.PrayerTimeValidation = {
    getPrayerTimesZodSchema,
};
