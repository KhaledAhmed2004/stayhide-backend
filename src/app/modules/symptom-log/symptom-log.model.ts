import { model, Schema } from 'mongoose';
import { ISymptomLog, SymptomLogModel } from './symptom-log.interface';

const symptomLogSchema = new Schema<ISymptomLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    hotFlashes: {
      count: { type: Number },
      severity: { type: Number, min: 1, max: 5 },
    },
    nightSweats: {
      severity: { type: Number, min: 1, max: 5 },
    },
    mood: {
      value: {
        type: String,
        enum: ['excellent', 'good', 'neutral', 'bad', 'very_bad'],
      },
    },
    sleep: {
      hours: { type: Number, min: 0, max: 24 },
      quality: { type: Number, min: 1, max: 5 },
    },
    brainFog: {
      severity: { type: Number, min: 1, max: 5 },
    },
    jointPain: {
      severity: { type: Number, min: 1, max: 5 },
    },
    fatigue: {
      severity: { type: Number, min: 1, max: 5 },
    },
    anxiety: {
      severity: { type: Number, min: 1, max: 5 },
    },
    additionalNotes: {
      type: String,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// Ensure unique log per user per day
symptomLogSchema.index({ user: 1, date: 1 }, { unique: true });

export const SymptomLog = model<ISymptomLog, SymptomLogModel>('SymptomLog', symptomLogSchema);
