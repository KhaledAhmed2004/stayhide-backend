import { Model, Types } from 'mongoose';

export type RoleType = 'system' | 'user' | 'assistant';

export interface IMessage {
  role: RoleType;
  content: string;
  timestamp: Date;
}

export interface IChatSession {
  user: Types.ObjectId;
  title: string;
  messages: IMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChatSessionModel = Model<IChatSession>;
