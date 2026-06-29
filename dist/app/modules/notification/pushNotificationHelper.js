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
exports.pushNotificationHelper = void 0;
const logger_1 = require("../../../shared/logger");
const config_1 = __importDefault(require("../../../config"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// Decode Base64 Firebase service account
const serviceAccountJson = Buffer.from(config_1.default.firebase_api_key_base64, // the Base64 string from .env
'base64').toString('utf8');
// Parse it as JSON
const serviceAccount = JSON.parse(serviceAccountJson);
// Initialize Firebase SDK
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(serviceAccount),
});
// Multiple users
const sendPushNotifications = (values) => __awaiter(void 0, void 0, void 0, function* () {
    const res = yield firebase_admin_1.default.messaging().sendEachForMulticast(values);
    logger_1.logger.info('Notifications sent successfully', res);
});
// Single user
const sendPushNotification = (values) => __awaiter(void 0, void 0, void 0, function* () {
    const res = yield firebase_admin_1.default.messaging().send(values);
    logger_1.logger.info('Notification sent successfully', res);
});
exports.pushNotificationHelper = {
    sendPushNotifications,
    sendPushNotification,
};
