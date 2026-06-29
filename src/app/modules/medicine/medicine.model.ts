import { Schema, model } from 'mongoose';
import { IMedication } from './medicine.interface';

const MedicationSchema = new Schema<IMedication>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      amount: { type: Number, required: true },
      unit: { type: String, required: true, trim: true },
    },
    type: {
      type: String,
      enum: [
        'TABLET',
        'CAPSULE',
        'SYRUP',
        'INJECTION',
        'DROPS',
        'INHALER',
        'CREAM',
        'OINTMENT',
        'OTHER',
      ],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isOngoing: {
      type: Boolean,
      required: true,
    },
    frequency: {
      frequencyType: {
        type: String,
        enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM', 'AS_NEEDED', 'HOURLY'],
        required: true,
      },
      interval: {
        type: Number,
      },
      intervalUnit: {
        type: String,
        enum: ['HOUR', 'DAY', 'WEEK', 'MONTH'],
      },
      daysOfWeek: {
        type: [Number],
        default: undefined,
      },
    },
    dosingTimes: {
      type: [String],
      required: true,
    },
    reminder: {
      enabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      minutesBefore: {
        type: Number,
        required: true,
        default: 5,
      },
    },
    inventory: {
      totalQuantity: {
        type: Number,
      },
      remainingQuantity: {
        type: Number,
      },
      quantityPerDose: {
        type: Number,
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'COMPLETED'],
      default: 'ACTIVE',
      required: true,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
MedicationSchema.index({ user: 1, status: 1, createdAt: -1 });
MedicationSchema.index({ name: 'text' });

export const Medication = model<IMedication>('Medication', MedicationSchema);
