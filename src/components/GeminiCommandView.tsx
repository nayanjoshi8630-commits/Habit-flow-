/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  RotateCcw,
  CheckCircle2,
  Clock,
  Zap,
  Moon,
  Sun,
  BellOff,
  Bell,
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  ArrowRight,
  ShieldCheck,
  Coffee,
  Compass,
  ListTodo,
  HelpCircle,
  Wand2,
  Sliders,
  History,
  Activity
} from 'lucide-react';
import { Habit, DailyLog, ScheduleItem, DayChallenge } from '../types';
import {
  sendCommandToGemini,
  applyGeminiActions,
  SettlementChanges,
} from '../utils/geminiCommand';
import CalendarView from './CalendarView';
import ChallengesView from './ChallengesView';

interface GeminiCommandViewProps {
  habits: Habit[];
  dailyLogs: Record<string, DailyLog>;
  scheduleItems: ScheduleItem[];
  challenges: DayChallenge[];
  userName: string;
  activeDate: string;
  onUpdateFullState: (changes: SettlementChanges) => void;
  onUpdateChallenge: (challenge: DayChallenge) => void;
  onSelectDate: (date: string) => void;
  weekStartMonday: boolean;
  categoriesList: string[];
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  summary: string;
  settledItems: string[];
  timestamp: string;
  modelUsed?: string;
  previousStateSnapshot?: {
    habits: Habit[];
    dailyLogs: Record<string, DailyLog>;
    scheduleItems: ScheduleItem[];
  };
}

const DIRECTIVE_CATEGORIES = [
  {
    category: 'Rest & Off Days',
    icon: '💤',
    items: [
      {
        label: 'Take Rest Day (Off Today)',
        command: 'Take a rest day today, habits can be off for today',
        theme: 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10',
      },
      {
        label: 'Skip Workout Today',
        command: 'Skip my workout habit for today',
        theme: 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10',
      },
      {
        label: 'Silence Alarms Today',
        command: 'Turn off schedule alarms for today',
        theme: 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10',
      },
    ],
  },
  {
    category: 'Routine Execution',
    icon: '⚡',
    items: [
      {
        label: 'Morning Habits Done',
        command: 'I completed my morning routine, mark today done',
        theme: 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10',
      },
      {
        label: 'Mark Hydration Done',
        command: 'Mark drink water habit done for today',
        theme: 'border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10',
      },
      {
        label: 'Resume Habits Today',
        command: 'Turn habits back on for today, resume active routine',
        theme: 'border-sky-500/30 text-sky-300 hover:bg-sky-500/10',
      },
    ],
  },
  {
    category: 'Schedule & Alarms',
    icon: '⏰',
    items: [
      {
        label: 'Deep Focus at 2:00 PM',
        command: 'Add deep work session at 2:00 PM today with soft chime alarm',
        theme: 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10',
      },
      {
        label: 'Water Reminder at 3:30 PM',
        command: 'Remind me to drink water at 3:30 PM today with alarm',
        theme: 'border-teal-500/30 text-teal-300 hover:bg-teal-500/10',
      },
      {
        label: 'Evening Walk at 6:00 PM',
        command: 'Add evening sunset walk at 6:00 PM today',
        theme: 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10',
      },
    ],
  },
  {
    category: 'Display & Environment',
    icon: '🎨',
    items: [
      {
        label: 'Switch to Light Mode',
        command: 'Switch interface to light mode',
        theme: 'border-amber-400/40 text-amber-200 hover:bg-amber-400/10',
      },
      {
        label: 'Switch to Dark Mode',
        command: 'Switch interface to dark mode',
        theme: 'border-indigo-400/40 text-indigo-300 hover:bg-indigo-400/10',
      },
    ],
  },
];

