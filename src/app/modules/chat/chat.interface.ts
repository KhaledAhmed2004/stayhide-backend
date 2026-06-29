import { Model, Types } from 'mongoose';

export type ILastMessage = {
  text: string; // capped at 2000 chars
  sender: Types.ObjectId;
  createdAt: Date;
};

export type IChat = {
  participants: Types.ObjectId[]; // exactly 2
  lastMessage: ILastMessage | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IPopulatedParticipant = {
  id: Types.ObjectId;
  name: string;
  role: string;
  profileImage: string;
};

export type IPopulatedChat = Omit<IChat, 'participants'> & {
  participants: IPopulatedParticipant[];
};

export type IChatListResponse = IPopulatedChat & {
  unreadCount: number;
};

export type ChatModel = Model<IChat, Record<string, unknown>>;
