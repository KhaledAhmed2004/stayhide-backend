import { model, Schema } from 'mongoose';
import { IChatSession, ChatSessionModel } from './ai-coach.interface';

const chatSessionSchema = new Schema<IChatSession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['system', 'user', 'assistant'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

export const ChatSession = model<IChatSession, ChatSessionModel>('ChatSession', chatSessionSchema);
