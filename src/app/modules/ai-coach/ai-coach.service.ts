import OpenAI from 'openai';
import config from '../../../config';
import { ChatSession } from './ai-coach.model';
import { IMessage } from './ai-coach.interface';
import ApiError from '../../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';

const getOpenAIClient = () => {
  if (!config.openai.apiKey) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'OpenAI API key is not configured');
  }
  return new OpenAI({
    apiKey: config.openai.apiKey,
  });
};

const SYSTEM_PROMPT = `You are Miranda, a 24/7 AI Menopause Coach. 
You are here to help the user navigate early menopause — whether it's from cancer treatment, surgery, or premature ovarian failure. 
You are empathetic, knowledgeable, non-judgmental, and you never rush the user. 
Do not provide formal medical diagnoses, but provide supportive, scientifically-backed information about symptoms, HRT, and emotional wellbeing.`;

const getAllSessions = async (userId: string) => {
  const sessions = await ChatSession.find({ user: userId })
    .select('_id title createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
  return sessions;
};

const getSessionById = async (userId: string, sessionId: string) => {
  const session = await ChatSession.findOne({ _id: sessionId, user: userId }).lean();
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Chat session not found');
  }

  // Filter out system messages so the frontend/user doesn't see the internal AI prompt
  session.messages = session.messages.filter((msg: any) => msg.role !== 'system');

  return session;
};

const sendMessageToMiranda = async (userId: string, messageContent: string, sessionId?: string) => {
  const openai = getOpenAIClient();

  let session;
  let isNewSession = false;

  // 1. Fetch existing session or create a new one
  if (sessionId) {
    session = await ChatSession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Chat session not found');
    }
  } else {
    // Generate a quick title from the message (first 30 chars)
    const title = messageContent.length > 30 ? messageContent.substring(0, 30) + '...' : messageContent;
    session = new ChatSession({
      user: userId,
      title,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    });
    isNewSession = true;
  }

  // 2. Append user's new message
  const userMessage: IMessage = { role: 'user', content: messageContent, timestamp: new Date() };
  session.messages.push(userMessage);

  // 3. Prepare payload for OpenAI (keep only the last 20 messages to save tokens)
  const messagesForOpenAI = session.messages.slice(-20).map(msg => ({
    role: msg.role,
    content: msg.content,
  })) as any[];

  // 4. Call OpenAI API
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: messagesForOpenAI,
    max_tokens: 500,
    temperature: 0.7,
  });

  const aiContent = response.choices[0]?.message?.content;
  if (!aiContent) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get response from Miranda');
  }

  // 5. Append AI's response and save
  const aiMessage: IMessage = { role: 'assistant', content: aiContent, timestamp: new Date() };
  session.messages.push(aiMessage);
  await session.save();

  // 6. Return response
  return {
    sessionId: session._id,
    isNewSession,
    message: aiMessage,
  };
};

export const AiCoachService = {
  getAllSessions,
  getSessionById,
  sendMessageToMiranda,
};