export default function GeminiCommandView({
  habits,
  dailyLogs,
  scheduleItems,
  challenges,
  userName,
  activeDate,
  onUpdateFullState,
  onUpdateChallenge,
  onSelectDate,
  weekStartMonday,
  categoriesList,
}: GeminiCommandViewProps) {
  // Definitive Section Tabs: 'command' | 'settled' | 'architect' | 'calendar'
  const [activeSubSection, setActiveSubSection] = useState<'command' | 'settled' | 'architect' | 'calendar'>('command');

  const [inputCommand, setInputCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Command execution history
  const [history, setHistory] = useState<CommandHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('habitflow_gemini_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastSettledResult, setLastSettledResult] = useState<CommandHistoryEntry | null>(() => {
    try {
      const saved = localStorage.getItem('habitflow_gemini_last_result');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Voice recording state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Calendar / Arena sub-tab
  const [calendarSubTab, setCalendarSubTab] = useState<'log' | 'challenges'>('log');

  // AI Architect State
  const [architectGoal, setArchitectGoal] = useState('');
  const [architectLoading, setArchitectLoading] = useState(false);
  const [architectResult, setArchitectResult] = useState<{ summary: string; items: any[] } | null>(null);

  // AI Schedule Coach State
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState<{
    score: number;
    strength: string;
    suggestion: string;
    microHabit: string;
  } | null>(null);

  const todayObj = new Date(activeDate + 'T00:00:00');
  const dayOfWeekIndex = todayObj.getDay();

  // Initialize Web Speech API for voice commanding
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setErrorMessage(null);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
        setIsListening(false);
      }
    }
  };

  // Core execution: Gemini settles everything on its own
  const handleExecuteCommand = async (commandToRun?: string) => {
    const text = (commandToRun || inputCommand).trim();
    if (!text || isProcessing) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const previousSnapshot = {
      habits: [...habits],
      dailyLogs: { ...dailyLogs },
      scheduleItems: [...scheduleItems],
    };

    try {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');

      const result = await sendCommandToGemini(text, {
        todayDate: activeDate,
        currentTime: `${hh}:${mm}`,
        dayOfWeek: dayOfWeekIndex,
        habits,
        scheduleItems,
        todayLogs: Object.fromEntries(
          Object.entries(dailyLogs)
            .filter(([_, log]) => log.date === activeDate)
            .map(([k, v]) => [k, { completed: v.completed, isOffForToday: v.isOffForToday }])
        ),
        availableCategories: categoriesList,
      });

      const settledChanges = applyGeminiActions(
        result.actions,
        { habits, dailyLogs, scheduleItems },
        activeDate,
        dayOfWeekIndex
      );

      onUpdateFullState(settledChanges);

      const historyEntry: CommandHistoryEntry = {
        id: `cmd_${Date.now()}`,
        command: text,
        summary: result.summary,
        settledItems: result.settledItems.length > 0 ? result.settledItems : ['Settled routine for today'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: result.modelUsed,
        previousStateSnapshot: previousSnapshot,
      };

      setLastSettledResult(historyEntry);
      const updatedHistory = [historyEntry, ...history.slice(0, 9)];
      setHistory(updatedHistory);

      localStorage.setItem('habitflow_gemini_last_result', JSON.stringify(historyEntry));
      localStorage.setItem('habitflow_gemini_history', JSON.stringify(updatedHistory));

      setInputCommand('');
    } catch (err: any) {
      console.error('Gemini command error:', err);
      setErrorMessage(err?.message || 'Gemini could not settle command. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (!lastSettledResult?.previousStateSnapshot) return;

    onUpdateFullState(lastSettledResult.previousStateSnapshot);
    setLastSettledResult(null);
    localStorage.removeItem('habitflow_gemini_last_result');
  };

  // Generate Routine with AI
  const handleGenerateRoutine = async (goalPrompt: string) => {
    if (!goalPrompt.trim() || architectLoading) return;
    setArchitectLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/generate-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalPrompt,
          availableCategories: categoriesList,
          wakeTime: '07:00',
          sleepTime: '23:00',
        }),
      });
      const data = await res.json();
      if (data.items) {
        setArchitectResult(data);
      } else {
        throw new Error(data.error || 'Failed to generate routine');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not generate routine');
    } finally {
      setArchitectLoading(false);
    }
  };

  // Apply Generated Routine to State
  const handleApplyArchitectRoutine = () => {
    if (!architectResult?.items) return;
    const newItems: ScheduleItem[] = architectResult.items.map((item, idx) => ({
      id: `sch_ai_${Date.now()}_${idx}`,
      title: item.title,
      time: item.time,
      category: item.category || 'Personal',
      emoji: item.emoji || '📌',
      alarmEnabled: true,
      alarmSound: item.alarmSound || 'soft_chime',
      days: item.days || [0, 1, 2, 3, 4, 5, 6],
    }));

    onUpdateFullState({
      habits,
      dailyLogs,
      scheduleItems: [...scheduleItems, ...newItems],
    });

    setArchitectResult(null);
    setActiveSubSection('settled');
  };

  // Fetch AI Coaching Advice
  const handleGetCoachAdvice = async () => {
    if (coachLoading) return;
    setCoachLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/coach-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleItems,
          habits,
        }),
      });
      const data = await res.json();
      if (data.score !== undefined) {
        setCoachAdvice(data);
      } else {
        throw new Error(data.error || 'Coaching unavailable');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to get coaching advice');
    } finally {
      setCoachLoading(false);
    }
  };

  // Extract today's habits status
  const todayHabits = habits.filter((h) => {
    if (h.isArchived) return false;
    if (h.isTask) return h.dueDate === activeDate;
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'specific') return h.frequencyDays?.includes(dayOfWeekIndex) ?? false;
    return true;
  });

  const habitsOffCount = todayHabits.filter((h) => {
    const log = dailyLogs[`${h.id}_${activeDate}`];
    return log?.isOffForToday;
  }).length;

  const habitsDoneCount = todayHabits.filter((h) => {
    const log = dailyLogs[`${h.id}_${activeDate}`];
    return log?.completed && !log?.isOffForToday;
  }).length;

  return (
    <div id="gemini-ai-section" className="flex flex-col gap-4 px-3 md:px-0 animate-fadeIn">
      {/* 1. Definitive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/25 p-5 shadow-2xl">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-gradient-to-br from-amber-500/15 to-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-gradient-to-br from-amber-500/20 to-indigo-600/30 border border-amber-500/30 rounded-2xl text-amber-400 text-lg select-none shadow-sm">
                ✨
              </span>
              <h2 className="text-base font-black text-white tracking-wide">
                Gemini AI Command
              </h2>
              <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-indigo-500/20 border border-amber-500/30 text-amber-300 text-[9px] font-black uppercase rounded-full">
                Autonomous Engine
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-md">
              Command your habits and schedules naturally. Speak or type instructions — Gemini comprehends intent and settles your routine autonomously.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-[11px] font-bold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Engine Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Definitive Segmented Navigation Switcher */}
      <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl gap-1">
        <button
          id="gemini-subtab-command"
          type="button"
          onClick={() => setActiveSubSection('command')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubSection === 'command'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Console</span>
        </button>

        <button
          id="gemini-subtab-settled"
          type="button"
          onClick={() => setActiveSubSection('settled')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubSection === 'settled'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>Today's Routine</span>
          {habitsOffCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          id="gemini-subtab-architect"
          type="button"
          onClick={() => setActiveSubSection('architect')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubSection === 'architect'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>AI Coach</span>
        </button>

        <button
          id="gemini-subtab-calendar"
          type="button"
          onClick={() => setActiveSubSection('calendar')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubSection === 'calendar'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Log & Arena</span>
        </button>
      </div>

      {/* 3. SUB-SECTION A: AI COMMAND CONSOLE */}
      {activeSubSection === 'command' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* Main Command Input Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col gap-3.5 relative">
            <div className="flex items-center justify-between">
              <label htmlFor="gemini-command-input" className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Speak or Type Your Directive</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                {isListening ? '🎙️ Listening...' : 'Press Enter or Settle'}
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                id="gemini-command-input"
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteCommand();
                  }
                }}
                placeholder="e.g. Habits can be off for today, take a rest day..."
                disabled={isProcessing}
                className="w-full pl-4 pr-24 py-3.5 bg-slate-950 border border-slate-800 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none transition-all"
              />

              <div className="absolute right-2 flex items-center gap-1.5">
                {speechSupported && (
                  <button
                    id="gemini-voice-btn"
                    type="button"
                    onClick={toggleVoiceRecording}
                    disabled={isProcessing}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isListening
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-500/30'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-800'
                    }`}
                    title={isListening ? 'Stop listening' : 'Speak command with microphone'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}

                <button
                  id="gemini-settle-btn"
                  type="button"
                  onClick={() => handleExecuteCommand()}
                  disabled={isProcessing || !inputCommand.trim()}
                  className="px-3 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Settling...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span>Settle</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Listening Banner */}
            {isListening && (
              <div className="p-3 bg-gradient-to-r from-rose-950/40 via-slate-950 to-indigo-950/40 border border-rose-500/30 rounded-2xl flex items-center justify-between text-xs text-rose-200 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span className="font-bold">Listening... Speak your directive now.</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className="text-[10px] uppercase font-black px-2 py-1 bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/30 cursor-pointer"
                >
                  Done Speaking
                </button>
              </div>
            )}

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Autonomous Settlement Confirmation Card */}
          {lastSettledResult && (
            <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-5 shadow-xl flex flex-col gap-3 animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                        Settled Autonomously
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {lastSettledResult.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 italic mt-0.5">
                      &ldquo;{lastSettledResult.command}&rdquo;
                    </p>
                  </div>
                </div>

                {lastSettledResult.previousStateSnapshot && (
                  <button
                    id="gemini-undo-btn"
                    type="button"
                    onClick={handleUndo}
                    className="py-1.5 px-3 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>
                )}
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {lastSettledResult.summary}
                </p>
                {lastSettledResult.settledItems.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-850 flex flex-col gap-1.5">
                    {lastSettledResult.settledItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-indigo-200 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Categorized 1-Tap Directive Packs */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>Categorized 1-Tap Directive Packs</span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Tap to execute instantly</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {DIRECTIVE_CATEGORIES.map((cat, cIdx) => (
                <div key={cIdx} className="bg-slate-950/70 border border-slate-850 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-300 uppercase tracking-wider pb-1 border-b border-slate-850/60">
                    <span>{cat.icon}</span>
                    <span>{cat.category}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {cat.items.map((item, iIdx) => (
                      <button
                        key={iIdx}
                        type="button"
                        onClick={() => {
                          setInputCommand(item.command);
                          handleExecuteCommand(item.command);
                        }}
                        disabled={isProcessing}
                        className={`py-1.5 px-3 bg-slate-900 border rounded-xl text-left text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-between gap-2 ${item.theme}`}
                      >
                        <span className="truncate">{item.label}</span>
                        <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Command History */}
          {history.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg flex flex-col gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Recent Gemini Settlements</span>
              </span>

              <div className="flex flex-col gap-2">
                {history.slice(0, 4).map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-slate-950/70 border border-slate-850 rounded-2xl flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">
                        &ldquo;{entry.command}&rdquo;
                      </span>
                      <span className="text-[9px] text-slate-500 font-semibold">
                        {entry.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {entry.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SUB-SECTION B: TODAY'S SETTLED ROUTINE */}
      {activeSubSection === 'settled' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* Status summary banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1">
              <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Scheduled Today</span>
              <span className="text-xl font-black text-white">{todayHabits.length}</span>
              <span className="text-[9px] text-slate-500 font-bold">Habits in plan</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1">
              <span className="text-[9px] uppercase font-black text-amber-400 tracking-wider">Off for Today</span>
              <span className="text-xl font-black text-amber-300">{habitsOffCount}</span>
              <span className="text-[9px] text-slate-500 font-bold">Resting status</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-1">
              <span className="text-[9px] uppercase font-black text-emerald-400 tracking-wider">Completed</span>
              <span className="text-xl font-black text-emerald-300">{habitsDoneCount}</span>
              <span className="text-[9px] text-slate-500 font-bold">Marked finished</span>
            </div>
          </div>

          {/* Quick Action Bar for Whole Day */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black text-white">Bulk Day Controls</h4>
              <p className="text-[10px] text-slate-400">Let Gemini settle all habits at once with 1 click</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExecuteCommand('Take a rest day today, habits can be off for today')}
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold cursor-pointer transition-colors"
              >
                💤 All Off Today
              </button>
              <button
                type="button"
                onClick={() => handleExecuteCommand('Turn habits back on for today, resume active routine')}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold cursor-pointer transition-colors"
              >
                🔄 Resume All
              </button>
            </div>
          </div>

          {/* Habits Status Matrix */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col gap-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Habits Status for Today ({activeDate})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {todayHabits.map((habit) => {
                const log = dailyLogs[`${habit.id}_${activeDate}`];
                const isOff = log?.isOffForToday;
                const isDone = log?.completed && !isOff;

                return (
                  <div
                    key={habit.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                      isOff
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : isDone
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-slate-950/70 border-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl select-none">{habit.emoji}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isOff ? 'text-amber-200 line-through' : isDone ? 'text-slate-300 line-through' : 'text-white'}`}>
                          {habit.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">
                            {habit.category}
                          </span>
                          {isOff && (
                            <span className="text-[9px] text-amber-400 font-bold">
                              &bull; {log?.offReason || 'Rest Day'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isOff ? (
                        <button
                          type="button"
                          onClick={() => handleExecuteCommand(`Turn on ${habit.name} habit for today`)}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase rounded-xl transition-colors cursor-pointer"
                        >
                          💤 Off (Resume)
                        </button>
                      ) : isDone ? (
                        <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase rounded-xl">
                          ✅ Done
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleExecuteCommand(`Turn off ${habit.name} for today`)}
                          className="px-2.5 py-1 bg-slate-850 hover:bg-amber-950/40 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 border border-slate-700 text-[10px] font-black uppercase rounded-xl transition-colors cursor-pointer"
                        >
                          Active (Pause)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Schedule Alarms */}
          {scheduleItems.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col gap-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Scheduled Reminders & Alarms Today</span>
              </h3>

              <div className="flex flex-col gap-2">
                {scheduleItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950/70 border border-slate-850 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base">{item.emoji}</span>
                      <div>
                        <p className="text-xs font-bold text-white truncate">{item.title}</p>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{item.time}</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                      item.alarmEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {item.alarmEnabled ? '🔔 Alarm ON' : '🔕 Silenced'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SUB-SECTION C: AI ROUTINE ARCHITECT & COACH */}
      {activeSubSection === 'architect' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* AI Behavioral Coach Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>AI Schedule & Routine Coach</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Get behavioral analysis and balance diagnostics on your current routine
                </p>
              </div>

              <button
                type="button"
                onClick={handleGetCoachAdvice}
                disabled={coachLoading}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {coachLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Coach Review</span>
                  </>
                )}
              </button>
            </div>

            {coachAdvice && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Routine Balance Score
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black rounded-lg">
                    {coachAdvice.score} / 100
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/80 border border-slate-850 rounded-xl">
                    <span className="text-[9px] uppercase font-black text-emerald-400 block mb-1">💪 Strength</span>
                    <p className="text-slate-200 font-medium leading-relaxed">{coachAdvice.strength}</p>
                  </div>

                  <div className="p-3 bg-slate-900/80 border border-slate-850 rounded-xl">
                    <span className="text-[9px] uppercase font-black text-amber-400 block mb-1">💡 Suggestion</span>
                    <p className="text-slate-200 font-medium leading-relaxed">{coachAdvice.suggestion}</p>
                  </div>
                </div>

                {coachAdvice.microHabit && (
                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl flex items-center gap-2">
                    <span className="text-lg">🌱</span>
                    <div>
                      <span className="text-[9px] uppercase font-black text-indigo-400 block">Recommended Micro-Habit</span>
                      <p className="text-xs font-bold text-indigo-200">{coachAdvice.microHabit}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Routine Generator */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-amber-400" />
                <span>AI Routine Generator</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Describe your lifestyle or goals and Gemini will engineer a full day schedule with timed alarms
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={architectGoal}
                onChange={(e) => setArchitectGoal(e.target.value)}
                placeholder="e.g. Remote software engineer needing focus and fitness..."
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none"
              />
              <button
                type="button"
                onClick={() => handleGenerateRoutine(architectGoal)}
                disabled={architectLoading || !architectGoal.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {architectLoading ? 'Generating...' : 'Craft Routine'}
              </button>
            </div>

            {/* Quick Inspiration Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase text-slate-500 mr-1">Inspirations:</span>
              {[
                'Work from home developer',
                'Student exam revision marathon',
                'Early morning fitness athlete',
                'Calm mindful executive',
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setArchitectGoal(p);
                    handleGenerateRoutine(p);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Generated Routine Preview */}
            {architectResult && (
              <div className="mt-2 p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                    Routine Designed by Gemini
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyArchitectRoutine}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow cursor-pointer transition-colors"
                  >
                    + Add to My Schedule
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed italic">
                  &ldquo;{architectResult.summary}&rdquo;
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {architectResult.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span>{item.emoji || '📌'}</span>
                        <span className="font-bold text-slate-200">{item.title}</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-amber-300">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. SUB-SECTION D: CALENDAR LOG & 30-DAY ARENA */}
      {activeSubSection === 'calendar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4 animate-fadeIn">
          <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-2xl max-w-xs mx-auto w-full">
            <button
              type="button"
              onClick={() => setCalendarSubTab('log')}
              className={`flex-1 py-1.5 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                calendarSubTab === 'log'
                  ? 'bg-indigo-600 text-white shadow font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📅 History Log
            </button>
            <button
              type="button"
              onClick={() => setCalendarSubTab('challenges')}
              className={`flex-1 py-1.5 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                calendarSubTab === 'challenges'
                  ? 'bg-indigo-600 text-white shadow font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚔️ 30d Arena
            </button>
          </div>

          {calendarSubTab === 'log' ? (
            <CalendarView
              habits={habits}
              dailyLogs={dailyLogs}
              activeDate={activeDate}
              onSelectDate={onSelectDate}
              weekStartMonday={weekStartMonday}
            />
          ) : (
            <ChallengesView
              challenges={challenges}
              onUpdateChallenge={onUpdateChallenge}
            />
          )}
        </div>
      )}
    </div>
  );
}
