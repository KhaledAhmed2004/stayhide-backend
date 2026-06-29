import { Schema, model } from 'mongoose';
import { IDietLog } from './diet-log.interface';

const dietLogSchema = new Schema<IDietLog>(
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
    mealType: {
      type: String,
      enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

export const DietLog = model<IDietLog>('DietLog', dietLogSchema);
