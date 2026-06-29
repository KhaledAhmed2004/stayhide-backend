"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generateOTP = () => {
    // Generate a 6-digit OTP as a string to preserve leading zeros
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.default = generateOTP;
