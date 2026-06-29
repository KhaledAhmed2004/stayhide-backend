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
exports.sendNow = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = __importDefault(require("../../../config"));
const logger_1 = require("../../../shared/logger");
/**
 * Singleton Nodemailer transporter. Owned by this module so we never
 * have two pools alive (was previously instantiated in
 * `src/helpers/emailHelper.ts`, which now re-exports from here).
 *
 * Unlike the legacy helper, `sendNow` **throws** on failure — that
 * propagation is required by the queue: a swallowed error would let
 * the service flip a row to SENT when it shouldn't.
 */
let transporter = null;
const getTransporter = () => {
    if (transporter)
        return transporter;
    transporter = nodemailer_1.default.createTransport({
        host: config_1.default.email.host,
        port: Number(config_1.default.email.port),
        secure: false,
        auth: {
            user: config_1.default.email.user,
            pass: config_1.default.email.pass,
        },
    });
    return transporter;
};
/**
 * Synchronous send. Throws on any failure — the caller (queue service)
 * decides retry / DLQ handling. Never logs at error level here: the
 * service logs once, in the right context.
 */
const sendNow = (input) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const info = yield getTransporter().sendMail({
        from: `"Simply Good Food" ${config_1.default.email.from}`,
        to: input.to,
        subject: input.subject,
        html: input.html,
    });
    (_a = logger_1.logger.info) === null || _a === void 0 ? void 0 : _a.call(logger_1.logger, `Mail sent to ${input.to} (id=${info.messageId})`);
    return {
        messageId: (_b = info.messageId) !== null && _b !== void 0 ? _b : null,
        accepted: (_c = info.accepted) !== null && _c !== void 0 ? _c : [],
    };
});
exports.sendNow = sendNow;
