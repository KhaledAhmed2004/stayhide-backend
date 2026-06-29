"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistance = void 0;
/**
 * Calculates the great-circle distance between two points (latitude and longitude)
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in decimal degrees
 * @param lon1 Longitude of point 1 in decimal degrees
 * @param lat2 Latitude of point 2 in decimal degrees
 * @param lon2 Longitude of point 2 in decimal degrees
 * @param unit Unit of distance ('K' for kilometers, 'M' for miles)
 * @returns Distance in the specified unit
 */
const calculateDistance = (lat1, lon1, lat2, lon2, unit = 'K') => {
    if (lat1 === lat2 && lon1 === lon2) {
        return 0;
    }
    const radLat1 = (Math.PI * lat1) / 180;
    const radLat2 = (Math.PI * lat2) / 180;
    const theta = lon1 - lon2;
    const radTheta = (Math.PI * theta) / 180;
    let dist = Math.sin(radLat1) * Math.sin(radLat2) +
        Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);
    if (dist > 1) {
        dist = 1;
    }
    dist = Math.acos(dist);
    dist = (dist * 180) / Math.PI;
    dist = dist * 60 * 1.1515;
    if (unit === 'K') {
        dist = dist * 1.609344;
    }
    return Math.round(dist * 100) / 100; // Round to 2 decimal places
};
exports.calculateDistance = calculateDistance;
