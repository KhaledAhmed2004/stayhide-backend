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
exports.DuaService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const dua_model_1 = __importDefault(require("./dua.model"));
const createDuaIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield dua_model_1.default.create(payload);
    return result;
});
const getAllDuasFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const duaQuery = new QueryBuilder_1.default(dua_model_1.default.find({ isDeleted: false }), query)
        .textSearch()
        .filter()
        .sort()
        .paginate()
        .fields();
    const data = yield duaQuery.modelQuery;
    const pagination = yield duaQuery.getPaginationInfo();
    return {
        data,
        pagination,
    };
});
const getSingleDuaFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield dua_model_1.default.findOne({ _id: id, isDeleted: false });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Dua not found');
    }
    return result;
});
const updateDuaInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield dua_model_1.default.findOne({ _id: id, isDeleted: false });
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Dua not found');
    }
    const result = yield dua_model_1.default.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteDuaFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield dua_model_1.default.findOne({ _id: id, isDeleted: false });
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Dua not found');
    }
    const result = yield dua_model_1.default.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    return result;
});
exports.DuaService = {
    createDuaIntoDB,
    getAllDuasFromDB,
    getSingleDuaFromDB,
    updateDuaInDB,
    deleteDuaFromDB,
};
