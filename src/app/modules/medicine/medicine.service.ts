import httpStatus from 'http-status';
import { startOfDay, endOfDay, parseISO, format, isBefore, isAfter, addDays, isSameDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import ApiError from '../../../errors/ApiError';
import { IMedication, IMedicationLog } from './medicine.interface';
import { Medication } from './medicine.model';
import { MedicationLog } from './medicine-log.model';

// --- Helper Functions for Scheduling ---
const generateScheduleForDate = (medication: IMedication, targetDateStr: string): string[] => {
  // Parsing the target date. 
  // Note: we're assuming targetDateStr is the local YYYY-MM-DD from the user.
  const targetDate = parseISO(targetDateStr);
  const startDate = startOfDay(new Date(medication.startDate));
  
  if (isBefore(targetDate, startDate)) return [];
  if (!medication.isOngoing && medication.endDate) {
    const endDate = endOfDay(new Date(medication.endDate));
    if (isAfter(targetDate, endDate)) return [];
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

const createMedication = async (
  userId: string,
  payload: Partial<IMedication>,
) => {
  const result = await Medication.create({ ...payload, user: userId });
  return result;
};

const getAllMedicines = async (userId: string, query: Record<string, unknown>) => {
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

  const medicineQuery = new QueryBuilder(
    Medication.find({ user: userId }),
    query,
  )
    .search(['name'])
    .filter()
    .sort()
    .fields();

  const { data: result, meta } = await medicineQuery.cursorPaginate();

  return {
    meta,
    result,
  };
};

const getSingleMedicine = async (userId: string, id: string) => {
  const result = await Medication.findOne({ _id: id, user: userId });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Medication not found');
  }
  return result;
};

const updateMedication = async (
  userId: string,
  id: string,
  payload: Partial<IMedication>,
) => {
  const result = await Medication.findOneAndUpdate(
    { _id: id, user: userId },
    payload,
    { new: true, runValidators: true },
  );
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Medication not found');
  }
  return result;
};

const archiveMedication = async (userId: string, id: string) => {
  const result = await Medication.findOneAndUpdate(
    { _id: id, user: userId, status: 'ACTIVE' },
    { status: 'ARCHIVED', archivedAt: new Date() },
    { new: true },
  ).select('_id status archivedAt');
  
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Medication not found or already archived');
  }
  return result;
};

const getTodaySchedule = async (
  userId: string,
  dateString: string,
  currentTimeStr: string, // 'HH:MM' from frontend to accurately determine overdue
) => {
  const activeMeds = await Medication.find({ user: userId, status: 'ACTIVE' });
  const logs = await MedicationLog.find({ user: userId, dateString });

  const upcoming: any[] = [];
  const taken: any[] = [];
  const overdue: any[] = [];
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
      } else {
        // Not taken (either SKIPPED, MISSED, or pending)
        // Check if overdue based on currentTimeStr
        if (time < currentTimeStr) {
          overdue.push(doseDetails);
        } else {
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
  } else if (taken.length === totalScheduled) {
    compliment = 'Perfect!';
  } else if (taken.length === 0) {
    compliment = 'Time for meds!';
  } else {
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
};

const upsertLog = async (
  userId: string,
  payload: {
    medicationId: string;
    dateString: string;
    scheduledTime: string;
    status: 'TAKEN' | 'SKIPPED' | 'MISSED';
    takenAt?: Date;
  },
) => {
  const { medicationId, dateString, scheduledTime, status, takenAt } = payload;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const medication = await Medication.findOne({ _id: medicationId, user: userId }).session(session);
    if (!medication) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Medication not found');
    }

    // Check existing log
    const existingLog = await MedicationLog.findOne({
      user: userId,
      medication: medicationId,
      dateString,
      scheduledTime,
    }).session(session);

    const previousStatus = existingLog?.status;

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

        await medication.save({ session });
      }
    }

    const updatePayload: any = {
      $set: {
        status,
        source: 'USER',
      }
    };

    if (status === 'TAKEN') {
      updatePayload.$set.takenAt = takenAt || new Date();
    } else {
      updatePayload.$unset = { takenAt: "" };
    }

    // Upsert the log
    const updatedLog = await MedicationLog.findOneAndUpdate(
      { user: userId, medication: medicationId, dateString, scheduledTime },
      updatePayload,
      { upsert: true, new: true, session },
    ).select('_id status dateString scheduledTime takenAt');

    await session.commitTransaction();
    session.endSession();

    return updatedLog;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getHistory = async (userId: string, startDate: string, endDate: string) => {
  // Aggregate logs grouped by dateString
  const history = await MedicationLog.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
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
  await Medication.populate(history, { path: 'logs.medication', select: 'name dosage type' });

  return history;
};

const getStats = async (userId: string) => {
  const activeMedicationsCount = await Medication.countDocuments({ user: userId, status: 'ACTIVE' });
  
  // Calculate lifetime adherence
  const logStats = await MedicationLog.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
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
};

const getLogsForMedication = async (userId: string, medicationId: string, query: Record<string, unknown>) => {
  const logQuery = new QueryBuilder(
    MedicationLog.find({ user: userId, medication: medicationId }),
    query,
  )
    .sort();

  const { data: result, meta } = await logQuery.cursorPaginate();

  return { meta, result };
};

const refillInventory = async (userId: string, medicationId: string, quantity: number) => {
  const medication = await Medication.findOne({ _id: medicationId, user: userId });
  if (!medication) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Medication not found');
  }

  if (!medication.inventory) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Medication does not have inventory tracking enabled');
  }

  medication.inventory.totalQuantity += quantity;
  medication.inventory.remainingQuantity += quantity;
  await medication.save();

  return medication;
};

const markMissedDoses = async (dateString: string) => {
  // Find all active medications
  const activeMeds = await Medication.find({ status: 'ACTIVE' });
  const logs = await MedicationLog.find({ dateString });
  
  let missedLogsCreated = 0;
  let medsCompleted = 0;

  for (const med of activeMeds) {
    // Auto-complete medication if the target date is after the end date
    if (!med.isOngoing && med.endDate) {
      const targetDateObj = parseISO(dateString);
      const endDateObj = endOfDay(new Date(med.endDate));
      if (isAfter(targetDateObj, endDateObj)) {
        med.status = 'COMPLETED';
        await med.save();
        medsCompleted++;
        continue;
      }
    }

    const scheduledTimes = generateScheduleForDate(med, dateString);
    if (scheduledTimes.length === 0) continue;

    for (const time of scheduledTimes) {
      // Check if a log exists for this specific med and time
      const existingLog = logs.find(
        (l) => l.medication.toString() === med._id.toString() && l.scheduledTime === time
      );

      if (!existingLog) {
        // Create a MISSED log
        await MedicationLog.create({
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
};

export const MedicationService = {
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
