"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCoachService = void 0;
const openai_1 = __importDefault(require("openai"));
const config_1 = __importDefault(require("../../../config"));
const ai_coach_model_1 = require("./ai-coach.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const getOpenAIClient = () => {
    if (!config_1.default.openai.apiKey) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'OpenAI API key is not configured');
    }
    return new openai_1.default({
        apiKey: config_1.default.openai.apiKey,
    });
};
const SYSTEM_PROMPT = `You are Miranda, a 24/7 AI Menopause Coach. 
You are here to help the user navigate early menopause — whether it's from cancer treatment, surgery, or premature ovarian failure. 
You are empathetic, knowledgeable, non-judgmental, and you never rush the user. 
Do not provide formal medical diagnoses, but provide supportive, scientifically-backed information about symptoms, HRT, and emotional wellbeing.`;
const getAllSessions = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const sessions = yield ai_coach_model_1.ChatSession.find({ user: userId })
        .select('_id title createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .lean();
    return sessions;
});
const getSessionById = (userId, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield ai_coach_model_1.ChatSession.findOne({ _id: sessionId, user: userId }).lean();
    if (!session) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat session not found');
    }
    // Filter out system messages so the frontend/user doesn't see the internal AI prompt
    session.messages = session.messages.filter((msg) => msg.role !== 'system');
    return session;
});
const sendMessageToMiranda = (userId, messageContent, sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const openai = getOpenAIClient();
    let session;
    let isNewSession = false;
    // 1. Fetch existing session or create a new one
    if (sessionId) {
        session = yield ai_coach_model_1.ChatSession.findOne({ _id: sessionId, user: userId });
        if (!session) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat session not found');
        }
    }
    else {
        // Generate a quick title from the message (first 30 chars)
        const title = messageContent.length > 30 ? messageContent.substring(0, 30) + '...' : messageContent;
        session = new ai_coach_model_1.ChatSession({
            user: userId,
            title,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }],
        });
        isNewSession = true;
    }
    // 2. Append user's new message
    const userMessage = { role: 'user', content: messageContent, timestamp: new Date() };
    session.messages.push(userMessage);
    // 3. Prepare payload for OpenAI (keep only the last 20 messages to save tokens)
    const messagesForOpenAI = session.messages.slice(-20).map(msg => ({
        role: msg.role,
        content: msg.content,
    }));
    // 4. Call OpenAI API
    const response = yield openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messagesForOpenAI,
        max_tokens: 500,
        temperature: 0.7,
    });
    const aiContent = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
    if (!aiContent) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get response from Miranda');
    }
    // 5. Append AI's response and save
    const aiMessage = { role: 'assistant', content: aiContent, timestamp: new Date() };
    session.messages.push(aiMessage);
    yield session.save();
    // 6. Return response
    return {
        sessionId: session._id,
        isNewSession,
        message: aiMessage,
    };
});
exports.AiCoachService = {
    getAllSessions,
    getSessionById,
    sendMessageToMiranda,
};
