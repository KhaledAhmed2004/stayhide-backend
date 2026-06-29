import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { Chat } from './chat.model';
import { IPopulatedChat, IChatListResponse } from './chat.interface';
import { batchGetUnreadCounts } from '../../helpers/unreadHelper';
import { errorLogger } from '../../../shared/logger';

const createOrGet = async (
  userId: string,
  otherUserId: string,
): Promise<IPopulatedChat> => {
  // Validate both IDs as valid ObjectIds
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid userId');
  }
  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid otherUserId');
  }

  // Prevent self-chat
  if (userId === otherUserId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Cannot create a chat with yourself',
    );
  }

  // Verify otherUserId exists in the User collection
  const otherUserExists = await User.exists({ _id: otherUserId });
  if (!otherUserExists) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // Find existing chat or create a new one
  let chat = await Chat.findOne({
    participants: { $all: [userId, otherUserId] },
  });

  if (!chat) {
    chat = await Chat.create({ participants: [userId, otherUserId] });
  }

  // Populate participants
  await chat.populate('participants', '_id name profileImage role');

  return chat.toObject() as any;
};

const getList = async (
  userId: string,
  searchTerm?: string,
): Promise<IChatListResponse[]> => {
  // Validate userId as a valid ObjectId (throw 400 if invalid)
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid userId');
  }

  // Single Chat.find with explicit populate and DB-side sort (Req 10)
  const chats = await Chat.find({ participants: userId })
    .sort({ 'lastMessage.createdAt': -1 })
    .populate('participants', '_id name profileImage role')
    .lean();

  // Return empty array when no chats found
  if (!chats || chats.length === 0) {
    return [];
  }

  // Apply optional case-insensitive search filter on the other participant's name (in JS after populate)
  let filteredChats = chats;
  if (searchTerm && searchTerm.trim().length > 0) {
    const searchRegex = new RegExp(searchTerm.trim(), 'i');
    filteredChats = chats.filter(chat => {
      const participants = chat.participants as any[];
      const other = participants.find(p => String(p._id) !== String(userId));
      return other && searchRegex.test(other.name ?? '');
    });
  }

  // Batch-fetch all unread counts via single Redis MGET
  const pairs = filteredChats.map(chat => ({
    chatId: String(chat._id),
    userId: String(userId),
  }));

  let unreadCounts: number[];
  try {
    unreadCounts = await batchGetUnreadCounts(pairs);
  } catch (err) {
    // Return 0 on any Redis error (log with errorLogger)
    errorLogger.error('getList: Redis batchGetUnreadCounts failed', err);
    unreadCounts = filteredChats.map(() => 0);
  }

  // Attach unreadCount and strip the logged-in user from participants
  // so the response only contains the other person in the conversation
  return filteredChats.map((chat, index) => {
    const participants = (chat.participants as any[]).filter(
      p => String(p._id) !== String(userId),
    );
    return {
      ...chat,
      participants,
      unreadCount: unreadCounts[index] ?? 0,
    };
  });
};

export const ChatService = { createOrGet, getList };
