import { Schema, model } from 'mongoose';
import { IMedicationLog } from './medicine.interface';

const MedicationLogSchema = new Schema<IMedicationLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    medication: {
      type: Schema.Types.ObjectId,
      ref: 'Medication',
      required: true,
    },
    dateString: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    scheduledTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    status: {
      type: String,
      enum: ['TAKEN', 'SKIPPED', 'MISSED'],
      required: true,
    },
    source: {
      type: String,
      enum: ['USER', 'SYSTEM'],
      required: true,
    },
    takenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent Duplicate Logs Race Condition
MedicationLogSchema.index(
  { user: 1, medication: 1, dateString: 1, scheduledTime: 1 },
  { unique: true },
);

// Optimize History Generation (Millions of logs)
MedicationLogSchema.index({ user: 1, dateString: -1 });

export const MedicationLog = model<IMedicationLog>(
  'MedicationLog',
  MedicationLogSchema,
);
