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
exports.DietLogController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const diet_log_service_1 = require("./diet-log.service");
const createLog = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield diet_log_service_1.DietLogService.createLog(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Diet log created successfully',
        data: result,
    });
}));
const getLogs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const date = req.query.date;
    let result;
    if (date) {
        result = yield diet_log_service_1.DietLogService.getLogsByDate(userId, date);
    }
    else {
        let startDate = req.query.startDate;
        let endDate = req.query.endDate;
        if (!startDate || !endDate) {
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            if (!endDate) {
                endDate = today.toISOString().split('T')[0];
            }
            if (!startDate) {
                startDate = sevenDaysAgo.toISOString().split('T')[0];
            }
        }
        result = yield diet_log_service_1.DietLogService.getHistory(userId, startDate, endDate);
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Diet logs retrieved successfully',
        data: result,
    });
}));
const updateLog = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const logId = req.params.dietLogId;
    const result = yield diet_log_service_1.DietLogService.updateLog(userId, logId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Diet log updated successfully',
        data: result,
    });
}));
const deleteLog = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const logId = req.params.dietLogId;
    const result = yield diet_log_service_1.DietLogService.deleteLog(userId, logId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Diet log deleted successfully',
        data: result,
    });
}));
const getInsights = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield diet_log_service_1.DietLogService.generateInsights(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Diet insights generated successfully',
        data: result,
    });
}));
exports.DietLogController = {
    createLog,
    getLogs,
    updateLog,
    deleteLog,
    getInsights,
};
