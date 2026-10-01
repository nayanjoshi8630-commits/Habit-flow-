/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Moon,
  Clock,
  Calendar,
  Key,
  ExternalLink,
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Radio,
  Check,
} from 'lucide-react';
import { sendCommandToGemini, applyGeminiActions } from '../utils/geminiCommand';
import { Habit, DailyLog, ScheduleItem } from '../types';
import ImplantPlanModal from './ImplantPlanModal';

interface GeminiCommandViewProps {
  habits: Habit[];
  dailyLogs: Record<string, DailyLog>;
  scheduleItems: ScheduleItem[];
  availableCategories?: string[];
  categoriesList?: string[];
  challenges?: any[];
  userName?: string;
  activeDate?: string;
  weekStartMonday?: boolean;
  onUpdateFullState?: (changes: {
    habits: Habit[];
    dailyLogs: Record<string, DailyLog>;
    scheduleItems: ScheduleItem[];
    theme?: 'light' | 'dark';
  }) => void;
  onApplyChanges?: (changes: any) => void;
  onUpdateChallenge?: (challenge: any) => void;
  onSelectDate?: (dateStr: string) => void;
  onThemeSwitch?: (theme: 'light' | 'dark') => void;
  onNavigateToTab?: (tab: 'today' | 'schedule') => void;
}

