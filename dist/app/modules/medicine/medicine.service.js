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
exports.MedicationService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const date_fns_1 = require("date-fns");
const mongoose_1 = __importDefault(require("mongoose"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const medicine_model_1 = require("./medicine.model");
const medicine_log_model_1 = require("./medicine-log.model");
// --- Helper Functions for Scheduling ---
const generateScheduleForDate = (medication, targetDateStr) => {
    // Parsing the target date. 
    // Note: we're assuming targetDateStr is the local YYYY-MM-DD from the user.
    const targetDate = (0, date_fns_1.parseISO)(targetDateStr);
    const startDate = (0, date_fns_1.startOfDay)(new Date(medication.startDate));
    if ((0, date_fns_1.isBefore)(targetDate, startDate))
        return [];
    if (!medication.isOngoing && medication.endDate) {
        const endDate = (0, date_fns_1.endOfDay)(new Date(medication.endDate));
        if ((0, date_fns_1.isAfter)(targetDate, endDate))
            return [];
    }
    const { frequencyType, interval, daysOfWeek } = medication.frequency;
    if (frequencyType === 'DAILY') {
        return medication.dosingTimes;
    }
    if (frequencyType === 'WEEKLY' && daysOfWeek) {
        // getDay() returns 0 (Sun) to 6 (Sat)
        if (daysOfWeek.includes(targetDate.getDay())) {
            return medication.dosingTimes;
        }
        return [];
    }
    if (frequencyType === 'EVERY_2_DAYS' || frequencyType === 'CUSTOM') {
        const diffTime = Math.abs(targetDate.getTime() - startDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        // Default interval to 1 if not set to prevent divide by zero
        const intervalDays = interval || 1;
        if (diffDays % intervalDays === 0) {
            return medication.dosingTimes;
        }
        return [];
    }
    // Simplified logic for MVP, expand for HOURLY and MONTHLY as needed
    if (frequencyType === 'AS_NEEDED') {
        return [];
    }
    return medication.dosingTimes;
};
// --- Service Functions ---
const createMedication = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield medicine_model_1.Medication.create(Object.assign(Object.assign({}, payload), { user: userId }));
    return result;
});
const getAllMedicines = (userId, query) => __awaiter(void 0, void 0, void 0, function* () {
    // Keep the list view lightweight by excluding unnecessary fields
    if (!query.fields) {
        query.fields = '-createdAt -updatedAt -user -__v -reminder';
    }
    // Default to ACTIVE medicines if no status is explicitly requested
    if (!query.status) {
        query.status = 'ACTIVE';
    }
    // Map 'freqType' from URL to the nested database field 'frequency.frequencyType'
    if (query.freqType) {
        query['frequency.frequencyType'] = query.freqType;
        delete query.freqType;
    }
    const medicineQuery = new QueryBuilder_1.default(medicine_model_1.Medication.find({ user: userId }), query)
        .search(['name'])
        .filter()
        .sort()
        .fields();
    const { data: result, meta } = yield medicineQuery.cursorPaginate();
    return {
        meta,
        result,
    };
});
const getSingleMedicine = (userId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield medicine_model_1.Medication.findOne({ _id: id, user: userId });
    if (!result) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Medication not found');
    }
    return result;
});
const updateMedication = (userId, id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield medicine_model_1.Medication.findOneAndUpdate({ _id: id, user: userId }, payload, { new: true, runValidators: true });
    if (!result) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Medication not found');
    }
    return result;
});
const archiveMedication = (userId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield medicine_model_1.Medication.findOneAndUpdate({ _id: id, user: userId, status: 'ACTIVE' }, { status: 'ARCHIVED', archivedAt: new Date() }, { new: true }).select('_id status archivedAt');
    if (!result) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Medication not found or already archived');
    }
    return result;
});
const getTodaySchedule = (userId, dateString, currentTimeStr) => __awaiter(void 0, void 0, void 0, function* () {
    const activeMeds = yield medicine_model_1.Medication.find({ user: userId, status: 'ACTIVE' });
    const logs = yield medicine_log_model_1.MedicationLog.find({ user: userId, dateString });
    const upcoming = [];
    const taken = [];
    const overdue = [];
    let totalScheduled = 0;
    activeMeds.forEach((med) => {
        const timesForToday = generateScheduleForDate(med, dateString);
        timesForToday.forEach((time) => {
            totalScheduled++;
            const logForTime = logs.find((l) => l.medication.toString() === med._id.toString() && l.scheduledTime === time);
            const doseDetails = {
                medication: med,
                scheduledTime: time,
                log: logForTime || null,
            };
            if (logForTime && logForTime.status === 'TAKEN') {
                taken.push(doseDetails);
            }
            else {
                // Not taken (either SKIPPED, MISSED, or pending)
                // Check if overdue based on currentTimeStr
                if (time < currentTimeStr) {
                    overdue.push(doseDetails);
                }
                else {
                    upcoming.push(doseDetails);
                }
            }
        });
    });
    // Sort groups by time
    upcoming.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    taken.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    overdue.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    const percentage = totalScheduled > 0 ? Math.round((taken.length / totalScheduled) * 100) : 0;
    let compliment = '';
    if (totalScheduled === 0) {
        compliment = 'Enjoy your day!';
    }
    else if (taken.length === totalScheduled) {
        compliment = 'Perfect!';
    }
    else if (taken.length === 0) {
        compliment = 'Time for meds!';
    }
    else {
        compliment = 'Good work!';
    }
    const progress = {
        total: totalScheduled,
        taken: taken.length,
        percentage,
        compliment,
    };
    return {
        progress,
        overdue,
        upcoming,
        taken,
    };
});
const upsertLog = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { medicationId, dateString, scheduledTime, status, takenAt } = payload;
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const medication = yield medicine_model_1.Medication.findOne({ _id: medicationId, user: userId }).session(session);
        if (!medication) {
            throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Medication not found');
        }
        // Check existing log
        const existingLog = yield medicine_log_model_1.MedicationLog.findOne({
            user: userId,
            medication: medicationId,
            dateString,
            scheduledTime,
        }).session(session);
        const previousStatus = existingLog === null || existingLog === void 0 ? void 0 : existingLog.status;
        // Handle Inventory Deductions & Refunds idempotently
        if (medication.inventory && medication.inventory.quantityPerDose) {
            let quantityChange = 0;
            // Transition non-TAKEN -> TAKEN
            if (status === 'TAKEN' && previousStatus !== 'TAKEN') {
                quantityChange = -medication.inventory.quantityPerDose;
            }
            // Transition TAKEN -> non-TAKEN (Undo)
            else if (status !== 'TAKEN' && previousStatus === 'TAKEN') {
                quantityChange = medication.inventory.quantityPerDose;
            }
            if (quantityChange !== 0) {
                medication.inventory.remainingQuantity += quantityChange;
                // Prevent negative inventory just in case
                if (medication.inventory.remainingQuantity < 0) {
                    medication.inventory.remainingQuantity = 0;
                }
                yield medication.save({ session });
            }
        }
        const updatePayload = {
            $set: {
                status,
                source: 'USER',
            }
        };
        if (status === 'TAKEN') {
            updatePayload.$set.takenAt = takenAt || new Date();
        }
        else {
            updatePayload.$unset = { takenAt: "" };
        }
        // Upsert the log
        const updatedLog = yield medicine_log_model_1.MedicationLog.findOneAndUpdate({ user: userId, medication: medicationId, dateString, scheduledTime }, updatePayload, { upsert: true, new: true, session }).select('_id status dateString scheduledTime takenAt');
        yield session.commitTransaction();
        session.endSession();
        return updatedLog;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const getHistory = (userId, startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    // Aggregate logs grouped by dateString
    const history = yield medicine_log_model_1.MedicationLog.aggregate([
        {
            $match: {
                user: new mongoose_1.default.Types.ObjectId(userId),
                dateString: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: '$dateString',
                totalTaken: {
                    $sum: { $cond: [{ $eq: ['$status', 'TAKEN'] }, 1, 0] },
                },
                totalMissed: {
                    $sum: { $cond: [{ $in: ['$status', ['MISSED', 'SKIPPED']] }, 1, 0] },
                },
                logs: {
                    $push: {
                        medication: '$medication',
                        scheduledTime: '$scheduledTime',
                        status: '$status',
                        takenAt: '$takenAt',
                        source: '$source',
                    },
                },
            },
        },
        { $sort: { _id: -1 } }, // Newest first
        {
            $project: {
                date: '$_id',
                _id: 0,
                totalTaken: 1,
                totalMissed: 1,
                logs: 1,
            },
        },
    ]);
    // Optionally populate medication details in the history
    yield medicine_model_1.Medication.populate(history, { path: 'logs.medication', select: 'name dosage type' });
    return history;
});
const getStats = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const activeMedicationsCount = yield medicine_model_1.Medication.countDocuments({ user: userId, status: 'ACTIVE' });
    // Calculate lifetime adherence
    const logStats = yield medicine_log_model_1.MedicationLog.aggregate([
        { $match: { user: new mongoose_1.default.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalLogs: { $sum: 1 },
                totalTaken: {
                    $sum: { $cond: [{ $eq: ['$status', 'TAKEN'] }, 1, 0] },
                },
            },
        },
    ]);
    let adherenceRate = 0;
    if (logStats.length > 0 && logStats[0].totalLogs > 0) {
        adherenceRate = Math.round((logStats[0].totalTaken / logStats[0].totalLogs) * 100);
    }
    return {
        activeMedications: activeMedicationsCount,
        adherenceRate,
    };
});
const getLogsForMedication = (userId, medicationId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const logQuery = new QueryBuilder_1.default(medicine_log_model_1.MedicationLog.find({ user: userId, medication: medicationId }), query)
        .sort();
    const { data: result, meta } = yield logQuery.cursorPaginate();
    return { meta, result };
});
const refillInventory = (userId, medicationId, quantity) => __awaiter(void 0, void 0, void 0, function* () {
    const medication = yield medicine_model_1.Medication.findOne({ _id: medicationId, user: userId });
    if (!medication) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Medication not found');
    }
    if (!medication.inventory) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Medication does not have inventory tracking enabled');
    }
    medication.inventory.totalQuantity += quantity;
    medication.inventory.remainingQuantity += quantity;
    yield medication.save();
    return medication;
});
const markMissedDoses = (dateString) => __awaiter(void 0, void 0, void 0, function* () {
    // Find all active medications
    const activeMeds = yield medicine_model_1.Medication.find({ status: 'ACTIVE' });
    const logs = yield medicine_log_model_1.MedicationLog.find({ dateString });
    let missedLogsCreated = 0;
    let medsCompleted = 0;
    for (const med of activeMeds) {
        // Auto-complete medication if the target date is after the end date
        if (!med.isOngoing && med.endDate) {
            const targetDateObj = (0, date_fns_1.parseISO)(dateString);
            const endDateObj = (0, date_fns_1.endOfDay)(new Date(med.endDate));
            if ((0, date_fns_1.isAfter)(targetDateObj, endDateObj)) {
                med.status = 'COMPLETED';
                yield med.save();
                medsCompleted++;
                continue;
            }
        }
        const scheduledTimes = generateScheduleForDate(med, dateString);
        if (scheduledTimes.length === 0)
            continue;
        for (const time of scheduledTimes) {
            // Check if a log exists for this specific med and time
            const existingLog = logs.find((l) => l.medication.toString() === med._id.toString() && l.scheduledTime === time);
            if (!existingLog) {
                // Create a MISSED log
                yield medicine_log_model_1.MedicationLog.create({
                    user: med.user,
                    medication: med._id,
                    dateString,
                    scheduledTime: time,
                    status: 'MISSED',
                    source: 'SYSTEM'
                });
                missedLogsCreated++;
            }
        }
    }
    return { missedLogsCreated, medsCompleted };
});
exports.MedicationService = {
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
