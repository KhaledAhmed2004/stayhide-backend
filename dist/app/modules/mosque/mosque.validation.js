"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MosqueValidation = void 0;
const zod_1 = require("zod");
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const prayerTimesSchema = zod_1.z.object({
    fajr: zod_1.z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    dhuhr: zod_1.z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    asr: zod_1.z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    maghrib: zod_1.z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    isha: zod_1.z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
    jummah: zod_1.z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
});
const locationSchema = zod_1.z.union([
    zod_1.z.object({
        latitude: zod_1.z.preprocess((v) => (v === '' ? undefined : Number(v)), zod_1.z.number().min(-90).max(90)),
        longitude: zod_1.z.preprocess((v) => (v === '' ? undefined : Number(v)), zod_1.z.number().min(-180).max(180)),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('Point'),
        coordinates: zod_1.z.tuple([
            zod_1.z.number().min(-180).max(180), // Longitude
            zod_1.z.number().min(-90).max(90) // Latitude
        ]),
    }),
]);
const createMosqueZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        mosqueName: zod_1.z.string().min(1, 'Mosque name is required'),
        address: zod_1.z.string().min(1, 'Address is required'),
        area: zod_1.z.string().min(1, 'Area is required'),
        phoneNumber: zod_1.z.string().min(1, 'Phone number is required'),
        website: zod_1.z.string().url('Invalid website URL').optional(),
        description: zod_1.z.string().optional(),
        image: zod_1.z.string().optional(),
        location: locationSchema,
        prayerTimes: prayerTimesSchema,
    }),
});
const updateMosqueZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        mosqueId: zod_1.z.string({
            required_error: 'Mosque ID is required',
        }),
    }),
    body: zod_1.z.object({
        mosqueName: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        area: zod_1.z.string().optional(),
        phoneNumber: zod_1.z.string().optional(),
        website: zod_1.z.string().url('Invalid website URL').optional(),
        description: zod_1.z.string().optional(),
        image: zod_1.z.string().optional(),
        location: locationSchema.optional(),
        prayerTimes: prayerTimesSchema.partial().optional(),
    }),
});
exports.MosqueValidation = {
    createMosqueZodSchema,
    updateMosqueZodSchema,
};
