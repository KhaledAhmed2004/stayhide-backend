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
exports.seedSuperAdmin = void 0;
const user_model_1 = require("../app/modules/user/user.model");
const config_1 = __importDefault(require("../config"));
const user_1 = require("../enums/user");
const logger_1 = require("../shared/logger");
const payload = {
    name: 'Administrator',
    email: config_1.default.super_admin.email,
    role: user_1.USER_ROLES.ADMIN,
    password: config_1.default.super_admin.password,
    phone: '+10000000000', // Dummy phone number as it is required in the schema
    dateOfBirth: '1970-01-01T00:00:00.000Z',
    isVerified: true,
    status: user_1.USER_STATUS.ACTIVE,
};
const seedSuperAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    const isExistSuperAdmin = yield user_model_1.User.findOne({
        email: config_1.default.super_admin.email,
        role: user_1.USER_ROLES.ADMIN,
    });
    if (!isExistSuperAdmin) {
        yield user_model_1.User.create(payload);
        logger_1.logger.info('✨ Super Admin account has been successfully created!');
    }
});
exports.seedSuperAdmin = seedSuperAdmin;
