import { Schema, model } from 'mongoose';
import { IMessage, MessageModel } from './message.interface';

// Attachment Schema
const AttachmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['image', 'audio', 'video', 'file'],
      required: true,
    },
    url: { type: String, required: true },
    name: { type: String },
    size: { type: Number },
    mime: { type: String },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number }, // For audio/video
  },
  { _id: false }
);

// Message Schema
const messageSchema = new Schema<IMessage, MessageModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Chat',
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    text: {
      type: String,
      required: false,
      maxlength: 10000,
      trim: true,
      validate: {
        validator: function (this: IMessage, value: string | undefined): boolean {
          // When type is 'text', text must be present and non-empty
          if (this.type === 'text') {
            return typeof value === 'string' && value.trim().length > 0;
          }
          return true;
        },
        message: 'text is required and must be non-empty when type is "text"',
      },
    },
    type: {
      type: String,
      enum: ['text', 'image', 'media', 'doc', 'mixed'],
      required: true,
      default: 'text',
    },

    // Unified attachment system (max 10 elements)
    attachments: {
      type: [AttachmentSchema],
      default: [],
      validate: {
        validator: (v: unknown[]): boolean => v.length <= 10,
        message: 'Attachments cannot exceed 10 items',
      },
    },

    // Read tracking (max 1000 elements)
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator: (v: unknown[]): boolean => v.length <= 1000,
        message: 'readBy cannot exceed 1000 entries',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

// NOTE: pre('find') and pre('findOne') auto-populate hooks have been intentionally removed.
// All population must be performed explicitly at the call site:
//   .populate('sender', '_id name profilePicture')

export const Message = model<IMessage, MessageModel>('Message', messageSchema);
