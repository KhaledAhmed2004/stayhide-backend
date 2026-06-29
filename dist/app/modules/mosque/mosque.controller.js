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
exports.MosqueController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const mosque_service_1 = require("./mosque.service");
const getFilePath_1 = require("../../../shared/getFilePath");
const createMosque = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.files) {
        const image = (0, getFilePath_1.getSingleFilePath)(req.files, 'image');
        if (image) {
            req.body.image = image;
        }
    }
    const result = yield mosque_service_1.MosqueService.createMosqueIntoDB(req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Mosque created successfully',
        data: result,
    });
}));
const getAllMosques = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield mosque_service_1.MosqueService.getAllMosquesFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Mosques fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const getSingleMosque = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { mosqueId } = req.params;
    const result = yield mosque_service_1.MosqueService.getSingleMosqueFromDB(mosqueId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Mosque fetched successfully',
        data: result,
    });
}));
const updateMosque = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { mosqueId } = req.params;
    if (req.files) {
        const image = (0, getFilePath_1.getSingleFilePath)(req.files, 'image');
        if (image) {
            req.body.image = image;
        }
    }
    const result = yield mosque_service_1.MosqueService.updateMosqueIntoDB(mosqueId, req.body);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Mosque updated successfully',
        data: result,
    });
}));
const deleteMosque = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { mosqueId } = req.params;
    const result = yield mosque_service_1.MosqueService.deleteMosqueFromDB(mosqueId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Mosque deleted successfully',
        data: { id: result === null || result === void 0 ? void 0 : result._id },
    });
}));
exports.MosqueController = {
    createMosque,
    getAllMosques,
    getSingleMosque,
    updateMosque,
    deleteMosque,
};
