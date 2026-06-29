import { Document, Types } from 'mongoose';

export type IMealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACKS';

export interface IDietLog extends Document {
  user: Types.ObjectId;
  date: string; // YYYY-MM-DD
  mealType: IMealType;
  name: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
