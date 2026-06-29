import mongoose, { Schema, model } from 'mongoose';
import {
  ITicketAttachment,
  TicketAttachmentType,
} from './support-ticket.interface';

// Atomic monotonic counter used to produce human-readable ticket numbers
// like "TCK-1001". `findOneAndUpdate` with `$inc` + `upsert: true` is
// atomic at the MongoDB level — two concurrent ticket creations cannot
// collide and cannot violate the unique index on SupportTicket.ticketNumber.
type ICounter = { key: string; value: number };

const CounterSchema = new Schema<ICounter>({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 1000 },
});

const Counter =
  (mongoose.models.SupportTicketCounter as mongoose.Model<ICounter>) ||
  model<ICounter>('SupportTicketCounter', CounterSchema);

const TICKET_COUNTER_KEY = 'support_ticket';

export const generateTicketNumber = async (): Promise<string> => {
  const doc = await Counter.findOneAndUpdate(
    { key: TICKET_COUNTER_KEY },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `TCK-${doc.value}`;
};

// Map fileHandler output (req.body[fieldName] = url | url[]) into the
// typed attachment shape the model stores. fileHandler resolves images
// under /images, audio+video under /media, and PDFs under /documents,
// so we infer the attachment type from the URL extension. We deliberately
// don't read MIME from req.files because fileHandler doesn't pass that
// downstream in a stable shape.
const guessTypeFromUrl = (url: string): TicketAttachmentType => {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/.test(lower)) return 'image';
  if (/\.(mp4|webm|mov)(\?.*)?$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?.*)?$/.test(lower)) return 'audio';
  return 'file';
};

const filenameFromUrl = (url: string): string | undefined => {
  const segs = url.split('?')[0].split('/');
  return segs[segs.length - 1] || undefined;
};

export const buildAttachmentsFromBody = (
  raw: unknown,
): ITicketAttachment[] => {
  if (!raw) return [];
  const urls = Array.isArray(raw) ? raw : [raw];
  return urls
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .map(url => ({
      type: guessTypeFromUrl(url),
      url,
      name: filenameFromUrl(url),
    }));
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  REOPENED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  CLOSED: ['REOPENED'],
};

export const isValidStatusTransition = (
  from: string,
  to: string,
): boolean => {
  if (from === to) return false;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
};
