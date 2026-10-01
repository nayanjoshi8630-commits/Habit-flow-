/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
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

const SYSTEM_PROMPT = `You are HabitFlow's autonomous routine engine.
Analyze the user's directive and context (habits, schedule items, date/time, logs).

CRITICAL INSTRUCTIONS FOR ROUTINE CREATION:
When a user asks to "make a schedule", "create a routine", "plan my day", or similar:
1. ALWAYS generate CREATE_HABIT actions so habits populate on their Today dashboard (e.g. Morning Hydration, Deep Focus, Workout, Mindful Walk, Reading).
2. ALSO generate ADD_SCHEDULE_ITEM actions with specific times (HH:MM 24-hr format) and days array [0,1,2,3,4,5,6] so timeline alerts populate.

Return ONLY a valid JSON object:
{
  "summary": "Short user-friendly summary of actions taken",
  "settledItems": ["Emoji description of each settled item"],
  "actions": [
    {
      "type": "CREATE_HABIT",
      "habitData": {
        "name": "Morning Hydration",
        "category": "Health",
        "emoji": "💧",
        "color": "indigo",
        "frequency": "daily",
        "alarmTime": "07:00",
        "alarmSound": "soft_chime"
      }
    },
    {
      "type": "ADD_SCHEDULE_ITEM",
      "scheduleItemData": {
        "title": "Morning Hydration",
        "time": "07:00",
        "category": "Health",
        "emoji": "💧",
        "alarmEnabled": true,
        "alarmSound": "soft_chime",
        "days": [0,1,2,3,4,5,6]
      }
    }
  ]
}`;

/**
 * Send natural language command to Gemini (prefers server-side proxy route with fallback)
 */
export async function sendCommandToGemini(
  command: string,
  context: CommandContextPayload
): Promise<GeminiCommandResult> {
  const userKey = typeof window !== 'undefined' ? localStorage.getItem('habitflow_user_gemini_key') || '' : '';

  // 1. Try server-side endpoint first (recommended for full-stack apps)
  try {
    const res = await fetch('/api/gemini-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userKey ? { 'x-gemini-key': userKey } : {}),
      },
      body: JSON.stringify({
        command,
        context,
        customApiKey: userKey || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data) {
        let actions = Array.isArray(data.actions) ? data.actions : [];
        if (actions.length === 0 && Array.isArray(data.items)) {
          actions = data.items;
        }
        if (actions.length === 0) {
          const local = executeLocalDeterministicCommand(command, context);
          actions = local.actions;
        }
        return {
          summary: data.summary || 'Settled routine directive successfully ✨',
          settledItems: Array.isArray(data.settledItems) && data.settledItems.length > 0
            ? data.settledItems
            : actions.map((a: any) => `✨ Executed: ${a.type || 'Action'}`),
          actions,
          modelUsed: data.modelUsed || 'Gemini AI',
          originalCommand: command,
          timestamp: new Date().toISOString(),
        };
      }
    }
  } catch (serverErr) {
    console.warn('Server gemini-command unavailable, attempting direct fallback:', serverErr);
  }

  // 2. Direct fallback using @google/genai if user key exists
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  const apiKey = userKey || envKey;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const contextPayload = {
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
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: JSON.stringify(contextPayload),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
        },
      });

      let responseText = (response.text || '').trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText || '{}');
      } catch {
        const start = responseText.indexOf('{');
        const end = responseText.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          parsed = JSON.parse(responseText.substring(start, end + 1));
        }
      }

      let actions = Array.isArray(parsed.actions) ? parsed.actions : [];
      if (actions.length === 0) {
        if (Array.isArray(parsed.habits)) {
          for (const h of parsed.habits) actions.push({ type: 'CREATE_HABIT', habitData: h });
        }
        if (Array.isArray(parsed.scheduleItems)) {
          for (const s of parsed.scheduleItems) actions.push({ type: 'ADD_SCHEDULE_ITEM', scheduleItemData: s });
        }
      }
      if (actions.length === 0) {
        const local = executeLocalDeterministicCommand(command, context);
        actions = local.actions;
      }

      return {
        summary: parsed.summary || 'Settled routine directive successfully ✨',
        settledItems: Array.isArray(parsed.settledItems) && parsed.settledItems.length > 0
          ? parsed.settledItems
          : actions.map((a: any) => `✨ Executed: ${a.type || 'Action'}`),
        actions,
        modelUsed: 'gemini-3.1-flash-lite',
        originalCommand: command,
        timestamp: new Date().toISOString(),
      };
    } catch (clientErr: any) {
      console.warn('Client GenAI direct call failed:', clientErr?.message || clientErr);
    }
  }

  // 3. Fallback deterministic local parser (ensures commands always execute even offline)
  return executeLocalDeterministicCommand(command, context);
}

