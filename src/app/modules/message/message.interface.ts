import { Model, Types } from 'mongoose';

export type AttachmentType = 'image' | 'audio' | 'video' | 'file';

export type IMessageAttachment = {
  type: AttachmentType;
  url: string;
  name?: string;
  size?: number;
  mime?: string;
  width?: number;
  height?: number;
  duration?: number; // for audio/video
};

export type IMessage = {
  chatId: Types.ObjectId;                              // required
  sender: Types.ObjectId;                              // required
  text?: string;                                       // optional, max 4000 chars; required when type === 'text'
  type: 'text' | 'image' | 'media' | 'doc' | 'mixed'; // required enum
  attachments: IMessageAttachment[];                   // max 10 elements
  readBy: Types.ObjectId[];                            // max 1000 elements
  createdAt: Date;
  updatedAt: Date;
};

export type MessageModel = Model<IMessage>;
