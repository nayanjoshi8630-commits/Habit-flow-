/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Clock,
  Calendar,
  Volume2,
  Trash2,
  RefreshCw,
  Plus,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Habit, ScheduleItem } from '../types';
import { SoundCatalog, playAlarmSound } from '../utils/audio';
import { formatTime12h } from './TimePickerModal';

interface ImplantPlanModalProps {
  categoriesList?: string[];
  currentHabitsCount: number;
  currentScheduleCount: number;
  onImplant: (data: {
    habits: Habit[];
    scheduleItems: ScheduleItem[];
    mode: 'merge' | 'replace';
  }) => void;
  onClose: () => void;
}

interface CandidateItem {
  id: string;
  title: string;
  time: string;
  category: string;
  emoji: string;
  alarmSound: string;
  days: number[];
  isHabit: boolean;
  isSchedule: boolean;
  selected: boolean;
}

export const ImplantPlanModal: React.FC<ImplantPlanModalProps> = ({
  categoriesList = ['Health', 'Mind', 'Work', 'Personal', 'Fitness', 'Finance'],
  currentHabitsCount,
  currentScheduleCount,
  onImplant,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [targetType, setTargetType] = useState<'both' | 'schedule' | 'habits'>('both');
  const [implantMode, setImplantMode] = useState<'merge' | 'replace'>('merge');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachSummary, setCoachSummary] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handleFile = (file: File) => {
    setFileName(file.name);
    const kb = (file.size / 1024).toFixed(1);
    setFileSize(`${kb} KB`);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRawText(content);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please ensure it is a valid text, CSV, markdown, or JSON document.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Analyze and extract plan using Gemini
  const handleExtractWithGemini = async () => {
    const textToProcess = rawText.trim();
    if (!textToProcess) {
      setError('Please attach a plan file or paste your routine notes first.');
      return;
    }

    setLoading(true);
    setError(null);
    setCoachSummary(null);

    try {
      const userKey = typeof window !== 'undefined' ? localStorage.getItem('habitflow_user_gemini_key') || '' : '';

      const res = await fetch('/api/implant-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userKey ? { 'x-gemini-key': userKey } : {}),
        },
        body: JSON.stringify({
          content: textToProcess,
          fileName: fileName || 'custom_plan.txt',
          planType: targetType,
          availableCategories: categoriesList,
          customApiKey: userKey || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to analyze plan with Gemini. Falling back to local parser.');
      }

      const data = await res.json();
      setCoachSummary(data.summary || 'Plan analyzed and ready to implant.');

      const parsedItems: CandidateItem[] = [];

      // Process schedule items
      if (Array.isArray(data.scheduleItems)) {
        for (const item of data.scheduleItems) {
          parsedItems.push({
            id: `cand_sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: item.title || 'Scheduled Activity',
            time: item.time || '08:00',
            category: item.category || 'Routine',
            emoji: item.emoji || '📌',
            alarmSound: item.alarmSound || 'soft_chime',
            days: Array.isArray(item.days) && item.days.length > 0 ? item.days : [0, 1, 2, 3, 4, 5, 6],
            isSchedule: true,
            isHabit: targetType === 'both',
            selected: true,
          });
        }
      }

      // Process habits
      if (Array.isArray(data.habits)) {
        for (const habit of data.habits) {
          // If already in list from schedule, merge
          const existing = parsedItems.find((p) => p.title.toLowerCase() === habit.name?.toLowerCase());
          if (existing) {
            existing.isHabit = true;
          } else {
            parsedItems.push({
              id: `cand_hab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: habit.name || 'Habit Routine',
              time: habit.alarmTime || '08:00',
              category: habit.category || 'General',
              emoji: habit.emoji || '✨',
              alarmSound: habit.alarmSound || 'soft_chime',
              days: [0, 1, 2, 3, 4, 5, 6],
              isSchedule: targetType === 'both',
              isHabit: true,
              selected: true,
            });
          }
        }
      }

      if (parsedItems.length === 0) {
        setError('No items could be extracted. Please ensure the document lists routine names and times.');
      } else {
        setCandidates(parsedItems);
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with Gemini service.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCandidate = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleDeleteCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const handleConfirmImplantation = () => {
    const selected = candidates.filter((c) => c.selected);
    if (selected.length === 0) {
      setError('Please select at least one item to implant.');
      return;
    }

    const newHabits: Habit[] = [];
    const newScheduleItems: ScheduleItem[] = [];

    for (const item of selected) {
      if (item.isHabit || targetType === 'habits' || targetType === 'both') {
        newHabits.push({
          id: `h_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: item.title,
          type: 'simple',
          isTask: false,
          emoji: item.emoji,
          color: 'indigo',
          category: item.category,
          frequency: 'daily',
          frequencyDays: item.days,
          alarmTime: item.time,
          alarmEnabled: Boolean(item.time),
          alarmSound: item.alarmSound,
          order: newHabits.length,
          subtasks: [],
          createdAt: new Date().toISOString(),
          isArchived: false,
        });
      }

      if (item.isSchedule || targetType === 'schedule' || targetType === 'both') {
        newScheduleItems.push({
          id: `sch_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: item.title,
          time: item.time,
          category: item.category,
          emoji: item.emoji,
          alarmEnabled: true,
          alarmSound: item.alarmSound,
          days: item.days,
        });
      }
    }

    onImplant({
      habits: newHabits,
      scheduleItems: newScheduleItems,
      mode: implantMode,
    });

    onClose();
  };

  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-indigo-500/30 p-5 sm:p-6 space-y-4 shadow-2xl my-auto animate-fadeIn max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-md shadow-indigo-600/30">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Implant Schedule & Habit Plan
              </h3>
              <p className="text-[11px] text-slate-400">
                Upload or paste any timetable, notes, or routine to implant with Gemini AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'upload' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UploadCloud size={14} />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'paste' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText size={14} />
            <span>Paste Notes</span>
          </button>
        </div>

        {/* Upload Mode */}
        {activeTab === 'upload' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.md,.json,.tsv,.ics,text/plain,text/csv,text/markdown,application/json"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 select-none ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-950/40'
                  : 'border-slate-800 bg-slate-950/60 hover:border-indigo-500/50'
              }`}
            >
              <UploadCloud size={28} className="text-indigo-400" />
              <div>
                <p className="text-xs font-bold text-white">
                  Drop your schedule or habit file here, or <span className="text-indigo-400 underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Supports .txt, .csv, .md, .json, .ics timetable routines
                </p>
              </div>
              {fileName && (
                <div className="mt-1 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-[11px] text-indigo-300 font-semibold flex items-center gap-1.5">
                  <span>📄 {fileName} ({fileSize})</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paste Mode */}
        {activeTab === 'paste' && (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400">
              Paste Routine Text or Notes:
            </label>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Example:
07:00 AM - Morning sunlight & water (Health)
09:00 AM - Deep Coding Work Block (Work)
12:30 PM - Protein Lunch & Walk (Fitness)
05:00 PM - Gym Workout (Fitness)
10:00 PM - Wind down and sleep (Mind)`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500 leading-relaxed resize-none"
            />
          </div>
        )}

        {/* Implantation Target Configuration */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Implant Target:
            </span>
            <span className="text-[10px] text-indigo-400 font-medium">Where to populate</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setTargetType('both')}
              className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
                targetType === 'both'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡ Both</span>
              <span className="text-[9px] font-normal text-slate-500">Habits + Schedule</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetType('schedule')}
              className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
                targetType === 'schedule'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>📅 Schedule</span>
              <span className="text-[9px] font-normal text-slate-500">Timeline Alarms</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetType('habits')}
              className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
                targetType === 'habits'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>🎯 Habits</span>
              <span className="text-[9px] font-normal text-slate-500">Today Check-ins</span>
            </button>
          </div>

          {/* Mode: Merge vs Replace */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Implantation Mode:
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setImplantMode('merge')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                  implantMode === 'merge' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Merge ({currentHabitsCount} existing)
              </button>
              <button
                type="button"
                onClick={() => setImplantMode('replace')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                  implantMode === 'replace' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fresh Start (Replace)
              </button>
            </div>
          </div>
        </div>

        {/* Analyze / Grasp Button */}
        {candidates.length === 0 && (
          <button
            type="button"
            onClick={handleExtractWithGemini}
            disabled={loading || !rawText.trim()}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Gemini AI Analyzing Plan...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Extract & Implant with Gemini AI</span>
              </>
            )}
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Extracted Candidates Preview */}
        {candidates.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-850 animate-fadeIn">
            {coachSummary && (
              <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200">
                <span className="font-bold text-amber-300">✨ Gemini Strategy: </span>
                {coachSummary}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400" />
                Recognized Items ({selectedCount} of {candidates.length})
              </span>
              <button
                type="button"
                onClick={handleExtractWithGemini}
                disabled={loading}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                Re-analyze
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                    cand.selected
                      ? 'bg-slate-950 border-indigo-500/30 text-white'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleCandidate(cand.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${
                        cand.selected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700'
                      }`}
                    >
                      {cand.selected && <Check size={12} />}
                    </button>
                    <span className="text-base shrink-0">{cand.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">{cand.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">
                          {cand.time}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400">{cand.category}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteCandidate(cand.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Confirm Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImplantation}
                disabled={selectedCount === 0}
                className="flex-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition cursor-pointer"
              >
                <span>Implant {selectedCount} Plans</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImplantPlanModal;
