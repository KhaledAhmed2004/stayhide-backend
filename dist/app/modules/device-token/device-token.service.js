"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.DeviceTokenService = void 0;
const device_token_model_1 = require("./device-token.model");
const device_token_utils_1 = require("./device-token.utils");
exports.DeviceTokenService = {
    addDeviceToken: (userId, token, platform, appVersion, metadata) => __awaiter(void 0, void 0, void 0, function* () {
        const tokenHash = (0, device_token_utils_1.hashDeviceToken)(token);
        const tokenPrefix = (0, device_token_utils_1.tokenPrefixOf)(token);
        // Resolve session metadata before the DB ops.
        const { lookupCity } = yield Promise.resolve().then(() => __importStar(require('../../../helpers/geoIpHelper')));
        const ipHash = (metadata === null || metadata === void 0 ? void 0 : metadata.ip) ? (0, device_token_utils_1.hashIp)(metadata.ip) : undefined;
        const city = (metadata === null || metadata === void 0 ? void 0 : metadata.ip) ? yield lookupCity(metadata.ip) : null;
        const userAgent = (metadata === null || metadata === void 0 ? void 0 : metadata.userAgent) || undefined;
        const now = new Date();
        const update = {
            user: userId,
            token, // Must persist the raw token to allow Firebase FCM delivery
            tokenPrefix,
            lastSeenAt: now,
        };
        if (platform)
            update.platform = platform;
        if (appVersion)
            update.appVersion = appVersion;
        if (ipHash)
            update.lastSeenIpHash = ipHash;
        if (city)
            update.lastSeenCity = city;
        if (userAgent)
            update.userAgent = userAgent;
        // Use findOneAndUpdate with upsert: true and filter by tokenHash.
        // This enforces "Latest login wins": if a different user logs in on 
        // the same physical device, it overwrites the 'user' field, preventing
        // E11000 duplicate key errors and gracefully transferring ownership.
        const updatedToken = yield device_token_model_1.DeviceToken.findOneAndUpdate({ tokenHash }, {
            $set: update,
            $setOnInsert: { firstSeenAt: now } // Only set on creation
        }, { upsert: true, new: true });
        return updatedToken;
    }),
    removeDeviceToken: (userId, token, sessionIatMs) => __awaiter(void 0, void 0, void 0, function* () {
        const tokenHash = (0, device_token_utils_1.hashDeviceToken)(token);
        const query = {
            user: userId,
            tokenHash
        };
        // Prevent race conditions: Ensure we only delete the token if it belongs 
        // to the session that is logging out, not a newer login session.
        if (sessionIatMs) {
            query.lastSeenAt = { $lte: new Date(sessionIatMs) };
        }
        return yield device_token_model_1.DeviceToken.deleteOne(query);
    }),
    revokeAllTokens: (userId) => __awaiter(void 0, void 0, void 0, function* () {
        return yield device_token_model_1.DeviceToken.deleteMany({ user: userId });
    })
};
