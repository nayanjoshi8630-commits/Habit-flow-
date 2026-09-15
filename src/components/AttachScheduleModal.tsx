/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Paperclip, 
  UploadCloud, 
  FileText, 
  Check, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Volume2, 
  Play, 
  Trash2, 
  Sparkles, 
  Copy, 
  RefreshCw,
  X,
  FileCode,
  FileSpreadsheet
} from 'lucide-react';
import { ScheduleItem } from '../types';
import { 
  parseScheduleFile, 
  parseScheduleWithAI,
  generateRoutineWithAI,
  ParsedScheduleCandidate, 
  SAMPLE_SCHEDULE_TEMPLATES 
} from '../utils/scheduleParser';
import { SoundCatalog, playAlarmSound } from '../utils/audio';
import { formatTime12h } from './TimePickerModal';

interface AttachScheduleModalProps {
  categoriesList: string[];
  currentScheduleCount: number;
  onSetWholeSchedule: (newItems: ScheduleItem[]) => void;
  onAppendSchedule: (newItems: ScheduleItem[]) => void;
  onClose: () => void;
  initialMode?: 'upload' | 'paste' | 'ai_generate';
}

const AI_ROUTINE_PRESETS = [
  {
    title: '🚀 Developer Deep Work & Gym',
    prompt: 'High-productivity daily schedule for a software developer with 2 deep coding blocks, gym in afternoon, hydration, and mindful evening unwind',
  },
  {
    title: '📚 Student High-Performance',
    prompt: 'Balanced student daily timetable balancing lectures, active recall study blocks, physical exercise, and healthy sleep',
  },
  {
    title: '🧘 Mindful Wellness & Vitality',
    prompt: 'Holistic health and wellness routine with morning sun walk, meditation, clean meals, hydration reminders, and 8 hours restorative sleep',
  },
  {
    title: '⚡ 5AM Club Early Riser',
    prompt: 'Early morning momentum routine starting at 5:00 AM with exercise, journaling, learning, high-priority work, and 9:30 PM bedtime',
  },
  {
    title: '💼 Executive Focus & Leadership',
    prompt: 'Structured workday timetable for remote leadership with morning strategic priorities, afternoon meetings, workout break, and family dinner',
  },
];

