/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Habit,
  DailyLog,
  ScheduleItem,
  GeminiCommandAction,
  GeminiCommandResult,
} from '../types';

export interface CommandContextPayload {
  todayDate: string;
  currentTime: string;
  dayOfWeek: number;
  habits: Habit[];
  scheduleItems: ScheduleItem[];
  todayLogs: Record<string, { completed: boolean; isOffForToday?: boolean }>;
  availableCategories: string[];
}

export interface SettlementChanges {
  habits: Habit[];
  dailyLogs: Record<string, DailyLog>;
  scheduleItems: ScheduleItem[];
  theme?: 'light' | 'dark';
}

/**
 * Send natural language command to server-side Gemini endpoint
 */
export async function sendCommandToGemini(
  command: string,
  context: CommandContextPayload
): Promise<GeminiCommandResult> {
  const res = await fetch('/api/gemini-command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command,
      context: {
        todayDate: context.todayDate,
        currentTime: context.currentTime,
        dayOfWeek: context.dayOfWeek,
        habits: context.habits.map((h) => ({
          id: h.id,
          name: h.name,
          category: h.category,
          isTask: h.isTask,
          alarmTime: h.alarmTime,
        })),
        todayLogs: context.todayLogs,
        scheduleItems: context.scheduleItems.map((s) => ({
          id: s.id,
          title: s.title,
          time: s.time,
          alarmEnabled: s.alarmEnabled,
          days: s.days,
        })),
        availableCategories: context.availableCategories,
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Gemini command failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Settle actions returned by Gemini autonomously onto the application state
 */
export function applyGeminiActions(
  actions: GeminiCommandAction[],
  currentState: {
    habits: Habit[];
    dailyLogs: Record<string, DailyLog>;
    scheduleItems: ScheduleItem[];
  },
  todayDate: string,
  currentDow: number
): SettlementChanges {
  let newHabits = [...currentState.habits];
  let newDailyLogs = { ...currentState.dailyLogs };
  let newScheduleItems = [...currentState.scheduleItems];
  let settlementTheme: 'light' | 'dark' | undefined;

  for (const action of actions) {
    switch (action.type) {
      case 'SET_HABITS_OFF_FOR_TODAY': {
        const reason = action.reason || 'Rest Day';
        const targetHabitIds = action.allHabits
          ? newHabits.filter((h) => !h.isArchived).map((h) => h.id)
          : action.habitIds || [];

        for (const hid of targetHabitIds) {
          const logId = `${hid}_${todayDate}`;
          const existing = newDailyLogs[logId] || {
            id: logId,
            habitId: hid,
            date: todayDate,
            completed: false,
            completedSubtasks: [],
          };

          newDailyLogs[logId] = {
            ...existing,
            isOffForToday: true,
            offReason: reason,
          };
        }
        break;
      }

      case 'RESUME_HABITS_FOR_TODAY': {
        const targetHabitIds = action.allHabits
          ? newHabits.filter((h) => !h.isArchived).map((h) => h.id)
          : action.habitIds || [];

        for (const hid of targetHabitIds) {
          const logId = `${hid}_${todayDate}`;
          if (newDailyLogs[logId]) {
            newDailyLogs[logId] = {
              ...newDailyLogs[logId],
              isOffForToday: false,
              offReason: undefined,
            };
          }
        }
        break;
      }

      case 'TOGGLE_HABIT_TODAY': {
        let targetId = action.habitId;
        if (!targetId && action.habitName) {
          const match = newHabits.find(
            (h) => h.name.toLowerCase() === action.habitName?.toLowerCase()
          );
          if (match) targetId = match.id;
        }

        if (targetId) {
          const habit = newHabits.find((h) => h.id === targetId);
          const logId = `${targetId}_${todayDate}`;
          const existing = newDailyLogs[logId] || {
            id: logId,
            habitId: targetId,
            date: todayDate,
            completed: false,
            completedSubtasks: [],
          };

          const isCompleted = action.completed ?? true;
          newDailyLogs[logId] = {
            ...existing,
            completed: isCompleted,
            isOffForToday: false,
            completedSubtasks: isCompleted && habit?.subtasks ? habit.subtasks.map((s) => s.id) : [],
            value: action.value !== undefined ? action.value : existing.value,
          };
        }
        break;
      }

      case 'CREATE_HABIT': {
        if (action.habitData?.name) {
          const hd = action.habitData;
          const newHabit: Habit = {
            id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: hd.name,
            type: 'simple',
            isTask: Boolean(hd.isTask),
            emoji: hd.emoji || '✨',
            color: hd.color || 'indigo',
            category: hd.category || 'General',
            frequency: hd.frequency || 'daily',
            frequencyDays: hd.frequencyDays || [0, 1, 2, 3, 4, 5, 6],
            dueDate: hd.dueDate,
            alarmTime: hd.alarmTime,
            alarmEnabled: Boolean(hd.alarmTime),
            alarmSound: hd.alarmSound || 'soft_chime',
            order: newHabits.length,
            subtasks: [],
            createdAt: new Date().toISOString(),
            isArchived: false,
          };
          newHabits.push(newHabit);
        }
        break;
      }

      case 'DELETE_HABIT': {
        if (action.habitIds?.length) {
          newHabits = newHabits.filter((h) => !action.habitIds?.includes(h.id));
        }
        break;
      }

      case 'ADD_SCHEDULE_ITEM': {
        if (action.scheduleItemData?.title && action.scheduleItemData.time) {
          const sd = action.scheduleItemData;
          const newItem: ScheduleItem = {
            id: `sch_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: sd.title,
            time: sd.time,
            category: sd.category || 'Routine',
            emoji: sd.emoji || '📌',
            alarmEnabled: sd.alarmEnabled ?? true,
            alarmSound: sd.alarmSound || 'soft_chime',
            days: sd.days && sd.days.length > 0 ? sd.days : [currentDow],
          };
          newScheduleItems.push(newItem);
        }
        break;
      }

      case 'UPDATE_SCHEDULE_ITEM': {
        newScheduleItems = newScheduleItems.map((item) => {
          const isMatch =
            (action.scheduleItemId && item.id === action.scheduleItemId) ||
            (action.scheduleTitleMatch &&
              item.title.toLowerCase().includes(action.scheduleTitleMatch.toLowerCase()));

          if (isMatch && action.updatedFields) {
            return {
              ...item,
              ...action.updatedFields,
            };
          }
          return item;
        });
        break;
      }

      case 'DELETE_SCHEDULE_ITEM': {
        newScheduleItems = newScheduleItems.filter((item) => {
          if (action.scheduleItemId && item.id === action.scheduleItemId) return false;
          if (
            action.scheduleTitleMatch &&
            item.title.toLowerCase().includes(action.scheduleTitleMatch.toLowerCase())
          ) {
            return false;
          }
          return true;
        });
        break;
      }

      case 'DISABLE_ALARMS_FOR_TODAY': {
        newScheduleItems = newScheduleItems.map((item) => {
          const isActiveToday = !item.days || item.days.includes(currentDow);
          if (isActiveToday) {
            return { ...item, alarmEnabled: false };
          }
          return item;
        });
        break;
      }

      case 'ENABLE_ALARMS': {
        newScheduleItems = newScheduleItems.map((item) => ({
          ...item,
          alarmEnabled: true,
        }));
        break;
      }

      case 'SET_WHOLE_SCHEDULE': {
        if (action.wholeScheduleItems && action.wholeScheduleItems.length > 0) {
          newScheduleItems = action.wholeScheduleItems;
        }
        break;
      }

      case 'SWITCH_THEME': {
        if (action.theme) {
          settlementTheme = action.theme;
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    habits: newHabits,
    dailyLogs: newDailyLogs,
    scheduleItems: newScheduleItems,
    theme: settlementTheme,
  };
}
