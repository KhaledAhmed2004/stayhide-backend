import { Types, Document } from 'mongoose';

export type TMedicationType =
  | 'TABLET'
  | 'CAPSULE'
  | 'SYRUP'
  | 'INJECTION'
  | 'DROPS'
  | 'INHALER'
  | 'CREAM'
  | 'OINTMENT'
  | 'OTHER';

export type TFrequencyType =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'CUSTOM'
  | 'AS_NEEDED'
  | 'HOURLY';

export type TIntervalUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';

export type TMedicationStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';

export type TLogStatus = 'TAKEN' | 'SKIPPED' | 'MISSED';
export type TLogSource = 'USER' | 'SYSTEM';

export interface IMedication extends Document {
  user: Types.ObjectId;
  name: string;
  dosage: {
    amount: number;
    unit: string;
  };
  type: TMedicationType;
  notes?: string;

  startDate: Date;
  endDate?: Date | null;
  isOngoing: boolean;

  frequency: {
    frequencyType: TFrequencyType;
    interval?: number;
    intervalUnit?: TIntervalUnit;
    daysOfWeek?: number[];
  };
  dosingTimes: string[]; // ['08:00', '20:00']

  reminder: {
    enabled: boolean;
    minutesBefore: number;
  };

  inventory?: {
    totalQuantity: number;
    remainingQuantity: number;
    quantityPerDose: number;
  };

  status: TMedicationStatus;
  archivedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface IMedicationLog extends Document {
  user: Types.ObjectId;
  medication: Types.ObjectId;
  dateString: string; // 'YYYY-MM-DD'
  scheduledTime: string; // '08:00'

  status: TLogStatus;
  source: TLogSource;

  takenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
