import { DietLog } from './diet-log.model';
import { IDietLog } from './diet-log.interface';

const createLog = async (userId: string, payload: Partial<IDietLog>) => {
  payload.user = userId as any;
  const result = await DietLog.create(payload);
  return result;
};

const getLogsByDate = async (userId: string, date: string) => {
  const result = await DietLog.find({ user: userId, date }).sort({ createdAt: 1 });
  return result;
};

const getHistory = async (userId: string, startDate: string, endDate: string) => {
  const result = await DietLog.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: -1, createdAt: -1 });
  return result;
};

const updateLog = async (userId: string, logId: string, payload: Partial<IDietLog>) => {
  const result = await DietLog.findOneAndUpdate(
    { _id: logId, user: userId },
    { $set: payload },
    { new: true, runValidators: true }
  );
  if (!result) {
    throw new Error('Diet log not found or you are not authorized to update it.');
  }
  return result;
};

const deleteLog = async (userId: string, logId: string) => {
  const result = await DietLog.findOneAndDelete({ _id: logId, user: userId });
  if (!result) {
    throw new Error('Diet log not found or you are not authorized to delete it.');
  }
  return result;
};

import { SymptomLog } from '../symptom-log/symptom-log.model';
import { tokenizeFoodItems } from './diet-log.utils';

const generateInsights = async (userId: string) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const endDateStr = today.toISOString().split('T')[0];
  const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const dietLogs = await DietLog.find({
    user: userId,
    date: { $gte: startDateStr, $lte: endDateStr }
  }).lean();
  
  const symptomLogs = await SymptomLog.find({
    user: userId,
    date: { $gte: startDateStr, $lte: endDateStr }
  }).lean();

  const targetSymptoms = ['fatigue', 'brainFog', 'jointPain', 'anxiety'] as const;
  
  const symptomsByDate: Record<string, Record<string, number>> = {};
  symptomLogs.forEach(log => {
    symptomsByDate[log.date] = {};
    targetSymptoms.forEach(sym => {
      symptomsByDate[log.date][sym] = (log as any)[sym]?.severity || 0;
    });
  });

  const getSeverityForDay = (dateStr: string, symptom: string) => {
    const dayDate = new Date(dateStr);
    const nextDayDate = new Date(dayDate);
    nextDayDate.setDate(dayDate.getDate() + 1);
    const nextDayStr = nextDayDate.toISOString().split('T')[0];
    
    const s1 = symptomsByDate[dateStr]?.[symptom] || 0;
    const s2 = symptomsByDate[nextDayStr]?.[symptom] || 0;
    return Math.max(s1, s2);
  };

  const keywordToDates: Record<string, Set<string>> = {};
  const allDatesInWindow = new Set<string>();
  
  dietLogs.forEach(log => {
    allDatesInWindow.add(log.date);
    const keywords = tokenizeFoodItems(log.name);
    keywords.forEach(kw => {
      if (!keywordToDates[kw]) keywordToDates[kw] = new Set();
      keywordToDates[kw].add(log.date);
    });
  });

  const uniqueDatesArray = Array.from(allDatesInWindow);
  if (uniqueDatesArray.length === 0) {
    return { timeframe: '30_days', totalMealsAnalyzed: 0, highRiskTriggers: [], safeFoods: [] };
  }

  const insights = [];
  
  for (const [keyword, datesSet] of Object.entries(keywordToDates)) {
    if (datesSet.size < 3) continue;

    const daysEaten = Array.from(datesSet);
    const daysNotEaten = uniqueDatesArray.filter(d => !datesSet.has(d));

    targetSymptoms.forEach(symptom => {
      const sumEaten = daysEaten.reduce((acc, date) => acc + getSeverityForDay(date, symptom), 0);
      const avgEaten = sumEaten / daysEaten.length;

      let avgNotEaten = 0;
      if (daysNotEaten.length > 0) {
        const sumNotEaten = daysNotEaten.reduce((acc, date) => acc + getSeverityForDay(date, symptom), 0);
        avgNotEaten = sumNotEaten / daysNotEaten.length;
      }

      const triggerPower = avgEaten - avgNotEaten;

      if (triggerPower > 1.5 || triggerPower < -1.5) {
        insights.push({
          food: keyword,
          symptom,
          triggerPower: parseFloat(triggerPower.toFixed(2)),
          type: triggerPower > 1.5 ? 'HIGH_RISK_TRIGGER' : 'SAFE_SOOTHING_FOOD',
          message: triggerPower > 1.5 
            ? `You tend to experience higher ${symptom} when you eat ${keyword}.`
            : `Eating ${keyword} seems to be associated with lower ${symptom}.`
        });
      }
    });
  }

  return {
    timeframe: '30_days',
    totalMealsAnalyzed: dietLogs.length,
    highRiskTriggers: insights.filter(i => i.type === 'HIGH_RISK_TRIGGER'),
    safeFoods: insights.filter(i => i.type === 'SAFE_SOOTHING_FOOD'),
  };
};

export const DietLogService = {
  createLog,
  getLogsByDate,
  getHistory,
  updateLog,
  deleteLog,
  generateInsights,
};
