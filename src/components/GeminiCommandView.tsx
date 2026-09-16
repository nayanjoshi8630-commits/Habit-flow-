import React, { useState } from 'react';
import {
  Sparkles,
  Mic,
  Calendar,
  Zap,
  Moon,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { sendCommandToGemini, applyGeminiActions } from '../utils/geminiCommand';
import { Habit, DailyLog, ScheduleItem } from '../types';

interface GeminiCommandViewProps {
  habits: Habit[];
  dailyLogs: Record<string, DailyLog>;
  scheduleItems: ScheduleItem[];
  availableCategories: string[];
  onApplyChanges: (changes: any) => void;
  onThemeSwitch?: (theme: 'light' | 'dark') => void;
}

export const GeminiApiKeyModal: React.FC<{ onKeySaved: () => void }> = ({ onKeySaved }) => {
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  const handleOpenStudio = () => {
    const url = 'https://aistudio.google.com/app/apikey';
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url;
  };

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed.startsWith('AIza')) {
      setError('Please paste a valid key starting with "AIza..."');
      return;
    }
    localStorage.setItem('habitflow_user_gemini_key', trimmed);
    setError('');
    onKeySaved();
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/30 text-left space-y-4 max-w-sm mx-auto shadow-xl">
      <div className="flex items-center space-x-2">
        <span className="text-xl">✨</span>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">
          Connect Free Gemini AI
        </h3>
      </div>

      <div className="space-y-2 text-xs text-slate-300">
        <div className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
            1
          </span>
          <p>Tap below to open Google AI Studio in your browser.</p>
        </div>

        <div className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
            2
          </span>
          <p>Sign in with Google, tap <b>Create API key</b>, and copy it.</p>
        </div>

        <div className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
            3
          </span>
          <p>Paste your key here to activate autonomous routines.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpenStudio}
        className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/40 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
      >
        <span>Open Google AI Studio</span>
        <ExternalLink size={14} />
      </button>

      <div className="space-y-2 pt-1">
        <input
          type="password"
          placeholder="Paste key here (AIzaSy...)"
          value={keyInput}
          onChange={(e) => {
            setKeyInput(e.target.value);
            if (error) setError('');
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
        />

        {error && <p className="text-[11px] text-rose-400 px-1">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-indigo-600/25"
        >
          Save & Activate Engine
        </button>
      </div>
    </div>
  );
};

export const GeminiCommandView: React.FC<GeminiCommandViewProps> = ({
  habits,
  dailyLogs,
  scheduleItems,
  availableCategories,
  onApplyChanges,
  onThemeSwitch,
}) => {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successSummary, setSuccessSummary] = useState('');
  const [hasKey, setHasKey] = useState<boolean>(() =>
    Boolean(
      localStorage.getItem('habitflow_user_gemini_key') ||
      (import.meta as any).env?.VITE_GEMINI_API_KEY
    )
  );

  if (!hasKey) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[70vh]">
        <GeminiApiKeyModal onKeySaved={() => setHasKey(true)} />
      </div>
    );
  }

  const handleExecute = async (inputCommand?: string) => {
    const textToRun = inputCommand || command;
    if (!textToRun.trim() || loading) return;

    setLoading(true);
    setErrorMessage('');
    setSuccessSummary('');

    try {
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);
      const dayOfWeek = now.getDay();

      const todayLogs = Object.entries(dailyLogs)
        .filter(([id]) => id.endsWith(`_${todayDate}`))
        .reduce((acc, [_, log]) => {
          acc[log.habitId] = {
            completed: Boolean(log.completed),
            isOffForToday: Boolean(log.isOffForToday),
          };
          return acc;
        }, {} as Record<string, { completed: boolean; isOffForToday?: boolean }>);

      const result = await sendCommandToGemini(textToRun, {
        todayDate,
        currentTime,
        dayOfWeek,
        habits,
        scheduleItems,
        todayLogs,
        availableCategories,
      });

      const settlements = applyGeminiActions(
        result.actions || [],
        { habits, dailyLogs, scheduleItems },
        todayDate,
        dayOfWeek
      );

      onApplyChanges(settlements);
      if (settlements.theme && onThemeSwitch) {
        onThemeSwitch(settlements.theme);
      }

      setSuccessSummary(result.summary || 'Routine settled successfully.');
      if (!inputCommand) setCommand('');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred running the command.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-5 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-4 rounded-2xl border border-indigo-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Gemini AI Command</h2>
              <p className="text-[11px] text-indigo-400 font-medium tracking-wide">AUTONOMOUS ENGINE</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] border border-emerald-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Engine Ready
          </div>
        </div>
      </div>

      {/* Directive Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <label className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
          <Sparkles size={12} className="text-indigo-400" />
          Speak or Type Your Directive
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g., Make a schedule for me"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => handleExecute()}
            disabled={loading || !command.trim()}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition"
          >
            <Sparkles size={14} />
            {loading ? 'Settling...' : 'Settle'}
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {successSummary && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs">
            {successSummary}
          </div>
        )}
      </div>

      {/* 1-Tap Quick Action Packs */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap size={13} className="text-amber-400" />
          1-Tap Directive Packs
        </h3>

        <div className="space-y-2">
          <button
            onClick={() => handleExecute('Take rest day off today')}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition text-left"
          >
            <div className="flex items-center gap-2.5">
              <Moon size={15} className="text-indigo-400" />
              <span className="text-xs font-medium text-slate-200">Take Rest Day (Off Today)</span>
            </div>
            <span className="text-xs text-slate-500">→</span>
          </button>

          <button
            onClick={() => handleExecute('Mark all morning habits done')}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition text-left"
          >
            <div className="flex items-center gap-2.5">
              <Clock size={15} className="text-emerald-400" />
              <span className="text-xs font-medium text-slate-200">Morning Habits Done</span>
            </div>
            <span className="text-xs text-slate-500">→</span>
          </button>

          <button
            onClick={() => handleExecute('Generate a productive daily routine schedule for me')}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition text-left"
          >
            <div className="flex items-center gap-2.5">
              <Calendar size={15} className="text-amber-400" />
              <span className="text-xs font-medium text-slate-200">Make Schedule for Me</span>
            </div>
            <span className="text-xs text-slate-500">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default GeminiCommandView;
      
