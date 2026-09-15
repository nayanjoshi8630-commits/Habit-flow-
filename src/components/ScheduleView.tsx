/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Bell, 
  BellOff,
  Plus, 
  Trash2, 
  Volume2, 
  Play, 
  Check, 
  Sparkles, 
  Calendar, 
  Tag, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Paperclip,
  UploadCloud,
  FileText,
  RefreshCw,
  Zap,
  TrendingUp,
  Brain,
  ChevronDown,
  ChevronUp,
  Square,
  Music,
  Smartphone
} from 'lucide-react';
import { ScheduleItem, Habit } from '../types';
import { SoundCatalog, playAlarmSound } from '../utils/audio';
import { subscribeCustomAudioChanges } from '../utils/customAudioStorage';
import { PRESET_EMOJIS, COLOR_ACCENTS } from '../utils/dummyData';
import { getCoachAdviceWithAI, AICoachResult } from '../utils/scheduleParser';
import SoundSelectorModal from './SoundSelectorModal';
import CategorySelectorModal from './CategorySelectorModal';
import TimePickerModal, { formatTime12h } from './TimePickerModal';
import AttachScheduleModal from './AttachScheduleModal';

interface ScheduleViewProps {
  scheduleItems: ScheduleItem[];
  habits: Habit[];
  categoriesList: string[];
  onAddScheduleItem: (item: Omit<ScheduleItem, 'id'>) => void;
  onSetWholeSchedule: (newItems: ScheduleItem[]) => void;
  onAppendSchedule: (newItems: ScheduleItem[]) => void;
  onToggleScheduleAlarm: (id: string) => void;
  onDeleteScheduleItem: (id: string) => void;
  onUpdateScheduleItemSound: (id: string, sound: string) => void;
}

