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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuaController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const dua_service_1 = require("./dua.service");
const createDua = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const _a = req.body, { audio } = _a, rest = __rest(_a, ["audio"]);
    const result = yield dua_service_1.DuaService.createDuaIntoDB(Object.assign(Object.assign({}, rest), { audioUrl: audio }));
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Dua created successfully',
        data: result,
    });
}));
const getAllDuas = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield dua_service_1.DuaService.getAllDuasFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Duas fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const getSingleDua = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { duaId } = req.params;
    const result = yield dua_service_1.DuaService.getSingleDuaFromDB(duaId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Dua fetched successfully',
        data: result,
    });
}));
const updateDua = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { duaId } = req.params;
    const _a = req.body, { audio } = _a, rest = __rest(_a, ["audio"]);
    const updateData = Object.assign({}, rest);
    if (audio)
        updateData.audioUrl = audio;
    const result = yield dua_service_1.DuaService.updateDuaInDB(duaId, updateData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Dua updated successfully',
        data: {
            id: result === null || result === void 0 ? void 0 : result._id,
            updatedAt: result === null || result === void 0 ? void 0 : result.updatedAt,
        },
    });
}));
const deleteDua = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { duaId } = req.params;
    const result = yield dua_service_1.DuaService.deleteDuaFromDB(duaId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Dua deleted successfully',
        data: { id: result === null || result === void 0 ? void 0 : result._id },
    });
}));
exports.DuaController = {
    createDua,
    getAllDuas,
    getSingleDua,
    updateDua,
    deleteDua,
};
