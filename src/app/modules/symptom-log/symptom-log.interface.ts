import { Model, Types } from 'mongoose';

export type MoodValue = 'excellent' | 'good' | 'neutral' | 'bad' | 'very_bad';

export interface ISymptomLog {
  user: Types.ObjectId;
  date: string; // YYYY-MM-DD
  hotFlashes?: {
    count: number;
    severity: number;
  };
  nightSweats?: {
    severity: number;
  };
  mood?: {
    value: MoodValue;
  };
  sleep?: {
    hours: number;
    quality: number;
  };
  brainFog?: {
    severity: number;
  };
  jointPain?: {
    severity: number;
  };
  fatigue?: {
    severity: number;
  };
  anxiety?: {
    severity: number;
  };
  additionalNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SymptomLogModel = Model<ISymptomLog>;
