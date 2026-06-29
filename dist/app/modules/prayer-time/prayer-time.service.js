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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrayerTimeService = void 0;
const adhan_1 = require("adhan");
const date_fns_1 = require("date-fns");
const calculatePrayerTimes = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const { latitude, longitude, date, method, madhab, timezone = 'Asia/Dhaka' } = query;
    // 1. Parse Date (default to current date)
    let targetDate = new Date();
    if (date) {
        const dateParts = date.split('-');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2], 10);
            targetDate = new Date(year, month, day);
        }
        else {
            targetDate = new Date(date);
        }
    }
    // 2. Set coordinates
    const coordinates = new adhan_1.Coordinates(latitude, longitude);
    // 3. Determine calculation method
    let params;
    let methodName = 'Karachi';
    switch (method === null || method === void 0 ? void 0 : method.toLowerCase()) {
        case 'isna':
        case 'northamerica':
            params = adhan_1.CalculationMethod.NorthAmerica();
            methodName = 'ISNA';
            break;
        case 'mwl':
        case 'muslimworldleague':
            params = adhan_1.CalculationMethod.MuslimWorldLeague();
            methodName = 'Muslim World League';
            break;
        case 'egyptian':
            params = adhan_1.CalculationMethod.Egyptian();
            methodName = 'Egyptian General Authority of Survey';
            break;
        case 'qatar':
            params = adhan_1.CalculationMethod.Qatar();
            methodName = 'Qatar';
            break;
        case 'singapore':
            params = adhan_1.CalculationMethod.Singapore();
            methodName = 'Singapore';
            break;
        case 'dubai':
            params = adhan_1.CalculationMethod.Dubai();
            methodName = 'Dubai';
            break;
        case 'kuwait':
            params = adhan_1.CalculationMethod.Kuwait();
            methodName = 'Kuwait';
            break;
        case 'umm_al_qura':
        case 'saudi':
        case 'saudiarabia':
            params = adhan_1.CalculationMethod.UmmAlQura();
            methodName = 'Umm Al-Qura (Saudi Arabia)';
            break;
        case 'turkey':
            params = adhan_1.CalculationMethod.Turkey();
            methodName = 'Turkey';
            break;
        case 'karachi':
        default:
            params = adhan_1.CalculationMethod.Karachi(); // default to Karachi (commonly used in South Asia)
            methodName = 'University of Islamic Sciences, Karachi';
            break;
    }
    // 4. Determine Madhab (default to Hanafi)
    let selectedMadhab = 'Hanafi';
    if (madhab === 'Shafi') {
        params.madhab = adhan_1.Madhab.Shafi;
        selectedMadhab = 'Shafi';
    }
    else {
        params.madhab = adhan_1.Madhab.Hanafi;
    }
    // 5. Calculate Prayer Times
    const prayerTimes = new adhan_1.PrayerTimes(coordinates, targetDate, params);
    // Helper function to format Date object into HH:MM (24-hour style) in the requested timezone
    const formatTime = (time) => {
        try {
            return time.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: timezone,
            });
        }
        catch (error) {
            // Fallback if timezone is invalid
            return time.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Asia/Dhaka',
            });
        }
    };
    // Format Date string as YYYY-MM-DD timezone-neutrally
    const formattedDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    // 6. Calculate additional fields (Weekday, Hijri Date, Location)
    const weekday = (0, date_fns_1.format)(targetDate, 'EEEE');
    // Use a more robust Intl approach for Hijri date
    const hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-uma', {
        day: 'numeric',
        month: 'long',
    });
    // Intl.DateTimeFormat often returns "Month Day". Let's ensure it's "Day Month".
    const parts = hijriFormatter.formatToParts(targetDate);
    const day = (_a = parts.find(p => p.type === 'day')) === null || _a === void 0 ? void 0 : _a.value;
    const month = (_b = parts.find(p => p.type === 'month')) === null || _b === void 0 ? void 0 : _b.value;
    // Clean up month name (replace special characters like ʻ with ')
    const cleanMonth = month === null || month === void 0 ? void 0 : month.replace(/[\u02BB\u02BC\u2018\u2019]/g, "'");
    let hijriDate = `${day} ${cleanMonth}`;
    // Basic check: if it contains a Gregorian month, it failed to use the Islamic calendar
    const gregorianMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (gregorianMonths.some(m => hijriDate.includes(m))) {
        // Fallback if Intl fails
        const fallbackParts = new Intl.DateTimeFormat('en-u-ca-islamic-civil', {
            day: 'numeric',
            month: 'long',
        }).formatToParts(targetDate);
        const fDay = (_c = fallbackParts.find(p => p.type === 'day')) === null || _c === void 0 ? void 0 : _c.value;
        const fMonth = (_e = (_d = fallbackParts.find(p => p.type === 'month')) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.replace(/[\u02BB\u02BC\u2018\u2019]/g, "'");
        hijriDate = `${fDay} ${fMonth}`;
    }
    // Infer simple location from timezone
    let location = (_f = timezone.split('/').pop()) === null || _f === void 0 ? void 0 : _f.replace(/_/g, ' ');
    if (timezone === 'Asia/Dhaka') {
        location = 'Dhaka, Bangladesh';
    }
    const timings = {
        fajr: formatTime(prayerTimes.fajr),
        sunrise: formatTime(prayerTimes.sunrise),
        dhuhr: formatTime(prayerTimes.dhuhr),
        asr: formatTime(prayerTimes.asr),
        maghrib: formatTime(prayerTimes.maghrib),
        isha: formatTime(prayerTimes.isha),
    };
    // Jummah replaces Dhuhr on Fridays (day 5). Astronomically, it starts at the exact same time as Dhuhr.
    if (targetDate.getDay() === 5) {
        timings.jummah = timings.dhuhr;
    }
    return {
        weekday,
        hijriDate,
        location,
        timings,
    };
});
exports.PrayerTimeService = {
    calculatePrayerTimes,
};
