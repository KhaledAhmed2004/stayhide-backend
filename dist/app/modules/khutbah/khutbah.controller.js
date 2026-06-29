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
exports.KhutbaController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const khutbah_service_1 = require("./khutbah.service");
const createKhutba = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const _a = req.body, { audio, thumbnail } = _a, rest = __rest(_a, ["audio", "thumbnail"]);
    const result = yield khutbah_service_1.KhutbaService.createKhutbaIntoDB(Object.assign(Object.assign({}, rest), { audioUrl: audio, thumbnailUrl: thumbnail }));
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Khutba created successfully',
        data: result,
    });
}));
const getAllKhutbahs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield khutbah_service_1.KhutbaService.getAllKhutbahsFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Khutbahs fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const getSingleKhutba = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { khutbaId } = req.params;
    const result = yield khutbah_service_1.KhutbaService.getSingleKhutbaFromDB(khutbaId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Khutba fetched successfully',
        data: result,
    });
}));
const updateKhutba = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { khutbaId } = req.params;
    const _a = req.body, { audio, thumbnail } = _a, rest = __rest(_a, ["audio", "thumbnail"]);
    const updateData = Object.assign({}, rest);
    if (audio)
        updateData.audioUrl = audio;
    if (thumbnail)
        updateData.thumbnailUrl = thumbnail;
    const result = yield khutbah_service_1.KhutbaService.updateKhutbaInDB(khutbaId, updateData);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Khutba updated successfully',
        data: result,
    });
}));
const deleteKhutba = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { khutbaId } = req.params;
    const result = yield khutbah_service_1.KhutbaService.deleteKhutbaFromDB(khutbaId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Khutba deleted successfully',
        data: result,
    });
}));
exports.KhutbaController = {
    createKhutba,
    getAllKhutbahs,
    getSingleKhutba,
    updateKhutba,
    deleteKhutba,
};
