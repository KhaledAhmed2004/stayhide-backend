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
exports.lookupCity = void 0;
/**
 * GeoIP city lookup — stub.
 *
 * Returns a human-readable city/country string (e.g. "Chicago, IL")
 * for the supplied IP, or null if unresolvable / no provider wired.
 *
 * Activation: drop in a provider in this file. The shape is async so a
 * remote service (ipapi.co, ipgeolocation.io) or a local MaxMind DB
 * (geoip-lite) can swap in without changing call sites.
 *
 * Until configured, every lookup returns null and the session list
 * surfaces "Unknown" location — graceful degradation.
 */
const logger_1 = require("../shared/logger");
let warnedUnconfigured = false;
const lookupCity = (ip) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ip)
        return null;
    // Localhost / private IPs — never resolvable, don't bother.
    if (ip === '::1' ||
        ip.startsWith('127.') ||
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) {
        return null;
    }
    // No provider wired yet. Log once so the gap is visible in dev logs
    // without spamming production.
    if (!warnedUnconfigured) {
        warnedUnconfigured = true;
        logger_1.logger.info('GeoIP lookup not configured (geoIpHelper.lookupCity returns null). ' +
            'Wire a provider (maxmind / ipapi / etc.) in src/helpers/geoIpHelper.ts.');
    }
    return null;
});
exports.lookupCity = lookupCity;