export default function AttachScheduleModal({
  categoriesList,
  currentScheduleCount,
  onSetWholeSchedule,
  onAppendSchedule,
  onClose,
  initialMode = 'upload',
}: AttachScheduleModalProps) {
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'paste' | 'ai_generate'>(initialMode);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [currentRawText, setCurrentRawText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedScheduleCandidate[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [testingSoundId, setTestingSoundId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Generator state
  const [aiGoal, setAiGoal] = useState('High-productivity daily routine with deep work, workout, and healthy rest');
  const [aiWakeTime, setAiWakeTime] = useState('06:30');
  const [aiSleepTime, setAiSleepTime] = useState('22:30');
  const [aiCoachSummary, setAiCoachSummary] = useState<string | null>(null);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Test alarm sound
  const handleTestSound = (soundId: string) => {
    setTestingSoundId(soundId);
    playAlarmSound(soundId);
    setTimeout(() => setTestingSoundId(null), 1500);
  };

  // Process text file content
  const processContent = (text: string, name: string) => {
    setErrorMessage(null);
    setWarningMessage(null);
    setCurrentRawText(text);

    if (!text || text.trim().length === 0) {
      setErrorMessage('The attached file appears to be empty.');
      setParsedCandidates([]);
      return;
    }

    const result = parseScheduleFile(text, name, categoriesList);
    setDetectedFormat(result.detectedFormat);

    if (result.items.length === 0) {
      setErrorMessage(
        'No scheduled events or alarms were detected. Make sure the text includes times like "07:00 AM - Morning Yoga", "7.30am Breakfast", "Wake up at 6am", or a conversational routine paragraph.'
      );
      setParsedCandidates([]);
      return;
    }

    if (result.warnings.length > 0) {
      setWarningMessage(result.warnings.join(' '));
    }

    setParsedCandidates(result.items);
  };

  // Process with Gemini AI semantic understanding
  const handleAiGrasp = async (overrideText?: string) => {
    const textToProcess = overrideText || currentRawText || pastedText;
    if (!textToProcess || !textToProcess.trim()) {
      setErrorMessage('Please enter or paste your schedule text first.');
      return;
    }

    setIsAiLoading(true);
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      const aiResult = await parseScheduleWithAI(textToProcess, categoriesList);
      setDetectedFormat(aiResult.detectedFormat);

      if (aiResult.items.length === 0) {
        // Fallback to local
        processContent(textToProcess, fileName || 'schedule.txt');
      } else {
        setParsedCandidates(aiResult.items);
        if (aiResult.warnings.length > 0) {
          setWarningMessage(aiResult.warnings.join(' '));
        }
      }
    } catch {
      // Graceful fallback to local parser
      processContent(textToProcess, fileName || 'schedule.txt');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Generate complete routine from goal with Gemini AI
  const handleGenerateWithAi = async () => {
    if (!aiGoal.trim()) {
      setErrorMessage('Please enter what kind of routine you would like Gemini to design.');
      return;
    }

    setIsAiLoading(true);
    setErrorMessage(null);
    setWarningMessage(null);
    setAiCoachSummary(null);

    try {
      const result = await generateRoutineWithAI(
        aiGoal.trim(),
        categoriesList,
        aiWakeTime,
        aiSleepTime
      );

      setAiCoachSummary(result.summary);
      setDetectedFormat(`Gemini AI Routine Design (${result.modelUsed || 'Gemini 3.6 Flash'}) ✨`);
      setParsedCandidates(result.items);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gemini AI was unable to generate routine. Please check your network or try again.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle file reading from input or drop
  const handleFile = (file: File) => {
    setFileName(file.name);
    const kb = (file.size / 1024).toFixed(1);
    setFileSize(`${kb} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      processContent(content, file.name);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file. Please ensure it is a valid text, markdown, CSV, or JSON file.');
    };
    reader.readAsText(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleProcessPastedText = () => {
    setFileName('pasted-schedule.txt');
    setFileSize(`${(pastedText.length / 1024).toFixed(1)} KB`);
    processContent(pastedText, 'pasted-schedule.txt');
  };

  const handleLoadSample = (sampleText: string, sampleName: string) => {
    setPastedText(sampleText);
    setFileName(`${sampleName}.txt`);
    setFileSize(`${(sampleText.length / 1024).toFixed(1)} KB`);
    processContent(sampleText, `${sampleName}.txt`);
  };

  // Toggle item selection
  const handleToggleCandidate = (index: number) => {
    setParsedCandidates(prev => 
      prev.map((item, idx) => idx === index ? { ...item, selected: !item.selected } : item)
    );
  };

  // Delete item from candidate list
  const handleDeleteCandidate = (index: number) => {
    setParsedCandidates(prev => prev.filter((_, idx) => idx !== index));
  };

  // Final actions
  const selectedCandidates = parsedCandidates.filter(c => c.selected !== false);

  const createScheduleItems = (): ScheduleItem[] => {
    return selectedCandidates.map((c, idx) => ({
      id: `sch_file_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      title: c.title,
      time: c.time,
      category: c.category,
      emoji: c.emoji,
      alarmEnabled: c.alarmEnabled,
      alarmSound: c.alarmSound,
      days: c.days,
    }));
  };

  const handleApplyReplaceWhole = () => {
    const items = createScheduleItems();
    if (items.length === 0) return;
    onSetWholeSchedule(items);
    onClose();
  };

  const handleApplyAppend = () => {
    const items = createScheduleItems();
    if (items.length === 0) return;
    onAppendSchedule(items);
    onClose();
  };

  return (
    <div id="attach-schedule-modal-backdrop" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        id="attach-schedule-modal-content"
        className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-xl flex flex-col gap-4 shadow-2xl my-auto animate-fadeIn max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">Attach & Import Schedule</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload or paste your schedule in any text format to automatically configure your daily timeline.
              </p>
            </div>
          </div>

          <button
            id="attach-schedule-close-btn"
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="grid grid-cols-3 bg-slate-950 border border-slate-850 p-1 rounded-2xl gap-1">
          <button
            id="tab-upload-file"
            type="button"
            onClick={() => setActiveInputMode('upload')}
            className={`py-2 px-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'upload'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span> File
          </button>

          <button
            id="tab-paste-text"
            type="button"
            onClick={() => setActiveInputMode('paste')}
            className={`py-2 px-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'paste'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Paste</span> Notes
          </button>

          <button
            id="tab-gemini-generate"
            type="button"
            onClick={() => setActiveInputMode('ai_generate')}
            className={`py-2 px-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'ai_generate'
                ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/20'
                : 'text-amber-400/90 hover:text-amber-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Gemini AI</span>
          </button>
        </div>

        {/* Input Mode 1: File Drop Zone */}
        {activeInputMode === 'upload' && (
          <div className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.md,.json,.ics,.tsv,text/plain,text/csv,text/markdown,application/json,text/calendar"
              onChange={handleFileInputChange}
              className="hidden"
              id="schedule-file-native-input"
            />

            <div
              id="schedule-file-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 select-none ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-950/40 scale-[1.01]'
                  : 'border-slate-750 bg-slate-950/60 hover:border-indigo-500/60 hover:bg-slate-950'
              }`}
            >
              <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  Drop your schedule file here, or <span className="text-indigo-400 underline">browse</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Accepts <span className="font-bold text-slate-300">.txt, .csv, .md, .json, .ics</span> files with time-stamped routines.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-extrabold text-slate-400">
                  📄 Plain Text (.txt)
                </span>
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-extrabold text-slate-400">
                  📊 CSV / Excel (.csv)
                </span>
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-extrabold text-slate-400">
                  📝 Markdown (.md)
                </span>
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-extrabold text-slate-400">
                  ⚡ JSON (.json)
                </span>
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-extrabold text-slate-400">
                  📅 iCal (.ics)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Input Mode 2: Paste Raw Text & Sample Templates */}
        {activeInputMode === 'paste' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-black text-slate-400">
                Write or Paste Schedule Text:
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 font-bold">Samples:</span>
                {SAMPLE_SCHEDULE_TEMPLATES.map((tpl, i) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => handleLoadSample(tpl.text, tpl.name)}
                    className="px-2 py-0.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-lg text-[9px] font-bold text-indigo-300 transition-all cursor-pointer"
                  >
                    Template {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="schedule-paste-textarea"
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Supports any text or format! Examples:
• 06:30 AM - Morning Wakeup & Water
• 7.30am Breakfast
• 9:00 - 10:30 Team Standup & Planning (Work)
• Gym at 6pm [Fitness] (Mon, Wed, Fri)
• Dinner at 8:00
• Or freeform stories: "I wake up at 6am, workout at 7am, have lunch at 1pm, and sleep at 10:30pm"`}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500 leading-relaxed resize-none"
            />

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Primary AI Grasp Button */}
              <button
                id="ai-grasp-schedule-btn"
                type="button"
                onClick={() => handleAiGrasp(pastedText)}
                disabled={!pastedText.trim() || isAiLoading}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                {isAiLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-indigo-200 animate-spin" />
                    <span>Gemini AI Grasping Schedule...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Grasp with Gemini AI</span>
                  </>
                )}
              </button>

              <button
                id="process-pasted-schedule-btn"
                type="button"
                onClick={handleProcessPastedText}
                disabled={!pastedText.trim() || isAiLoading}
                className="py-2.5 px-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed font-extrabold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Instant Regex Parser without API"
              >
                <span>Local Parse</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              💡 Gemini AI understands messy bullet points, 12h/24h, dotted times (7.30), conversational paragraphs, emojis, and day repetitions.
            </p>
          </div>
        )}

        {/* Input Mode 3: Gemini AI Routine Generator */}
        {activeInputMode === 'ai_generate' && (
          <div className="flex flex-col gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-950/50 via-slate-950 to-amber-950/20 border border-indigo-500/25 rounded-2xl">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs">
                  ✨
                </span>
                <h4 className="text-xs font-black text-white">
                  Describe Your Desired Routine
                </h4>
                <span className="ml-auto text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  Gemini 3.6 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tell Gemini what your day looks like, your goals, or pick an inspiration preset below.
              </p>
            </div>

            {/* Quick Inspiration Presets */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Inspiration Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AI_ROUTINE_PRESETS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => setAiGoal(preset.prompt)}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 rounded-xl text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Goal Input */}
            <textarea
              id="ai-routine-goal-input"
              rows={3}
              value={aiGoal}
              onChange={(e) => setAiGoal(e.target.value)}
              placeholder="e.g., A balanced daily routine for an early bird writer with morning workout, 2 focus blocks, healthy meals, and meditation..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 leading-relaxed resize-none"
            />

            {/* Wake & Sleep times */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-2xl flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Wake Up:</span>
                <input
                  type="time"
                  value={aiWakeTime}
                  onChange={(e) => setAiWakeTime(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs font-mono text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-2xl flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Bedtime:</span>
                <input
                  type="time"
                  value={aiSleepTime}
                  onChange={(e) => setAiSleepTime(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs font-mono text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              id="btn-generate-routine-gemini"
              type="button"
              onClick={handleGenerateWithAi}
              disabled={!aiGoal.trim() || isAiLoading}
              className="py-3 px-4 bg-gradient-to-r from-amber-500 via-indigo-600 to-indigo-700 hover:from-amber-400 hover:via-indigo-500 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  <span>Gemini AI Designing Your Routine...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Generate Schedule with Gemini AI</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-rose-300 text-xs font-semibold animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Warning Alert */}
        {warningMessage && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-center gap-2.5 text-amber-300 text-xs font-semibold animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Parsed Results Overview & Candidate List */}
        {parsedCandidates.length > 0 && (
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-850 animate-fadeIn">
            {/* Gemini AI Coach Rationale Card */}
            {aiCoachSummary && (
              <div className="p-3 bg-gradient-to-r from-amber-950/40 via-indigo-950/40 to-slate-950 border border-amber-500/30 rounded-2xl flex items-start gap-2.5">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0 text-sm">
                  ✨
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                      Gemini Routine Strategy
                    </span>
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-amber-500/15 text-amber-300 rounded">
                      AI Coach
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed font-medium">
                    {aiCoachSummary}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Recognized Schedule ({selectedCandidates.length} of {parsedCandidates.length} items)
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Format: <span className="text-indigo-400 font-bold">{detectedFormat}</span> {fileName ? `• ${fileName} (${fileSize})` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!detectedFormat?.includes('Gemini') && (
                  <button
                    type="button"
                    onClick={() => handleAiGrasp()}
                    disabled={isAiLoading}
                    className="px-2.5 py-1 bg-indigo-950/50 border border-indigo-500/30 hover:border-indigo-400 text-indigo-300 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Let Gemini AI enhance task categories, emojis, and day schedules"
                  >
                    {isAiLoading ? (
                      <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    )}
                    <span>AI Enhance</span>
                  </button>
                )}
                <span className="text-[10px] font-bold text-slate-400">
                  Sorted chronologically
                </span>
              </div>
            </div>

            {/* Candidate Timeline List */}
            <div className="flex flex-col gap-2 max-h-56 sm:max-h-64 overflow-y-auto pr-1">
              {parsedCandidates.map((candidate, idx) => {
                const isSelected = candidate.selected !== false;

                return (
                  <div
                    key={`${candidate.time}-${idx}`}
                    className={`border rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-indigo-500/30'
                        : 'bg-slate-950/40 border-slate-850 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleCandidate(idx)}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <span className="text-xl p-1 bg-slate-900 border border-slate-850 rounded-xl shrink-0">
                        {candidate.emoji}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-white">
                            {formatTime12h(candidate.time)} ({candidate.time})
                          </span>
                          <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md text-[8px] font-extrabold uppercase">
                            {candidate.category}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-200 truncate mt-0.5">
                          {candidate.title}
                        </h5>

                        <div className="flex items-center gap-1 mt-1">
                          {dayNames.map((d, dIdx) => (
                            <span
                              key={d}
                              className={`text-[7px] font-black uppercase px-1 rounded ${
                                candidate.days.includes(dIdx)
                                  ? 'bg-slate-800 text-slate-300'
                                  : 'text-slate-650'
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Audio sound preview */}
                      <button
                        type="button"
                        onClick={() => handleTestSound(candidate.alarmSound)}
                        className={`p-1.5 rounded-xl border text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          testingSoundId === candidate.alarmSound
                            ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Preview alarm chime"
                      >
                        <Play className="w-3 h-3 text-amber-400" />
                        <span className="hidden sm:inline">
                          {SoundCatalog.OPTIONS.find(s => s.id === candidate.alarmSound)?.emoji || '🎐'}
                        </span>
                      </button>

                      {/* Remove item from list */}
                      <button
                        type="button"
                        onClick={() => handleDeleteCandidate(idx)}
                        className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-900/30 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Application Options as Requested */}
            <div className="flex flex-col sm:flex-row gap-2.5 mt-2 pt-2 border-t border-slate-850">
              {/* Option 1: Replace Whole Schedule (User's primary request) */}
              <button
                id="btn-set-whole-schedule"
                type="button"
                onClick={handleApplyReplaceWhole}
                disabled={selectedCandidates.length === 0}
                className="flex-1 py-3 px-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Set Whole Schedule ({selectedCandidates.length} Items)</span>
              </button>

              {/* Option 2: Append to existing schedule */}
              {currentScheduleCount > 0 && (
                <button
                  id="btn-append-schedule"
                  type="button"
                  onClick={handleApplyAppend}
                  disabled={selectedCandidates.length === 0}
                  className="py-3 px-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Append to Current ({currentScheduleCount})</span>
                </button>
              )}
            </div>
            
            <p className="text-[10px] text-slate-500 text-center">
              "Set Whole Schedule" will overwrite your existing {currentScheduleCount} schedule routine{currentScheduleCount === 1 ? '' : 's'} with these {selectedCandidates.length} parsed items.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