export default function ScheduleView({
  scheduleItems,
  habits,
  categoriesList,
  onAddScheduleItem,
  onSetWholeSchedule,
  onAppendSchedule,
  onToggleScheduleAlarm,
  onDeleteScheduleItem,
  onUpdateScheduleItemSound,
}: ScheduleViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachModalInitialMode, setAttachModalInitialMode] = useState<'upload' | 'paste' | 'ai_generate'>('upload');
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [selectedSoundTargetItemId, setSelectedSoundTargetItemId] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00');
  const [category, setCategory] = useState(categoriesList[0] || 'Mind');
  const [emoji, setEmoji] = useState('⏰');
  const [alarmSound, setAlarmSound] = useState('soft_chime');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // All days by default
  const [linkedHabitId, setLinkedHabitId] = useState<string>('');

  // Compact section toggles
  const [showAiTools, setShowAiTools] = useState(false);
  const [showSoundTester, setShowSoundTester] = useState(false);

  // AI Coach state
  const [coachAdvice, setCoachAdvice] = useState<AICoachResult | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const [testingSoundId, setTestingSoundId] = useState<string | null>(null);
  const [, setCustomAudioVersion] = useState(0);

  useEffect(() => {
    const unsub = subscribeCustomAudioChanges(() => {
      setCustomAudioVersion((v) => v + 1);
    });
    return () => unsub();
  }, []);

  const handleTestSound = (soundId: string) => {
    if (testingSoundId === soundId) {
      setTestingSoundId(null);
    } else {
      setTestingSoundId(soundId);
      playAlarmSound(soundId);
      setTimeout(() => {
        setTestingSoundId((curr) => (curr === soundId ? null : curr));
      }, 2500);
    }
  };

  const handleOpenAttach = (mode: 'upload' | 'paste' | 'ai_generate') => {
    setAttachModalInitialMode(mode);
    setShowAttachModal(true);
  };

  const handleFetchCoachAdvice = async () => {
    if (scheduleItems.length === 0) {
      setCoachError('Please add or generate a few schedule routines first so Gemini can analyze your day.');
      return;
    }

    setIsCoachLoading(true);
    setCoachError(null);
    try {
      const advice = await getCoachAdviceWithAI(scheduleItems, habits);
      setCoachAdvice(advice);
    } catch (err: any) {
      setCoachError(err?.message || 'Could not contact Gemini coach. Please try again.');
    } finally {
      setIsCoachLoading(false);
    }
  };

  const handleDayToggle = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      if (selectedDays.length === 1) return; // Keep at least one
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddScheduleItem({
      title: title.trim(),
      time,
      category,
      emoji,
      alarmEnabled: true,
      alarmSound,
      days: selectedDays,
      habitId: linkedHabitId || undefined,
    });

    // Reset
    setTitle('');
    setTime('08:00');
    setShowAddModal(false);
  };

  // Sort schedule items by time (00:00 to 23:59)
  const sortedItems = [...scheduleItems].sort((a, b) => a.time.localeCompare(b.time));

  // Calculate current time context
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const getStatusBadge = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const itemMinutes = h * 60 + m;
    const diff = itemMinutes - currentMinutes;

    if (diff === 0) {
      return {
        text: 'Ringing now!',
        classes: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30 schedule-status-ringing animate-pulse',
      };
    } else if (diff > 0 && diff <= 60) {
      return {
        text: `Due in ${diff}m`,
        classes: 'text-amber-400 bg-amber-500/10 border-amber-500/25 schedule-status-upcoming',
      };
    } else if (diff > 0) {
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return {
        text: `in ${hours}h ${mins}m`,
        classes: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20 schedule-status-upcoming',
      };
    } else {
      return {
        text: 'Passed today',
        classes: 'text-slate-400 bg-slate-800/40 border-slate-700/40 schedule-status-passed',
      };
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div id="schedule-view-main" className="flex flex-col gap-3 px-3 sm:px-0 animate-fadeIn max-w-4xl mx-auto">
      {/* Streamlined Compact Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm text-indigo-400 shrink-0">
            ⏰
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black text-white tracking-wide">Daily Schedule</h2>
              <span className="schedule-alarm-counter px-1.5 py-0.2 text-[8px] font-black uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {sortedItems.length} {sortedItems.length === 1 ? 'Alarm' : 'Alarms'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Timed routines with background alarms & Gemini AI assistance
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            id="toggle-ai-tools-btn"
            type="button"
            onClick={() => setShowAiTools(!showAiTools)}
            className={`schedule-header-btn px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showAiTools
                ? 'ai-tools-active bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
            title="Toggle Gemini Assistant & Importer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-extrabold hidden xs:inline">AI Tools</span>
            {showAiTools ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>

          <button
            id="toggle-chime-tester-btn"
            type="button"
            onClick={() => setShowSoundTester(!showSoundTester)}
            className={`schedule-header-btn p-1.5 rounded-xl text-slate-300 transition-all cursor-pointer ${
              showSoundTester
                ? 'chime-tester-active bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-950 hover:bg-slate-800 border border-slate-800'
            }`}
            title="Toggle Sound Preview Tester"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          <button
            id="add-schedule-btn-header"
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] rounded-xl flex items-center gap-1 shadow-md shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Alarm</span>
          </button>
        </div>
      </div>

      {/* Collapsible Gemini AI Schedule & Import Hub Card */}
      {showAiTools && (
        <div 
          id="schedule-attach-file-card"
          className="bg-slate-900 border border-amber-500/30 rounded-2xl p-3.5 shadow-lg flex flex-col gap-3 animate-fadeIn"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>Gemini AI Schedule Intelligence</span>
                  <span className="px-1.5 py-0.2 text-[8px] uppercase tracking-wider font-extrabold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                    Smart
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Parse messy notes, upload files (.txt, .csv, .md), or build an ideal routine with AI.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                id="gemini-card-generate-btn"
                type="button"
                onClick={() => handleOpenAttach('ai_generate')}
                className="py-1.5 px-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-black text-[10px] rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-200" />
                <span>Generate Routine</span>
              </button>

              <button
                id="gemini-card-grasp-btn"
                type="button"
                onClick={() => handleOpenAttach('paste')}
                className="py-1.5 px-2.5 bg-slate-950 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-500/30 font-bold text-[10px] rounded-xl flex items-center gap-1 transition-all cursor-pointer"
              >
                <FileText className="w-3 h-3 text-indigo-400" />
                <span>Grasp Notes</span>
              </button>

              <button
                id="attach-schedule-open-btn-card"
                type="button"
                onClick={() => handleOpenAttach('upload')}
                className="py-1.5 px-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold text-[10px] rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                title="Upload schedule file"
              >
                <UploadCloud className="w-3 h-3" />
                <span>Attach File</span>
              </button>

              <button
                type="button"
                onClick={handleFetchCoachAdvice}
                disabled={isCoachLoading}
                className="py-1.5 px-2.5 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              >
                {isCoachLoading ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                ) : (
                  <Zap className="w-3 h-3 text-amber-400" />
                )}
                <span>Audit Routine</span>
              </button>
            </div>
          </div>

          {coachError && (
            <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{coachError}</span>
            </div>
          )}

          {coachAdvice && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px] animate-fadeIn">
              <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-black text-indigo-300">{coachAdvice.score}</span>
                  <span className="text-[6px] font-black uppercase text-indigo-400">/ 100</span>
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase text-slate-400 block">Balance Score</span>
                  <p className="text-[10px] font-bold text-slate-200">
                    {coachAdvice.score >= 80 ? '🌟 Highly Balanced' : coachAdvice.score >= 60 ? '👍 Solid Flow' : '⚡ Needs Spacing'}
                  </p>
                </div>
              </div>

              <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[8px] font-black uppercase text-emerald-400 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Strength
                </span>
                <p className="text-[10px] text-slate-300 mt-0.5 leading-tight truncate">
                  {coachAdvice.strength}
                </p>
              </div>

              <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[8px] font-black uppercase text-amber-400 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Suggestion
                </span>
                <p className="text-[10px] text-slate-300 mt-0.5 leading-tight truncate">
                  {coachAdvice.microHabit || coachAdvice.suggestion}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsible Sound Preview Tester */}
      {showSoundTester && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md flex flex-col gap-2.5 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Sound Chimes & Ring Tunes
            </span>
            <div className="flex items-center gap-2">
              <button
                id="add-custom-tune-btn"
                type="button"
                onClick={() => {
                  setSelectedSoundTargetItemId(null);
                  setShowSoundModal(true);
                }}
                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Add custom ring tune from user device"
              >
                <Smartphone className="w-3 h-3 text-indigo-400" />
                <span>+ Add Device Tune</span>
              </button>
              <span className="text-[9px] text-slate-500 font-semibold hidden xs:inline">Tap to preview</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {SoundCatalog.OPTIONS.slice(0, 8).map((sound) => (
              <button
                id={`test-sound-${sound.id}`}
                key={sound.id}
                type="button"
                onClick={() => handleTestSound(sound.id)}
                className={`schedule-sound-chip p-2 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                  testingSoundId === sound.id
                    ? 'chip-playing bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm shrink-0">{sound.emoji}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold truncate">{sound.name}</span>
                    {sound.isCustom && (
                      <span className="text-[7px] text-indigo-400 font-black uppercase tracking-wider">Device Tune</span>
                    )}
                  </div>
                </div>
                {testingSoundId === sound.id ? (
                  <Square className="w-2.5 h-2.5 text-emerald-400 fill-current shrink-0" />
                ) : (
                  <Play className="w-2.5 h-2.5 text-slate-500 fill-current shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Alarms Timeline List */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1 py-0.5">
          <span className="schedule-timeline-title text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Today's Timeline ({sortedItems.length})
          </span>
          <span className="schedule-timeline-subtitle text-[9px] text-slate-500 font-medium">Automatic background alerts</span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center gap-2">
            <Clock className="w-6 h-6 text-slate-600 mb-0.5" />
            <h3 className="text-xs font-bold text-slate-300">No Alarms or Schedules Created Yet</h3>
            <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
              Set alarm timers for morning wakeups, meditation slots, or daily focus blocks with custom audio chimes.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-1 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-[11px] font-bold hover:bg-indigo-600/30 transition-all cursor-pointer"
            >
              Set First Alarm
            </button>
          </div>
        ) : (
          sortedItems.map((item) => {
            const soundMeta = SoundCatalog.OPTIONS.find((s) => s.id === item.alarmSound) || SoundCatalog.OPTIONS[0];
            const statusInfo = getStatusBadge(item.time);

            return (
              <div
                id={`schedule-item-${item.id}`}
                key={item.id}
                className={`schedule-task-card bg-slate-900 border rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition-all ${
                  item.alarmEnabled
                    ? 'border-slate-800 hover:border-indigo-500/40 shadow-sm'
                    : 'border-slate-850/80'
                }`}
              >
                {/* Left: Time + Emoji + Details */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="schedule-emoji-box w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-sm shrink-0 shadow-inner">
                    {item.emoji}
                  </span>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <span className="text-xs sm:text-sm font-black text-white tracking-tight">{item.time}</span>
                      
                      <span className="schedule-category-badge px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0">
                        {item.category}
                      </span>

                      {!item.alarmEnabled && (
                        <span className="schedule-muted-badge px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-800/60 text-slate-400 border border-slate-700/50 shrink-0">
                          Muted
                        </span>
                      )}

                      <span className={`px-1.5 py-0.2 rounded border text-[8px] font-bold shrink-0 hidden xs:inline-flex ${statusInfo.classes}`}>
                        {statusInfo.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                      <span className="text-[12px] font-extrabold text-slate-100 truncate">{item.title}</span>
                      
                      {/* Compact Active Day Badges */}
                      <div className="hidden sm:flex items-center gap-0.5 shrink-0 ml-1">
                        {dayNamesShort.map((dName, idx) => {
                          const isActiveDay = !item.days || item.days.includes(idx);
                          if (!isActiveDay) return null;
                          return (
                            <span
                              key={idx}
                              className="schedule-day-badge w-3.5 h-3.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50 text-[7px] font-black flex items-center justify-center"
                            >
                              {dName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Sound Selector & Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Alarm Sound Selector dropdown */}
                  <select
                    value={item.alarmSound}
                    onChange={(e) => onUpdateScheduleItemSound(item.id, e.target.value)}
                    className="schedule-sound-select bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-bold rounded-xl px-2 py-1 outline-none cursor-pointer max-w-[105px] sm:max-w-[130px] truncate"
                    title="Change Alarm Sound"
                  >
                    {SoundCatalog.OPTIONS.map((snd) => (
                      <option key={snd.id} value={snd.id} className="bg-slate-900 text-white dark:bg-slate-900 dark:text-white">
                        {snd.emoji} {snd.name}
                      </option>
                    ))}
                  </select>

                  {/* Button to open sound selector / import device tune */}
                  <button
                    id={`custom-sound-btn-${item.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedSoundTargetItemId(item.id);
                      setShowSoundModal(true);
                    }}
                    className="schedule-device-tune-btn p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-colors cursor-pointer hidden sm:flex items-center justify-center"
                    title="Browse all tunes or add from device"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>

                  {/* Toggle Active Alarm */}
                  <button
                    id={`toggle-alarm-${item.id}`}
                    type="button"
                    onClick={() => onToggleScheduleAlarm(item.id)}
                    className={`schedule-alarm-toggle p-1.5 rounded-xl border transition-all cursor-pointer ${
                      item.alarmEnabled
                        ? 'alarm-active bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                        : 'alarm-inactive bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                    title={item.alarmEnabled ? 'Alarm Active (Tap to mute)' : 'Alarm Muted (Tap to enable)'}
                  >
                    {item.alarmEnabled ? (
                      <Bell className="w-3.5 h-3.5" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Delete item */}
                  <button
                    id={`delete-schedule-${item.id}`}
                    type="button"
                    onClick={() => onDeleteScheduleItem(item.id)}
                    className="schedule-delete-btn p-1.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-400 hover:text-rose-400 hover:border-rose-900/30 transition-colors cursor-pointer"
                    title="Delete Schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div id="add-schedule-modal-backdrop" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md flex flex-col gap-4 shadow-2xl animate-fadeIn"
          >
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" /> Create Scheduled Alarm
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Schedule / Event Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Morning Hydration & Stretch"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500"
              />
            </div>

            {/* Time & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Alarm Time</label>
                <button
                  type="button"
                  onClick={() => setShowTimePickerModal(true)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-2xl px-3.5 py-2 text-xs font-bold text-indigo-300 flex items-center justify-between transition-all cursor-pointer shadow-inner"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{formatTime12h(time)}</span>
                  </span>
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Category</label>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-2xl px-3.5 py-2 text-xs font-bold text-white flex items-center justify-between transition-all cursor-pointer shadow-inner"
                >
                  <span className="truncate">{category}</span>
                  <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />
                </button>
              </div>
            </div>

            {/* Emoji & Sound Choice */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Icon</label>
                <div className="flex gap-1.5 overflow-x-auto p-1 bg-slate-950 border border-slate-800 rounded-2xl scrollbar-none">
                  {PRESET_EMOJIS.slice(0, 6).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`p-1.5 rounded-xl text-sm transition-all ${
                        emoji === e ? 'bg-indigo-600 text-white shadow' : 'hover:bg-slate-850'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Alarm Chime</label>
                <button
                  type="button"
                  onClick={() => setShowSoundModal(true)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl px-3 py-2 text-xs font-bold text-white flex items-center justify-between transition-all cursor-pointer shadow-inner"
                >
                  <span className="flex items-center gap-1 truncate">
                    <span>{SoundCatalog.OPTIONS.find((s) => s.id === alarmSound)?.emoji || '🎵'}</span>
                    <span className="truncate">{SoundCatalog.OPTIONS.find((s) => s.id === alarmSound)?.name || 'Select Tune'}</span>
                  </span>
                  <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                </button>
              </div>
            </div>

            {/* Repeat Days Selector */}
            <div>
              <label className="text-[10px] uppercase font-black text-slate-400 block mb-1.5">Repeat Days</label>
              <div className="flex justify-between gap-1">
                {dayNames.map((dName, idx) => {
                  const selected = selectedDays.includes(idx);
                  return (
                    <button
                      key={dName}
                      type="button"
                      onClick={() => handleDayToggle(idx)}
                      className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                        selected
                          ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30'
                          : 'bg-slate-950 border border-slate-800 text-slate-500'
                      }`}
                    >
                      {dName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Option to Link with Existing Habit */}
            {habits.length > 0 && (
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Link to Habit (Optional)</label>
                <select
                  value={linkedHabitId}
                  onChange={(e) => setLinkedHabitId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-300 outline-none"
                >
                  <option value="">-- No linked habit --</option>
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.emoji} {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-slate-950 border border-slate-800 text-slate-400 font-bold text-xs rounded-2xl hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-600/20"
              >
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visual Modals */}
      {showSoundModal && (
        <SoundSelectorModal
          selectedSoundId={
            selectedSoundTargetItemId
              ? (scheduleItems.find((s) => s.id === selectedSoundTargetItemId)?.alarmSound || 'soft_chime')
              : alarmSound
          }
          onSelectSound={(snd) => {
            if (selectedSoundTargetItemId) {
              onUpdateScheduleItemSound(selectedSoundTargetItemId, snd);
            } else {
              setAlarmSound(snd);
            }
            setShowSoundModal(false);
            setSelectedSoundTargetItemId(null);
          }}
          onClose={() => {
            setShowSoundModal(false);
            setSelectedSoundTargetItemId(null);
          }}
        />
      )}

      {showCategoryModal && (
        <CategorySelectorModal
          selectedCategory={category}
          categoriesList={categoriesList}
          onSelectCategory={(cat) => setCategory(cat)}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {showTimePickerModal && (
        <TimePickerModal
          initialTime={time}
          onSelectTime={(t24) => setTime(t24)}
          onClose={() => setShowTimePickerModal(false)}
        />
      )}

      {showAttachModal && (
        <AttachScheduleModal
          categoriesList={categoriesList}
          currentScheduleCount={scheduleItems.length}
          initialMode={attachModalInitialMode}
          onSetWholeSchedule={(items) => {
            onSetWholeSchedule(items);
            setShowAttachModal(false);
          }}
          onAppendSchedule={(items) => {
            onAppendSchedule(items);
            setShowAttachModal(false);
          }}
          onClose={() => setShowAttachModal(false)}
        />
      )}
    </div>
  );
}
