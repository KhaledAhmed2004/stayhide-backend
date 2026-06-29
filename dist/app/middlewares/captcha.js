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
exports.verifyCaptcha = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const captchaHelper_1 = require("../../helpers/captchaHelper");
const logger_1 = require("../../shared/logger");
const verifyCaptcha = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        if (!(0, captchaHelper_1.isConfigured)()) {
            // Dev mode — log once per request so the gap is visible in dev
            // logs but doesn't spam in production where the env is set.
            (_a = logger_1.logger.debug) === null || _a === void 0 ? void 0 : _a.call(logger_1.logger, 'Captcha not configured (TURNSTILE_SECRET unset); skipping');
            return next();
        }
        const token = (_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.captchaToken) !== null && _c !== void 0 ? _c : undefined;
        const remoteIp = (_g = (_d = req.headers['cf-connecting-ip']) !== null && _d !== void 0 ? _d : (_f = (_e = req.headers['x-forwarded-for']) === null || _e === void 0 ? void 0 : _e.split(',')[0]) === null || _f === void 0 ? void 0 : _f.trim()) !== null && _g !== void 0 ? _g : req.ip;
        const result = yield (0, captchaHelper_1.verifyTurnstileToken)(token !== null && token !== void 0 ? token : '', remoteIp);
        if (!result.ok) {
            logger_1.logger.warn(`Captcha rejected (${(_j = (_h = result.errorCodes) === null || _h === void 0 ? void 0 : _h.join(',')) !== null && _j !== void 0 ? _j : 'unknown'}) from ${remoteIp}`);
            return next(new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Captcha verification failed. Please try again.'));
        }
        next();
    });
};
exports.verifyCaptcha = verifyCaptcha;