export const GeminiApiKeyModal: React.FC<{
  onClose: () => void;
  onKeySaved: (key: string) => void;
}> = ({ onClose, onKeySaved }) => {
  const [keyInput, setKeyInput] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('habitflow_user_gemini_key') || '' : ''
  );
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const handleOpenStudio = () => {
    const url = 'https://aistudio.google.com/app/apikey';
    try {
      window.open(url, '_blank');
    } catch {
      window.location.href = url;
    }
  };

  const handleTestKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setError('Please paste your Google AI Studio API key first.');
      return;
    }

    setVerifying(true);
    setError('');
    setVerifiedSuccess(false);

    try {
      const res = await fetch('/api/verify-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setVerifiedSuccess(true);
        localStorage.setItem('habitflow_user_gemini_key', trimmed);
        onKeySaved(trimmed);
      } else {
        setError(data.error || 'Authentication failed. Please check that the key is active in Google AI Studio.');
      }
    } catch (e: any) {
      setError(e?.message || 'Network error verifying key.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setError('Please paste your Gemini API key.');
      return;
    }

    if (trimmed.length < 10) {
      setError('Key appears too short. Please copy the full key.');
      return;
    }

    localStorage.setItem('habitflow_user_gemini_key', trimmed);
    setError('');
    onKeySaved(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-indigo-500/30 p-5 sm:p-6 space-y-4 shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Sparkles size={16} />
            </span>
            <h3 className="text-xs font-bold text-white tracking-wider uppercase">
              Google AI Studio API Key
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <div className="flex items-start gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
              1
            </span>
            <p>Open Google AI Studio to generate your free key.</p>
          </div>

          <div className="flex items-start gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
              2
            </span>
            <p>Sign in with Google, tap <b>Create API key</b>, and copy it.</p>
          </div>

          <div className="flex items-start gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
              3
            </span>
            <p>Paste here to unlock unlimited live routine grasping and commands.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenStudio}
          className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/40 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Open Google AI Studio</span>
          <ExternalLink size={14} />
        </button>

        <div className="space-y-2 pt-1">
          <input
            type="password"
            placeholder="Paste AI Studio key (AIza...)"
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              if (error) setError('');
              setVerifiedSuccess(false);
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />

          {error && <p className="text-[11px] text-rose-400 px-1">{error}</p>}
          {verifiedSuccess && (
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px] flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Real-time connection verified successfully!</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={verifying || !keyInput.trim()}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
            >
              {verifying ? (
                <>
                  <RefreshCw size={12} className="animate-spin text-indigo-400" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Live</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check size={14} />
              <span>Save & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GeminiCommandView: React.FC<GeminiCommandViewProps> = ({
  habits = [],
  dailyLogs = {},
  scheduleItems = [],
  availableCategories = [],
  categoriesList = [],
  onUpdateFullState,
  onApplyChanges,
  onThemeSwitch,
  onNavigateToTab,
}) => {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successSummary, setSuccessSummary] = useState('');
  const [settledList, setSettledList] = useState<string[]>([]);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showImplantModal, setShowImplantModal] = useState(false);
  const [activeUserKey, setActiveUserKey] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('habitflow_user_gemini_key') : null
  );

  // Real-time connection status
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'checking' | 'offline'>('checking');
  const [connectionModel, setConnectionModel] = useState('gemini-3.8-flash');

  // Verify real-time connection on mount or when key updates
  useEffect(() => {
    let isMounted = true;

    async function checkConnection() {
      const userKey = typeof window !== 'undefined' ? localStorage.getItem('habitflow_user_gemini_key') || '' : '';
      
      try {
        const res = await fetch('/api/verify-gemini-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: userKey || undefined }),
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setConnectionStatus(data.valid ? 'connected' : 'offline');
            if (data.model) setConnectionModel(data.model);
          }
          return;
        }
      } catch {
        // Fall back to health check
        try {
          const healthRes = await fetch('/api/health');
          if (healthRes.ok) {
            const health = await healthRes.json();
            if (isMounted) {
              setConnectionStatus(health.hasGeminiKey || userKey ? 'connected' : 'offline');
            }
            return;
          }
        } catch {
          // ignore
        }
      }

      if (isMounted) {
        setConnectionStatus(userKey ? 'connected' : 'offline');
      }
    }

    checkConnection();
    return () => {
      isMounted = false;
    };
  }, [activeUserKey]);

  const handleExecute = async (inputCommand?: string) => {
    const textToRun = inputCommand || command;
    if (!textToRun.trim() || loading) return;

    setLoading(true);
    setErrorMessage('');
    setSuccessSummary('');
    setSettledList([]);

    try {
      const now = new Date();
      const todayDate = activeDate || now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);
      const dayOfWeek = now.getDay();

      const todayLogs = Object.entries(dailyLogs || {})
        .filter(([id]) => id.endsWith(`_${todayDate}`))
        .reduce((acc, [_, log]) => {
          acc[log.habitId] = {
            completed: Boolean(log.completed),
            isOffForToday: Boolean(log.isOffForToday),
          };
          return acc;
        }, {} as Record<string, { completed: boolean; isOffForToday?: boolean }>);

      const effectiveCategories = availableCategories.length > 0 ? availableCategories : categoriesList;

      const result = await sendCommandToGemini(textToRun, {
        todayDate,
        currentTime,
        dayOfWeek,
        habits: Array.isArray(habits) ? habits : [],
        scheduleItems: Array.isArray(scheduleItems) ? scheduleItems : [],
        todayLogs,
        availableCategories: Array.isArray(effectiveCategories) ? effectiveCategories : [],
      });

      const settlements = applyGeminiActions(
        result?.actions || [],
        { habits: habits || [], dailyLogs: dailyLogs || {}, scheduleItems: scheduleItems || [] },
        todayDate,
        dayOfWeek
      );

      // Trigger state updates up to App.tsx
      if (typeof onUpdateFullState === 'function') {
        onUpdateFullState(settlements);
      } else if (typeof onApplyChanges === 'function') {
        onApplyChanges(settlements);
      }

      if (settlements?.theme && typeof onThemeSwitch === 'function') {
        onThemeSwitch(settlements.theme);
      }

      setSuccessSummary(result?.summary || 'Routine settled successfully with Gemini AI ✨');
      setSettledList(result?.settledItems || []);
      if (!inputCommand) setCommand('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred while running the command.');
    } finally {
      setLoading(false);
    }
  };

  const handleImplantPlans = (data: {
    habits: Habit[];
    scheduleItems: ScheduleItem[];
    mode: 'merge' | 'replace';
  }) => {
    const todayDate = new Date().toISOString().split('T')[0];

    let mergedHabits: Habit[] = [];
    let mergedSchedule: ScheduleItem[] = [];

    if (data.mode === 'replace') {
      mergedHabits = data.habits;
      mergedSchedule = data.scheduleItems;
    } else {
      // Merge unique
      mergedHabits = [...habits];
      for (const h of data.habits) {
        if (!mergedHabits.some((x) => x.name.toLowerCase() === h.name.toLowerCase())) {
          mergedHabits.push(h);
        }
      }

      mergedSchedule = [...scheduleItems];
      for (const s of data.scheduleItems) {
        if (!mergedSchedule.some((x) => x.title.toLowerCase() === s.title.toLowerCase() && x.time === s.time)) {
          mergedSchedule.push(s);
        }
      }
    }

    if (typeof onUpdateFullState === 'function') {
      onUpdateFullState({
        habits: mergedHabits,
        dailyLogs,
        scheduleItems: mergedSchedule,
      });
    }

    setSuccessSummary(
      `Successfully implanted ${data.habits.length} habits and ${data.scheduleItems.length} schedule alarms from your plan file!`
    );
    setSettledList([
      ...data.habits.map((h) => `🎯 Habit: ${h.emoji} ${h.name} (${h.category})`),
      ...data.scheduleItems.map((s) => `⏰ Schedule: ${s.emoji} ${s.title} at ${s.time}`),
    ]);
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto relative">
      {/* Key Connection Modal */}
      {showKeyModal && (
        <GeminiApiKeyModal
          onClose={() => setShowKeyModal(false)}
          onKeySaved={(newKey) => {
            setActiveUserKey(newKey);
            setConnectionStatus('connected');
          }}
        />
      )}

      {/* File Implant Modal */}
      {showImplantModal && (
        <ImplantPlanModal
          categoriesList={availableCategories.length > 0 ? availableCategories : categoriesList}
          currentHabitsCount={habits.length}
          currentScheduleCount={scheduleItems.length}
          onImplant={handleImplantPlans}
          onClose={() => setShowImplantModal(false)}
        />
      )}

      {/* Header with REAL-TIME Connection Symbol */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-4 rounded-3xl border border-indigo-500/25 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-md shadow-indigo-600/30">
              <Sparkles size={18} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold text-white">Gemini AI Command</h2>
                {/* REAL-TIME CONNECTION SYMBOL BADGE */}
                {connectionStatus === 'connected' ? (
                  <span
                    id="gemini-connection-symbol"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold tracking-wide"
                    title="Real-time connection active to Google AI Studio"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Live Connected</span>
                  </span>
                ) : connectionStatus === 'checking' ? (
                  <span
                    id="gemini-connection-symbol"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold"
                  >
                    <RefreshCw size={9} className="animate-spin text-slate-400" />
                    <span>Connecting...</span>
                  </span>
                ) : (
                  <span
                    id="gemini-connection-symbol"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold"
                    title="Google AI Studio key not configured — using local autonomous engine"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                    <span>Local Engine</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-indigo-300/80 font-medium">
                {connectionStatus === 'connected' ? `${connectionModel} • Real-time Executive Engine` : 'Autonomous Routine Settler'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
              connectionStatus === 'connected'
                ? 'bg-slate-950 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                : 'bg-slate-950 border-indigo-500/30 text-indigo-300 hover:border-indigo-400'
            }`}
            title="Configure or test Google AI Studio API key"
          >
            <Key size={12} className={connectionStatus === 'connected' ? 'text-emerald-400' : 'text-indigo-400'} />
            <span>{activeUserKey ? 'Key Active' : 'Connect Key'}</span>
          </button>
        </div>
      </div>

      {/* FEATURE 2: CUSTOM FILE ADD / IMPLANT DIALOG BANNER */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-4 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-2xl shrink-0">
            <UploadCloud size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Implant Plan from File</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase">
                New
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Upload timetable, notes, CSV, or schedule file to implant routines
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowImplantModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition shrink-0 cursor-pointer"
        >
          <span>Implant File</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Directive Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-lg">
        <label className="text-[11px] font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
          <Sparkles size={12} className="text-indigo-400" />
          Speak or Type Your Directive
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g., Make a schedule for me, rest day today, gym at 5pm..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={() => handleExecute()}
            disabled={loading || !command.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 rounded-2xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Settling...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Settle</span>
              </>
            )}
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successSummary && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2 animate-fadeIn">
            <div className="flex items-start gap-2 text-emerald-300 text-xs font-bold">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-400" />
              <span>{successSummary}</span>
            </div>

            {settledList.length > 0 && (
              <div className="space-y-1 pl-6 pt-1 border-t border-emerald-500/20">
                {settledList.map((item, idx) => (
                  <div key={idx} className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5">
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Navigation to see newly settled items */}
            {onNavigateToTab && (
              <div className="flex gap-2 pt-1 pl-6">
                <button
                  type="button"
                  onClick={() => onNavigateToTab('today')}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold hover:bg-slate-800 transition"
                >
                  View in Today Habits →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('schedule')}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold hover:bg-slate-800 transition"
                >
                  View in Schedule Timeline →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1-Tap Directive Packs */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap size={13} className="text-amber-400" />
          1-Tap Quick Directives
        </h3>

        <div className="space-y-2">
          <button
            onClick={() => handleExecute('Make a schedule for me')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition text-left cursor-pointer group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-105 transition-transform">
                <Calendar size={15} />
              </span>
              <div>
                <span className="text-xs font-bold text-slate-200 block">Make Schedule For Me</span>
                <span className="text-[10px] text-slate-400">Creates complete daily routine & alarms</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-slate-500 group-hover:text-amber-400 transition-colors" />
          </button>

          <button
            onClick={() => handleExecute('Take rest day off today')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition text-left cursor-pointer group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl group-hover:scale-105 transition-transform">
                <Moon size={15} />
              </span>
              <div>
                <span className="text-xs font-bold text-slate-200 block">Take Rest Day (Off Today)</span>
                <span className="text-[10px] text-slate-400">Pauses active habits & silences alarms</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </button>

          <button
            onClick={() => handleExecute('Mark all habits done for today')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition text-left cursor-pointer group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-105 transition-transform">
                <Clock size={15} />
              </span>
              <div>
                <span className="text-xs font-bold text-slate-200 block">Mark All Habits Done</span>
                <span className="text-[10px] text-slate-400">Checks off today's habits immediately</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiCommandView;