/**
 * Deterministic local NLP engine that guarantees user commands always execute
 */
function executeLocalDeterministicCommand(command: string, context: CommandContextPayload): GeminiCommandResult {
  const cmd = command.toLowerCase().trim();
  const settledItems: string[] = [];
  const actions: GeminiCommandAction[] = [];
  let summary = 'Settled your request successfully.';

  // Theme switch
  if (
    cmd.includes('light mode') || 
    cmd.includes('light theme') || 
    cmd.includes('white theme') ||
    cmd.includes('creamy') ||
    cmd.includes('cream')
  ) {
    actions.push({ type: 'SWITCH_THEME', theme: 'light' });
    settledItems.push('☀️ Switched interface theme to Light Mode');
    summary = "I've switched your interface theme to creamy Light Mode.";
  } else if (cmd.includes('dark mode') || cmd.includes('dark theme')) {
    actions.push({ type: 'SWITCH_THEME', theme: 'dark' });
    settledItems.push('🌙 Switched interface theme to Dark Mode');
    summary = "I've switched your interface back to Dark Mode.";
  }
  // Schedule / routine generator
  else if (
    cmd.includes('schedule') || 
    cmd.includes('routine') || 
    cmd.includes('plan my day') || 
    cmd.includes('make a schedule') ||
    cmd.includes('productive')
  ) {
    const starterPlan = [
      { title: 'Morning Hydration & Sunlight', time: '07:00', cat: 'Health', emoji: '💧', sound: 'soft_chime' },
      { title: 'Deep Work Focus Block', time: '09:00', cat: 'Work', emoji: '🎯', sound: 'digital_beep' },
      { title: 'Nutritious Lunch & Outdoor Walk', time: '12:30', cat: 'Health', emoji: '🥗', sound: 'soft_chime' },
      { title: 'Afternoon Movement & Exercise', time: '16:30', cat: 'Fitness', emoji: '🏃‍♂️', sound: 'energetic_beep' },
      { title: 'Evening Digital Sunset & Reading', time: '21:30', cat: 'Mind', emoji: '🌙', sound: 'zen_bell' },
    ];

    for (const item of starterPlan) {
      actions.push({
        type: 'CREATE_HABIT',
        habitData: {
          name: item.title,
          category: item.cat,
          emoji: item.emoji,
          color: 'indigo',
          frequency: 'daily',
          frequencyDays: [0, 1, 2, 3, 4, 5, 6],
          alarmTime: item.time,
          alarmSound: item.sound,
        },
      });
      actions.push({
        type: 'ADD_SCHEDULE_ITEM',
        scheduleItemData: {
          title: item.title,
          time: item.time,
          category: item.cat,
          emoji: item.emoji,
          alarmEnabled: true,
          alarmSound: item.sound,
          days: [0, 1, 2, 3, 4, 5, 6],
        },
      });
      settledItems.push(`✨ Added: ${item.emoji} ${item.title} at ${item.time}`);
    }
    summary = `Created a balanced daily routine with ${starterPlan.length} habits and schedule alarms!`;
  }
  // Rest day / off for today
  else if (
    cmd.includes('off') || 
    cmd.includes('rest day') || 
    cmd.includes('skip') || 
    cmd.includes('break today') || 
    cmd.includes('sick')
  ) {
    const matchedHabit = context.habits.find((h) => cmd.includes(h.name.toLowerCase()));
    if (matchedHabit) {
      actions.push({
        type: 'SET_HABITS_OFF_FOR_TODAY',
        habitIds: [matchedHabit.id],
        allHabits: false,
        reason: 'Rest Day',
      });
      settledItems.push(`💤 Paused "${matchedHabit.name}" for today`);
      summary = `Paused "${matchedHabit.name}" for today so you can rest.`;
    } else {
      actions.push({
        type: 'SET_HABITS_OFF_FOR_TODAY',
        allHabits: true,
        reason: 'Rest Day',
      });
      settledItems.push(`💤 Marked all habits as off for today (Rest Day)`);
      summary = `All habits are turned off for today so you can enjoy a rest day.`;
    }
  }
  // Mark complete
  else if (cmd.includes('done') || cmd.includes('finish') || cmd.includes('complete') || cmd.includes('did my')) {
    const matchedHabit = context.habits.find((h) => cmd.includes(h.name.toLowerCase()));
    if (matchedHabit) {
      actions.push({
        type: 'TOGGLE_HABIT_TODAY',
        habitId: matchedHabit.id,
        habitName: matchedHabit.name,
        completed: true,
      });
      settledItems.push(`✅ Marked "${matchedHabit.name}" completed`);
      summary = `Checked off "${matchedHabit.name}" for today!`;
    } else {
      actions.push({
        type: 'TOGGLE_HABIT_TODAY',
        allHabits: true,
        completed: true,
      });
      settledItems.push(`✅ Checked off all active habits for today`);
      summary = `Awesome job! All active habits marked completed for today.`;
    }
  }
  // Add schedule task / habit
  else {
    const timeMatch = cmd.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let targetTime = '16:00';
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      targetTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    }

    let title = command
      .replace(/remind me to|add task|schedule|at \d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '')
      .trim();
    if (!title) title = 'Scheduled Routine';
    title = title.charAt(0).toUpperCase() + title.slice(1);

    actions.push({
      type: 'ADD_SCHEDULE_ITEM',
      scheduleItemData: {
        title,
        time: targetTime,
        category: 'Personal',
        emoji: '📌',
        alarmEnabled: true,
        alarmSound: 'soft_chime',
        days: [context.dayOfWeek],
      },
    });
    actions.push({
      type: 'CREATE_HABIT',
      habitData: {
        name: title,
        category: 'Personal',
        emoji: '📌',
        color: 'indigo',
        frequency: 'daily',
        alarmTime: targetTime,
        alarmSound: 'soft_chime',
      },
    });
    settledItems.push(`⏰ Added: ${title} at ${targetTime}`);
    summary = `Settled "${title}" into your schedule and habits for ${targetTime}.`;
  }

  return {
    summary,
    settledItems,
    actions,
    modelUsed: 'Local Command Engine',
    originalCommand: command,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Settle actions returned by Gemini autonomously onto the application state.
 * Built with full resilience to support both nested and flat action payloads.
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

  for (const rawAction of actions || []) {
    const action = rawAction as any;
    let actionType = String(action.type || action.action || '').toUpperCase();

    // Map common synonyms to canonical action types
    if (
      actionType.includes('REST') ||
      actionType.includes('PAUSE') ||
      actionType.includes('OFF') ||
      actionType.includes('SKIP') ||
      actionType.includes('SICK')
    ) {
      actionType = 'SET_HABITS_OFF_FOR_TODAY';
    } else if (actionType.includes('RESUME') || actionType.includes('UNPAUSE')) {
      actionType = 'RESUME_HABITS_FOR_TODAY';
    } else if (
      actionType.includes('DONE') ||
      actionType.includes('COMPLETE') ||
      actionType.includes('CHECK') ||
      actionType.includes('FINISH')
    ) {
      actionType = 'TOGGLE_HABIT_TODAY';
    } else if (actionType.includes('THEME') || actionType.includes('MODE')) {
      actionType = 'SWITCH_THEME';
    } else if (actionType.includes('SCHEDULE') || actionType.includes('ALARM')) {
      if (actionType.includes('DELETE') || actionType.includes('REMOVE')) actionType = 'DELETE_SCHEDULE_ITEM';
      else if (actionType.includes('UPDATE') || actionType.includes('EDIT') || actionType.includes('MOVE')) actionType = 'UPDATE_SCHEDULE_ITEM';
      else if (actionType.includes('DISABLE') || actionType.includes('MUTE') || actionType.includes('SILENCE')) actionType = 'DISABLE_ALARMS_FOR_TODAY';
      else actionType = 'ADD_SCHEDULE_ITEM';
    } else if (actionType.includes('HABIT') || actionType.includes('ROUTINE') || actionType.includes('TASK')) {
      if (actionType.includes('DELETE') || actionType.includes('REMOVE')) actionType = 'DELETE_HABIT';
      else actionType = 'CREATE_HABIT';
    }

    switch (actionType) {
      case 'SET_HABITS_OFF_FOR_TODAY':
      case 'REST_DAY':
      case 'SKIP_TODAY': {
        const reason = action.reason || 'Rest Day';
        const isAll = action.allHabits === true || (!action.habitIds?.length && !action.habitName);
        const targetHabitIds: string[] = isAll
          ? newHabits.filter((h) => !h.isArchived).map((h) => h.id)
          : action.habitIds || [];

        if (!isAll && action.habitName) {
          const match = newHabits.find((h) => h.name.toLowerCase().includes(action.habitName.toLowerCase()));
          if (match && !targetHabitIds.includes(match.id)) {
            targetHabitIds.push(match.id);
          }
        }

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
        const isAll = action.allHabits === true || (!action.habitIds?.length && !action.habitName);
        const targetHabitIds: string[] = isAll
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

      case 'TOGGLE_HABIT_TODAY':
      case 'COMPLETE_HABIT': {
        if (action.allHabits) {
          for (const h of newHabits.filter((x) => !x.isArchived)) {
            const logId = `${h.id}_${todayDate}`;
            const existing = newDailyLogs[logId] || {
              id: logId,
              habitId: h.id,
              date: todayDate,
              completed: false,
              completedSubtasks: [],
            };
            newDailyLogs[logId] = {
              ...existing,
              completed: action.completed ?? true,
              isOffForToday: false,
              completedSubtasks: (action.completed ?? true) && h.subtasks ? h.subtasks.map((s) => s.id) : [],
            };
          }
        } else {
          let targetId = action.habitId;
          const searchName = action.habitName || action.name || action.title;
          if (!targetId && searchName) {
            const match = newHabits.find(
              (h) => h.name.toLowerCase() === searchName.toLowerCase() || h.name.toLowerCase().includes(searchName.toLowerCase())
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
        }
        break;
      }

      case 'CREATE_HABIT':
      case 'ADD_HABIT': {
        // Extract from nested habitData OR flat properties
        const hd = action.habitData || action.habit || action.data || action.item || action;
        const habitName = hd.name || hd.title || action.name || action.title;

        if (habitName) {
          const alarmTime = hd.alarmTime || action.alarmTime || hd.time || action.time;
          const alarmSound = hd.alarmSound || action.alarmSound || 'soft_chime';
          const emoji = hd.emoji || action.emoji || '✨';
          const category = hd.category || action.category || 'General';

          const newHabit: Habit = {
            id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: habitName,
            type: 'simple',
            isTask: Boolean(hd.isTask ?? action.isTask),
            emoji,
            color: hd.color || action.color || 'indigo',
            category,
            frequency: hd.frequency || action.frequency || 'daily',
            frequencyDays: hd.frequencyDays || action.frequencyDays || [0, 1, 2, 3, 4, 5, 6],
            dueDate: hd.dueDate || action.dueDate || todayDate,
            alarmTime,
            alarmEnabled: Boolean(alarmTime),
            alarmSound,
            order: newHabits.length,
            subtasks: [],
            createdAt: new Date().toISOString(),
            isArchived: false,
          };
          newHabits.push(newHabit);

          // If a specific time was supplied, also add a schedule milestone for it
          if (alarmTime && !newScheduleItems.some((s) => s.title.toLowerCase() === habitName.toLowerCase())) {
            newScheduleItems.push({
              id: `sch_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: habitName,
              time: alarmTime,
              category,
              emoji,
              alarmEnabled: true,
              alarmSound,
              days: [0, 1, 2, 3, 4, 5, 6],
              habitId: newHabit.id,
            });
          }
        }
        break;
      }

      case 'DELETE_HABIT': {
        const idsToDelete = action.habitIds || (action.habitId ? [action.habitId] : []);
        if (idsToDelete.length) {
          newHabits = newHabits.filter((h) => !idsToDelete.includes(h.id));
        }
        break;
      }

      case 'ADD_SCHEDULE_ITEM':
      case 'SCHEDULE_TASK': {
        // Extract from nested scheduleItemData OR flat properties
        const sd = action.scheduleItemData || action.scheduleItem || action.schedule || action.data || action.item || action;
        const title = sd.title || sd.name || action.title || action.name;
        const time = sd.time || action.time || '08:00';

        if (title) {
          const category = sd.category || action.category || 'Routine';
          const emoji = sd.emoji || action.emoji || '📌';
          const alarmSound = sd.alarmSound || action.alarmSound || 'soft_chime';
          const days = sd.days || action.days || [0, 1, 2, 3, 4, 5, 6];

          const newItem: ScheduleItem = {
            id: `sch_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title,
            time,
            category,
            emoji,
            alarmEnabled: sd.alarmEnabled ?? action.alarmEnabled ?? true,
            alarmSound,
            days: days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6],
          };
          newScheduleItems.push(newItem);

          // Also ensure habit exists so it checks off on Today view
          if (!newHabits.some((h) => h.name.toLowerCase() === title.toLowerCase())) {
            newHabits.push({
              id: `h_sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: title,
              type: 'simple',
              isTask: false,
              emoji,
              color: 'indigo',
              category,
              frequency: 'daily',
              frequencyDays: days,
              alarmTime: time,
              alarmEnabled: true,
              alarmSound,
              order: newHabits.length,
              subtasks: [],
              createdAt: new Date().toISOString(),
              isArchived: false,
            });
          }
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
        const items = action.wholeScheduleItems || action.items || action.scheduleItems;
        if (Array.isArray(items) && items.length > 0) {
          newScheduleItems = items;
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

  // Sort schedule items by time (00:00 to 23:59)
  newScheduleItems.sort((a, b) => a.time.localeCompare(b.time));

  return {
    habits: newHabits,
    dailyLogs: newDailyLogs,
    scheduleItems: newScheduleItems,
    theme: settlementTheme,
  };
}
