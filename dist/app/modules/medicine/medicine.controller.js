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
exports.MedicationController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const medicine_service_1 = require("./medicine.service");
const createMedication = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.createMedication(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Medication created successfully',
        data: result,
    });
}));
const getAllMedicines = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.getAllMedicines(userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medicines retrieved successfully',
        meta: result.meta,
        data: result.result,
    });
}));
const getSingleMedicine = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.getSingleMedicine(userId, req.params.medicineId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication retrieved successfully',
        data: result,
    });
}));
const updateMedication = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.updateMedication(userId, req.params.medicineId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication updated successfully',
        data: result,
    });
}));
const archiveMedication = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.archiveMedication(userId, req.params.medicineId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication archived successfully',
        data: result,
    });
}));
const getTodaySchedule = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const dateString = req.query.date;
    const currentTimeStr = req.query.currentTime; // HH:MM
    if (!dateString || !currentTimeStr) {
        throw new Error('date and currentTime query parameters are required');
    }
    const result = yield medicine_service_1.MedicationService.getTodaySchedule(userId, dateString, currentTimeStr);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Today schedule retrieved successfully',
        data: result,
    });
}));
const upsertLog = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.upsertLog(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication log updated successfully',
        data: result,
    });
}));
const getHistory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
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
    const result = yield medicine_service_1.MedicationService.getHistory(userId, startDate, endDate);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication history retrieved successfully',
        data: result,
    });
}));
const getStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.getStats(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication stats retrieved successfully',
        data: result,
    });
}));
const getLogsForMedication = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.getLogsForMedication(userId, req.params.medicineId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication logs retrieved successfully',
        meta: result.meta,
        data: result.result,
    });
}));
const refillInventory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield medicine_service_1.MedicationService.refillInventory(userId, req.params.medicineId, req.body.quantity);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Medication inventory refilled successfully',
        data: result,
    });
}));
const markMissedDoses = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let dateString = req.body.dateString;
    if (!dateString) {
        // Default to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        dateString = yesterday.toISOString().split('T')[0];
    }
    const result = yield medicine_service_1.MedicationService.markMissedDoses(dateString);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Missed doses marked successfully',
        data: result,
    });
}));
exports.MedicationController = {
    createMedication,
    getAllMedicines,
    getSingleMedicine,
    updateMedication,
    archiveMedication,
    getTodaySchedule,
    upsertLog,
    getHistory,
    getStats,
    getLogsForMedication,
    refillInventory,
    markMissedDoses,
};
