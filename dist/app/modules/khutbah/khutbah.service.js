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
exports.KhutbaService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const khutbah_model_1 = __importDefault(require("./khutbah.model"));
const NotificationBuilder_1 = __importDefault(require("../../builder/NotificationBuilder/NotificationBuilder"));
const user_1 = require("../../../enums/user");
const createKhutbaIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield khutbah_model_1.default.create(payload);
    // Notify all users about new Khutbah
    new NotificationBuilder_1.default()
        .toRole(user_1.USER_ROLES.BROTHER)
        .setTitle('New Khutbah')
        .setText(`New Khutbah published: ${payload.title}`)
        .setType('NEW_KHUTBAH')
        .setResource('Khutbah', result._id.toString())
        .viaAll()
        .send()
        .catch(err => console.error('Notification Error:', err));
    new NotificationBuilder_1.default()
        .toRole(user_1.USER_ROLES.SISTER)
        .setTitle('New Khutbah')
        .setText(`New Khutbah published: ${payload.title}`)
        .setType('NEW_KHUTBAH')
        .setResource('Khutbah', result._id.toString())
        .viaAll()
        .send()
        .catch(err => console.error('Notification Error:', err));
    return result;
});
const getAllKhutbahsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const khutbaQuery = new QueryBuilder_1.default(khutbah_model_1.default.find(), query)
        .textSearch()
        .filter()
        .sort()
        .paginate()
        .fields();
    if (!query.sort && !query.searchTerm) {
        khutbaQuery.modelQuery = khutbaQuery.modelQuery.sort('-date');
    }
    const data = yield khutbaQuery.modelQuery;
    const pagination = yield khutbaQuery.getPaginationInfo();
    return {
        data,
        pagination,
    };
});
const getSingleKhutbaFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield khutbah_model_1.default.findById(id).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Khutba not found');
    }
    return result;
});
const updateKhutbaInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield khutbah_model_1.default.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    }).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Khutba not found');
    }
    return result;
});
const deleteKhutbaFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield khutbah_model_1.default.findByIdAndDelete(id).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Khutba not found');
    }
    return result;
});
exports.KhutbaService = {
    createKhutbaIntoDB,
    getAllKhutbahsFromDB,
    getSingleKhutbaFromDB,
    updateKhutbaInDB,
    deleteKhutbaFromDB,
};
