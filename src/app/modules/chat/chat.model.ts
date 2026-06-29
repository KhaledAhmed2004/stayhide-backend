import { model, Schema } from 'mongoose';
import { ChatModel, IChat, ILastMessage } from './chat.interface';

const lastMessageSchema = new Schema<ILastMessage>(
  {
    text: { type: String, maxlength: 2000 },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const chatSchema = new Schema<IChat, ChatModel>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (v: unknown[]) => v.length === 2,
        message: 'Chat must have exactly 2 participants',
      },
    },
    lastMessage: { type: lastMessageSchema, default: null },
  },
  { timestamps: true },
);

chatSchema.index({ participants: 1 });

export const Chat = model<IChat, ChatModel>('Chat', chatSchema);
