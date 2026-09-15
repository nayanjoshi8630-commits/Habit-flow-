import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Preferred models in priority order
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

/**
 * Helper to call Gemini models with fallback across available models
 */
async function callGeminiWithFallback(fn: (client: GoogleGenAI, model: string) => Promise<any>) {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }

  let lastError: any = null;
  for (const model of GEMINI_MODELS) {
    try {
      const result = await fn(client, model);
      return { result, model };
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini model ${model} failed:`, err?.message || err);
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Gemini AI-powered schedule extraction & grasping endpoint
  app.post('/api/parse-schedule', async (req, res) => {
    try {
      const { text, availableCategories } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Text content is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          items: null,
          useLocal: true,
          reason: 'GEMINI_API_KEY not configured',
        });
      }

      const prompt = `You are a schedule comprehension engine for a daily routine and habit tracking app.
Extract all scheduled routines, habits, tasks, or events from the following text (which may be a notes list, timetable, paragraph, or chat message).

Guidelines:
1. "time": Standard 24-hour "HH:MM" format (e.g. "06:30", "09:00", "13:30", "22:00"). If a time range is given (e.g. 9am to 10am), use the start time.
2. Contextual AM/PM: If AM/PM is ambiguous, infer realistically based on typical human circadian rhythm (e.g. breakfast/wake up is AM, dinner/sleep is PM).
3. "title": Clean, concise activity title (strip list numbers, bullets, checkboxes, or time tags).
4. "category": Select the best fitting category from ${JSON.stringify(availableCategories || ['Health', 'Mind', 'Work', 'Personal', 'Fitness', 'Finance'])}.
5. "emoji": A single evocative emoji matching the task.
6. "alarmSound": Choose the most appropriate from ["music_box", "digital_beep", "scifi_siren", "classic_ring", "soft_chime", "zen_bell", "morning_breeze", "digital_pulse", "energetic_beep"].
7. "days": Array of integers 0-6 (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday). Default to [0,1,2,3,4,5,6] for daily routines, or [1,2,3,4,5] for weekdays.

Text to analyze:
"""
${text.slice(0, 15000)}
"""`;

      const { result, model } = await callGeminiWithFallback(async (client, modelName) => {
        return client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      time: { type: Type.STRING, description: '24-hour time HH:MM format' },
                      category: { type: Type.STRING },
                      emoji: { type: Type.STRING },
                      alarmSound: { type: Type.STRING },
                      days: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER },
                      },
                    },
                    required: ['title', 'time'],
                  },
                },
              },
              required: ['items'],
            },
          },
        });
      });

      const responseText = result.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      return res.json({
        items: Array.isArray(parsed.items) ? parsed.items : [],
        detectedFormat: `Gemini AI (${model}) ✨`,
        useLocal: false,
      });
    } catch (err: any) {
      console.warn('Gemini schedule parsing error (falling back to local):', err?.message || err);
      return res.json({
        items: null,
        useLocal: true,
        error: err?.message || 'AI parsing unavailable',
      });
    }
  });

  // 2. Gemini AI Routine Generator endpoint
  app.post('/api/generate-routine', async (req, res) => {
    try {
      const { goal, availableCategories, wakeTime, sleepTime } = req.body;
      if (!goal || typeof goal !== 'string') {
        return res.status(400).json({ error: 'Goal or prompt is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Gemini API key is not configured' });
      }

      const prompt = `You are a world-class productivity and wellness habit designer.
Design an optimal daily schedule based on this user goal:
"${goal.slice(0, 500)}"

Parameters:
- Typical Wake Time: ${wakeTime || '06:30'}
- Typical Bedtime: ${sleepTime || '22:30'}
- Available Categories: ${JSON.stringify(availableCategories || ['Health', 'Mind', 'Work', 'Personal', 'Fitness', 'Finance'])}

Requirements:
1. Return 5 to 9 well-paced, realistic daily milestones and habits spanning morning, afternoon, and evening.
2. Include hydration, deep work or focus blocks, movement/exercise, mindful pauses, and wind-down time.
3. Keep titles action-oriented and crisp (e.g. "Morning Sunlight Walk & Hydration", "Deep Focus Block 1", "Nutrient-Dense Lunch").
4. "time": Standard 24-hour "HH:MM".
5. "alarmSound": Choose from ["music_box", "digital_beep", "scifi_siren", "classic_ring", "soft_chime", "zen_bell", "morning_breeze", "digital_pulse", "energetic_beep"].
6. Provide a concise 1-2 sentence coach summary explaining why this routine works.`;

      const { result, model } = await callGeminiWithFallback(async (client, modelName) => {
        return client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING, description: 'Coach explanation of the routine' },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      time: { type: Type.STRING, description: '24-hour time HH:MM format' },
                      category: { type: Type.STRING },
                      emoji: { type: Type.STRING },
                      alarmSound: { type: Type.STRING },
                      days: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER },
                      },
                    },
                    required: ['title', 'time'],
                  },
                },
              },
              required: ['items', 'summary'],
            },
          },
        });
      });

      const responseText = result.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      return res.json({
        summary: parsed.summary || 'Custom routine crafted by Gemini AI',
        items: Array.isArray(parsed.items) ? parsed.items : [],
        modelUsed: model,
      });
    } catch (err: any) {
      console.error('Gemini routine generation failed:', err);
      return res.status(500).json({ error: err?.message || 'Failed to generate routine with Gemini' });
    }
  });

  // 3. Gemini AI Schedule Optimizer / Coach endpoint
  app.post('/api/coach-schedule', async (req, res) => {
    try {
      const { scheduleItems, habits } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Gemini API key is not configured' });
      }

      const prompt = `You are an encouraging, expert behavioral scientist and routine coach.
Review the user's current daily schedule items and habits:
Schedule: ${JSON.stringify((scheduleItems || []).map((i: any) => ({ time: i.time, title: i.title, category: i.category })))}
Habits: ${JSON.stringify((habits || []).map((h: any) => ({ name: h.name, streak: h.streak, targetDays: h.targetDays })))}

Provide:
1. "score": Overall routine balance score from 1 to 100.
2. "strength": What they are doing really well (1 sentence).
3. "suggestion": One high-leverage improvement or rhythm adjustment (1 sentence).
4. "microHabit": One tiny recommended micro-habit to add for greater vitality.`;

      const { result } = await callGeminiWithFallback(async (client, modelName) => {
        return client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                strength: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                microHabit: { type: Type.STRING },
              },
              required: ['score', 'strength', 'suggestion', 'microHabit'],
            },
          },
        });
      });

      const parsed = JSON.parse(result.text?.trim() || '{}');
      return res.json(parsed);
    } catch (err: any) {
      console.error('Gemini schedule coach failed:', err);
      return res.status(500).json({ error: err?.message || 'Failed to get coach advice' });
    }
  });

  // 3b. Gemini AI Stats & Performance Behavioral Diagnosis endpoint
  app.post('/api/gemini-stats-analysis', async (req, res) => {
    try {
      const { habitsSummary, totalCompletions, weeklyRate, bestStreak, currentStreak } = req.body;

      const fallbackDiagnosis = () => {
        const rate = typeof weeklyRate === 'number' ? weeklyRate : 50;
        let headline = 'Consistent Foundations';
        let assessment = 'You are steadily recording daily routines and building momentum.';
        let recommendation = 'Focus on protecting your primary morning anchor habit to build streak inertia.';
        if (rate >= 80) {
          headline = 'Unstoppable Momentum';
          assessment = 'Outstanding weekly consistency! Your habits are turning into natural unconscious routines.';
          recommendation = 'Challenge yourself by adding a micro-milestone or 30-day challenge.';
        } else if (rate < 40) {
          headline = 'Rebuilding Daily Rhythm';
          assessment = 'You are currently in an adaptation phase. Small consistent actions beat heroic sporadic bursts.';
          recommendation = 'Pick your single easiest habit and mark it done right after waking up tomorrow.';
        }
        return {
          headline,
          assessment,
          recommendation,
          momentumScore: Math.min(100, Math.max(20, Math.round(rate * 0.7 + (currentStreak || 0) * 3))),
          modelUsed: 'Local Behavioral Analyzer',
        };
      };

      if (!process.env.GEMINI_API_KEY) {
        return res.json(fallbackDiagnosis());
      }

      const prompt = `You are an elite behavioral psychologist and habit performance coach.
Analyze the user's habit metrics:
- Total All-Time Completions: ${totalCompletions || 0}
- Weekly Completion Rate: ${weeklyRate || 0}%
- Longest Streak: ${bestStreak || 0} days
- Current Active Streak: ${currentStreak || 0} days
- Habits Breakdown: ${JSON.stringify(habitsSummary || [])}

Provide an inspiring, psychologically sharp diagnosis:
1. "headline": Short impactful phrase (3-6 words, e.g. "Ironclad Morning Momentum").
2. "assessment": 2 concise sentences analyzing their momentum and discipline honestly and warmly.
3. "recommendation": 1 crisp, actionable micro-adjustment to supercharge their consistency.
4. "momentumScore": Integer 1-100 indicating behavioral momentum.`;

      const { result, model } = await callGeminiWithFallback(async (client, modelName) => {
        return client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                assessment: { type: Type.STRING },
                recommendation: { type: Type.STRING },
                momentumScore: { type: Type.INTEGER },
              },
              required: ['headline', 'assessment', 'recommendation', 'momentumScore'],
            },
          },
        });
      });

      const parsed = JSON.parse(result.text?.trim() || '{}');
      return res.json({
        ...parsed,
        modelUsed: `Gemini AI (${model}) ✨`,
      });
    } catch (err: any) {
      console.warn('Gemini stats analysis failed, using fallback:', err?.message || err);
      return res.json({
        headline: 'Steady Habit Progress',
        assessment: 'You are showing regular commitment to your routines. Daily small wins compound exponentially over time.',
        recommendation: 'Anchor your hardest habit to an existing automatic cue like morning coffee.',
        momentumScore: 75,
        modelUsed: 'Local Behavioral Engine',
      });
    }
  });

  // 4. Gemini AI Autonomous Command Center: Natural language task, routine, and habit settlement
  app.post('/api/gemini-command', async (req, res) => {
    try {
      const { command, context } = req.body;
      if (!command || typeof command !== 'string' || !command.trim()) {
        return res.status(400).json({ error: 'Command text is required' });
      }

      const todayDate = context?.todayDate || new Date().toISOString().split('T')[0];
      const currentTime = context?.currentTime || '12:00';
      const dayOfWeek = typeof context?.dayOfWeek === 'number' ? context.dayOfWeek : new Date().getDay();
      const habits = Array.isArray(context?.habits) ? context.habits : [];
      const scheduleItems = Array.isArray(context?.scheduleItems) ? context.scheduleItems : [];
      const todayLogs = context?.todayLogs || {};
      const availableCategories = Array.isArray(context?.availableCategories)
        ? context.availableCategories
        : ['Health', 'Mind', 'Work', 'Personal', 'Fitness', 'Finance'];

      // Local fallback parser in case API key is missing
      const handleLocalFallback = () => {
        const cmd = command.toLowerCase().trim();
        const settledItems: string[] = [];
        const actions: any[] = [];
        let summary = 'Settled your request using local comprehension engine.';

        // Theme switch
        if (
          cmd.includes('light mode') || 
          cmd.includes('light theme') || 
          cmd.includes('switch to light') || 
          cmd.includes('white theme') ||
          cmd.includes('creamy') ||
          cmd.includes('cream')
        ) {
          actions.push({
            type: 'SWITCH_THEME',
            theme: 'light',
          });
          settledItems.push('☀️ Switched interface theme to Creamy White Light Mode');
          summary = "I've switched your interface to warm, creamy white Light Mode.";
          return {
            summary,
            settledItems,
            actions,
            modelUsed: 'Local Command Engine',
            originalCommand: command,
            timestamp: new Date().toISOString(),
          };
        } else if (cmd.includes('dark mode') || cmd.includes('dark theme') || cmd.includes('switch to dark')) {
          actions.push({
            type: 'SWITCH_THEME',
            theme: 'dark',
          });
          settledItems.push('🌙 Switched interface theme to Dark Mode (Default)');
          summary = "I've switched your interface back to Dark Mode.";
          return {
            summary,
            settledItems,
            actions,
            modelUsed: 'Local Command Engine',
            originalCommand: command,
            timestamp: new Date().toISOString(),
          };
        }

        // 1. Off for today / Rest day
        if (
          cmd.includes('off') ||
          cmd.includes('rest day') ||
          cmd.includes('skip') ||
          cmd.includes('break today') ||
          cmd.includes('sick today') ||
          cmd.includes('pause')
        ) {
          // Check if specific habit
          const matchedHabit = habits.find((h: any) => cmd.includes(h.name.toLowerCase()));
          if (matchedHabit) {
            actions.push({
              type: 'SET_HABITS_OFF_FOR_TODAY',
              habitIds: [matchedHabit.id],
              allHabits: false,
              reason: 'Rest / Paused for today',
            });
            settledItems.push(`💤 Paused "${matchedHabit.name}" for today`);
            summary = `I've paused "${matchedHabit.name}" for today so you can rest.`;
          } else {
            actions.push({
              type: 'SET_HABITS_OFF_FOR_TODAY',
              allHabits: true,
              reason: 'Rest Day',
            });
            settledItems.push(`💤 Marked all today's habits as off (Rest Day)`);
            summary = `I've turned off all your habits for today so you can take a well-deserved rest day.`;
          }

          if (cmd.includes('alarm') || cmd.includes('silence')) {
            actions.push({ type: 'DISABLE_ALARMS_FOR_TODAY' });
            settledItems.push(`🔕 Silenced today's alarms`);
          }
        }
        // 2. Mark complete
        else if (cmd.includes('done') || cmd.includes('finish') || cmd.includes('complete') || cmd.includes('did my')) {
          const matchedHabit = habits.find((h: any) => cmd.includes(h.name.toLowerCase()));
          if (matchedHabit) {
            actions.push({
              type: 'TOGGLE_HABIT_TODAY',
              habitId: matchedHabit.id,
              habitName: matchedHabit.name,
              completed: true,
            });
            settledItems.push(`✅ Marked "${matchedHabit.name}" as completed for today`);
            summary = `Nice work! I've checked off "${matchedHabit.name}" for today.`;
          } else {
            settledItems.push(`✅ Checked off all active habits for today`);
            for (const h of habits) {
              actions.push({
                type: 'TOGGLE_HABIT_TODAY',
                habitId: h.id,
                habitName: h.name,
                completed: true,
              });
            }
            summary = `Awesome job! I've marked your active habits as completed for today.`;
          }
        }
        // 3. Add schedule task / reminder
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
              days: [dayOfWeek],
            },
          });
          settledItems.push(`⏰ Added: ${title} at ${targetTime} with soft chime alarm`);
          summary = `I've settled "${title}" into your schedule for ${targetTime} today with an active chime alarm.`;
        }

        return {
          summary,
          settledItems,
          actions,
          modelUsed: 'Local Fallback Engine',
          originalCommand: command,
          timestamp: new Date().toISOString(),
        };
      };

      if (!process.env.GEMINI_API_KEY) {
        return res.json(handleLocalFallback());
      }

      const prompt = `You are Gemini, the executive AI assistant and intelligent scheduler for HabitFlow.
The user speaks or types a natural language command to adjust their day, habits, tasks, routines, or alarms.
Your role: Comprehend user intent deeply, determine what needs to change, and SETTLE EVERYTHING ON YOUR OWN.

Context:
- Today's Date: ${todayDate}
- Current Local Time: ${currentTime}
- Day of Week: ${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
- Current Habits: ${JSON.stringify(habits.map((h: any) => ({ id: h.id, name: h.name, category: h.category, isTask: h.isTask, alarmTime: h.alarmTime })))}
- Today's Logs: ${JSON.stringify(todayLogs)}
- Schedule Items / Routines / Alarms: ${JSON.stringify(scheduleItems.map((s: any) => ({ id: s.id, title: s.title, time: s.time, alarmEnabled: s.alarmEnabled, days: s.days })))}
- Available Categories: ${JSON.stringify(availableCategories)}

User Command:
"${command.trim()}"

Intents & Actions Rules:
1. Off for today / Rest Day / Sick Day / Skip:
   - e.g. "habits can be off for today", "take a rest day", "turn off habits today", "skip gym habit today", "I am sick today, no habits".
   - Generate action "SET_HABITS_OFF_FOR_TODAY" with allHabits: true (or habitIds array if specific habit like gym was mentioned), reason: e.g. "Rest Day" or "Sick".
   - If user asks to silence or turn off alarms/routines as well, also generate "DISABLE_ALARMS_FOR_TODAY".
2. Resume / Turn habits back on:
   - e.g. "turn habits back on", "resume gym habit", "undo rest day".
   - Generate action "RESUME_HABITS_FOR_TODAY".
3. Mark completed or uncompleted:
   - e.g. "I finished my morning meditation", "mark water done", "did my workout".
   - Match existing habit by name, generate "TOGGLE_HABIT_TODAY" with habitId, habitName, completed: true.
4. Add new schedule routine / task / alarm:
   - e.g. "remind me to call client at 4pm today", "add meditation at 9:30pm", "schedule doctor appointment at 2pm".
   - Calculate 24-hour time HH:MM format.
   - Generate "ADD_SCHEDULE_ITEM" with scheduleItemData: { title, time, category, emoji, alarmEnabled: true, alarmSound: "soft_chime", days: [${dayOfWeek}] or [0,1,2,3,4,5,6] }.
   - If user explicitly says "create new habit" or "add habit Drink 3L Water every day", generate "CREATE_HABIT" with habitData.
5. Update or move:
   - e.g. "move standup to 11am", "turn off 7:30 alarm".
   - Generate "UPDATE_SCHEDULE_ITEM" with scheduleTitleMatch or scheduleItemId and updatedFields.
6. Delete or cancel:
   - e.g. "cancel 4pm meeting", "remove gym habit".
   - Generate "DELETE_SCHEDULE_ITEM" or "DELETE_HABIT".
7. Plan or set multiple routines:
   - e.g. "plan my afternoon: 1pm lunch, 2pm coding, 5pm gym".
   - Generate multiple "ADD_SCHEDULE_ITEM"s or "SET_WHOLE_SCHEDULE".
8. Interface / Theme:
   - e.g. "switch to light mode", "turn on light theme", "switch to dark mode", "dark theme".
   - Generate "SWITCH_THEME" with theme: "light" or "dark".

Return JSON with:
- "summary": A friendly, reassuring 1-2 sentence confirmation of what you have settled on their behalf.
- "settledItems": Array of concise human-readable bullet points (with emojis) detailing each change made.
- "actions": Array of action objects.`;

      const { result, model } = await callGeminiWithFallback(async (client, modelName) => {
        return client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                settledItems: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: {
                        type: Type.STRING,
                        description: 'Action type enum',
                      },
                      theme: { type: Type.STRING, description: 'light or dark' },
                      allHabits: { type: Type.BOOLEAN },
                      habitIds: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      habitName: { type: Type.STRING },
                      reason: { type: Type.STRING },
                      completed: { type: Type.BOOLEAN },
                      value: { type: Type.NUMBER },
                      habitData: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          isTask: { type: Type.BOOLEAN },
                          category: { type: Type.STRING },
                          emoji: { type: Type.STRING },
                          color: { type: Type.STRING },
                          frequency: { type: Type.STRING },
                          alarmTime: { type: Type.STRING },
                          alarmSound: { type: Type.STRING },
                        },
                      },
                      scheduleItemData: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          time: { type: Type.STRING },
                          category: { type: Type.STRING },
                          emoji: { type: Type.STRING },
                          alarmEnabled: { type: Type.BOOLEAN },
                          alarmSound: { type: Type.STRING },
                          days: {
                            type: Type.ARRAY,
                            items: { type: Type.INTEGER },
                          },
                        },
                      },
                      scheduleItemId: { type: Type.STRING },
                      scheduleTitleMatch: { type: Type.STRING },
                      updatedFields: {
                        type: Type.OBJECT,
                        properties: {
                          time: { type: Type.STRING },
                          title: { type: Type.STRING },
                          alarmEnabled: { type: Type.BOOLEAN },
                          alarmSound: { type: Type.STRING },
                        },
                      },
                    },
                    required: ['type'],
                  },
                },
              },
              required: ['summary', 'settledItems', 'actions'],
            },
          },
        });
      });

      const parsed = JSON.parse(result.text?.trim() || '{}');
      return res.json({
        summary: parsed.summary || 'Settled your request successfully with Gemini AI ✨',
        settledItems: Array.isArray(parsed.settledItems) ? parsed.settledItems : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        modelUsed: model,
        originalCommand: command,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Gemini command endpoint error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to process command with Gemini' });
    }
  });

  // Vite middleware for development vs static for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
