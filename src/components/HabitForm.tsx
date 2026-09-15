/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Bell, Clock, Compass, Folder, Music, ChevronRight } from 'lucide-react';
import { Habit, Subtask, HabitType, FrequencyType } from '../types';
import { COLOR_ACCENTS, DEFAULT_CATEGORIES } from '../utils/dummyData';
import { SoundCatalog, playAlarmSound } from '../utils/audio';
import { subscribeCustomAudioChanges } from '../utils/customAudioStorage';
import EmojiGrid from './EmojiGrid';
import SoundSelectorModal from './SoundSelectorModal';
import CategorySelectorModal from './CategorySelectorModal';
import TimePickerModal, { formatTime12h } from './TimePickerModal';

interface HabitFormProps {
  habitToEdit?: Habit | null;
  onSave: (habit: Omit<Habit, 'order' | 'createdAt'> & { id?: string }) => void;
  onClose: () => void;
  categoriesList: string[];
}

export default function HabitForm({ habitToEdit, onSave, onClose, categoriesList }: HabitFormProps) {
  // Common Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🧘');
  const [color, setColor] = useState('indigo');
  const [category, setCategory] = useState('Health');
  const [isTask, setIsTask] = useState(false);
  const [dueDate, setDueDate] = useState('');

  // Frequency
  const [frequency, setFrequency] = useState<FrequencyType>('daily');
  const [targetFrequencyDays, setTargetFrequencyDays] = useState(3);
  const [frequencyDays, setFrequencyDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default

  // Type-specific
  const [type, setType] = useState<HabitType>('simple');
  const [targetValue, setTargetValue] = useState(8);
  const [unit, setUnit] = useState('glasses');
  const [targetMinutes, setTargetMinutes] = useState(15);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Omit<Subtask, 'completed'>[]>([]);
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [newSubtaskTime, setNewSubtaskTime] = useState('08:00');
  const [newSubtaskReminder, setNewSubtaskReminder] = useState(false);

  // UI state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);

  // Habit Alarm
  const [alarmTime, setAlarmTime] = useState('08:00');
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmSound, setAlarmSound] = useState('soft_chime');
  const [, setCustomAudioVersion] = useState(0);

  useEffect(() => {
    const unsub = subscribeCustomAudioChanges(() => {
      setCustomAudioVersion((v) => v + 1);
    });
    return () => unsub();
  }, []);

  // Initialize form if editing
  useEffect(() => {
    if (habitToEdit) {
      setName(habitToEdit.name);
      setDescription(habitToEdit.description || '');
      setEmoji(habitToEdit.emoji);
      setColor(habitToEdit.color);
      setCategory(habitToEdit.category);
      setIsTask(habitToEdit.isTask);
      setDueDate(habitToEdit.dueDate || '');
      setFrequency(habitToEdit.frequency);
      setTargetFrequencyDays(habitToEdit.targetFrequencyDays || 3);
      setFrequencyDays(habitToEdit.frequencyDays || [1, 2, 3, 4, 5]);
      setType(habitToEdit.type);
      setTargetValue(habitToEdit.targetValue || 8);
      setUnit(habitToEdit.unit || 'glasses');
      setTargetMinutes(habitToEdit.targetMinutes || 15);
      setAlarmTime(habitToEdit.alarmTime || '08:00');
      setAlarmEnabled(habitToEdit.alarmEnabled ?? false);
      setAlarmSound(habitToEdit.alarmSound || 'soft_chime');
      setSubtasks(habitToEdit.subtasks || []);
    } else {
      // Set tomorrow's date as default due date for tasks
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [habitToEdit]);

  const handleToggleDay = (dayIndex: number) => {
    setFrequencyDays((prev) => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev; // Keep at least one day selected
        return prev.filter((d) => d !== dayIndex);
      } else {
        return [...prev, dayIndex].sort();
      }
    });
  };

  const handleAddSubtask = () => {
    if (!newSubtaskName.trim()) return;
    const newIdx = Math.random().toString(36).substring(2, 9);
    setSubtasks((p) => [
      ...p,
      {
        id: newIdx,
        name: newSubtaskName.trim(),
        reminderTime: newSubtaskReminder ? newSubtaskTime : undefined,
        reminderEnabled: newSubtaskReminder,
      },
    ]);
    setNewSubtaskName('');
    setNewSubtaskReminder(false);
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks((p) => p.filter((sub) => sub.id !== id));
  };

  const handleMoveSubtask = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === subtasks.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    setSubtasks((p) => {
      const copy = [...p];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a habit name!');
      return;
    }

    onSave({
      id: habitToEdit?.id,
      name: name.trim(),
      description: description.trim(),
      emoji,
      color,
      category,
      isTask,
      dueDate: isTask ? dueDate : undefined,
      frequency: isTask ? 'daily' : frequency,
      targetFrequencyDays: frequency === 'weekly' && !isTask ? targetFrequencyDays : undefined,
      frequencyDays: frequency === 'specific' && !isTask ? frequencyDays : undefined,
      type: isTask ? 'simple' : type,
      targetValue: type === 'numeric' && !isTask ? Number(targetValue) : undefined,
      unit: type === 'numeric' && !isTask ? unit.trim() : undefined,
      targetMinutes: type === 'timer' && !isTask ? Number(targetMinutes) : undefined,
      alarmTime: alarmEnabled ? alarmTime : undefined,
      alarmEnabled,
      alarmSound,
      subtasks,
      isArchived: habitToEdit ? habitToEdit.isArchived : false,
    });
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div id="habit-form-modal" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden mt-8 mb-8 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-slate-950 border-b border-slate-800">
          <h2 className="text-md font-bold text-white flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            {habitToEdit ? 'Edit Live Routine' : 'Formulate New Habit'}
          </h2>
          <button
            id="close-habit-form-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 flex-1 overflow-y-auto flex flex-col gap-5 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Chore Type Toggle */}
          <div className="bg-slate-950 p-1.5 rounded-2xl flex border border-slate-850">
            <button
              id="switch-type-recurring"
              type="button"
              onClick={() => setIsTask(false)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                !isTask 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              🔄 Recurring Habit
            </button>
            <button
              id="switch-type-onetime"
              type="button"
              onClick={() => setIsTask(true)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                isTask 
                  ? 'bg-slate-900 border border-slate-800 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-350'
              }`}
            >
              📅 One-Time Task
            </button>
          </div>

          {/* Emoji and Name */}
          <div className="flex gap-4 items-start">
            <div className="flex flex-col items-center gap-1 shrink-0 relative">
              <label className="text-[9px] uppercase font-extrabold text-slate-500 tracking-wider">Icon</label>
              <button
                id="habit-form-emoji-trigger"
                type="button"
                onClick={() => setShowEmojiPicker((p) => !p)}
                className="h-14 w-14 rounded-2xl bg-slate-950 border border-slate-850 hover:bg-slate-900 flex items-center justify-center text-2xl shadow-inner select-none transition-transform active:scale-95"
              >
                {emoji}
              </button>
              {showEmojiPicker && (
                <div id="emoji-picker-dropdown" className="absolute top-18 left-0 z-40 w-72 shadow-2xl">
                  <EmojiGrid
                    selectedEmoji={emoji}
                    onSelect={(em) => {
                      setEmoji(em);
                      setShowEmojiPicker(false);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <label htmlFor="habit-name-field" className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                Habit / Task Name
              </label>
              <input
                id="habit-name-field"
                type="text"
                placeholder="e.g. Daily Deep Reading"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl text-slate-100 font-semibold text-sm outline-none transition-colors"
              />
            </div>
          </div>

          {/* Color & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Category</label>
              <button
                id="open-category-modal-btn"
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-inner"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{category}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Color Tag</label>
              <div className="flex gap-2 items-center h-full">
                {COLOR_ACCENTS.map((c) => (
                  <button
                    id={`habit-color-btn-${c.name}`}
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className={`h-6 w-6 rounded-full ${c.bg} transition-all relative ${
                      color === c.name 
                        ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white transform scale-110 shadow-lg' 
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="habit-desc-field" className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
              Description / Notes (Optional)
            </label>
            <textarea
              id="habit-desc-field"
              placeholder="Give details or reminders..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl text-slate-300 outline-none transition-colors"
            />
          </div>

          {/* Habit Scheduled Alarm & Chime */}
          <div className="flex flex-col gap-2 bg-slate-950/60 p-4 rounded-3xl border border-slate-850">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-black text-amber-400 tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Habit Daily Alarm & Sound
              </label>
              <button
                type="button"
                onClick={() => setAlarmEnabled(!alarmEnabled)}
                className={`px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase transition-all ${
                  alarmEnabled
                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 shadow'
                    : 'bg-slate-900 border border-slate-800 text-slate-500'
                }`}
              >
                {alarmEnabled ? 'Alarm Active' : 'Enable Alarm'}
              </button>
            </div>

            {alarmEnabled && (
              <div className="grid grid-cols-2 gap-3 mt-1.5 pt-2 border-t border-slate-850/80 animate-fadeIn">
                <div>
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 block mb-1">Alarm Time</label>
                  <button
                    id="open-time-picker-btn"
                    type="button"
                    onClick={() => setShowTimePickerModal(true)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-white font-black text-xs flex items-center justify-between transition-all cursor-pointer shadow-inner"
                  >
                    <span className="flex items-center gap-1.5 truncate text-indigo-300">
                      <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{formatTime12h(alarmTime)}</span>
                    </span>
                  </button>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 block mb-1">Alarm Tune</label>
                  <button
                    id="open-sound-modal-btn"
                    type="button"
                    onClick={() => setShowSoundModal(true)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-inner"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{SoundCatalog.OPTIONS.find((s) => s.id === alarmSound)?.emoji || '🎵'}</span>
                      <span className="truncate">{SoundCatalog.OPTIONS.find((s) => s.id === alarmSound)?.name || 'Select Tune'}</span>
                    </span>
                    <Music className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* One-Time Task Due Date */}
          {isTask ? (
            <div id="task-due-date-container" className="flex flex-col gap-1.5 bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
              <label htmlFor="task-due-date-field" className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Due Date
              </label>
              <input
                id="task-due-date-field"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold tracking-wider focus:outline-none"
              />
            </div>
          ) : (
            <>
              {/* Habit tracking types */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Tracking Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'simple', label: '✅ Simple Check', desc: 'Done / Not Done' },
                    { id: 'numeric', label: '🔢 Numeric', desc: 'Track quantity target' },
                    { id: 'timer', label: '⏱️ Timer countdown', desc: 'Track duration in min' },
                  ].map((t) => (
                    <button
                      id={`habit-tracking-type-${t.id}`}
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as HabitType)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                        type === t.id
                          ? 'bg-indigo-950/30 border-indigo-500 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight">{t.label}</span>
                      <span className="text-[9px] text-slate-500 mt-1 leading-none">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Habit type specific configuration */}
              {type === 'numeric' && (
                <div id="config-type-numeric" className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="numeric-target-field" className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-wider">Target Amount</label>
                    <input
                      id="numeric-target-field"
                      type="number"
                      min={1}
                      value={targetValue}
                      onChange={(e) => setTargetValue(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="numeric-unit-field" className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-wider">Metric Unit</label>
                    <input
                      id="numeric-unit-field"
                      type="text"
                      placeholder="e.g. glasses, pages, km"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-bold"
                    />
                  </div>
                </div>
              )}

              {type === 'timer' && (
                <div id="config-type-timer" className="flex flex-col gap-1.5 bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                  <label htmlFor="timer-duration-field" className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-wider">Target Duration (Minutes)</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="timer-duration-field"
                      type="number"
                      min={1}
                      max={1440}
                      value={targetMinutes}
                      onChange={(e) => setTargetMinutes(Number(e.target.value))}
                      className="w-24 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-bold"
                    />
                    <span className="text-xs text-slate-400 font-semibold">minutes per session</span>
                  </div>
                </div>
              )}

              {/* Regular Frequencies */}
              <div className="flex flex-col gap-2.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Frequency Schedule</label>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                  {[
                    { id: 'daily', label: 'Every Day' },
                    { id: 'specific', label: 'Specific Days' },
                    { id: 'weekly', label: 'Times Per Week' },
                  ].map((f) => (
                    <button
                      id={`habit-freq-tab-${f.id}`}
                      key={f.id}
                      type="button"
                      onClick={() => setFrequency(f.id as FrequencyType)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        frequency === f.id
                          ? 'bg-slate-900 text-white shadow'
                          : 'text-slate-400 hover:text-slate-350'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {frequency === 'specific' && (
                  <div id="config-freq-specific" className="flex justify-between gap-1 my-1 bg-slate-950/20 p-2.5 rounded-2xl border border-slate-850">
                    {daysOfWeek.map((day, idx) => {
                      const isSelected = frequencyDays.includes(idx);
                      return (
                        <button
                          id={`freq-specific-day-${idx}`}
                          key={day}
                          type="button"
                          onClick={() => handleToggleDay(idx)}
                          className={`h-8 w-8 text-[10px] font-extrabold rounded-full border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                              : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-400'
                          }`}
                        >
                          {day[0]}
                        </button>
                      );
                    })}
                  </div>
                )}

                {frequency === 'weekly' && (
                  <div id="config-freq-weekly" className="flex items-center gap-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                    <span className="text-xs text-slate-400 font-bold">Goal:</span>
                    <input
                      id="weekly-times-picker"
                      type="number"
                      min={1}
                      max={7}
                      value={targetFrequencyDays}
                      onChange={(e) => setTargetFrequencyDays(Number(e.target.value))}
                      className="w-16 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-bold"
                    />
                    <span className="text-xs text-slate-400 font-semibold">days / times per week</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Subtasks Builder Accordion */}
          <div className="flex flex-col gap-2 bg-slate-950/40 p-4 rounded-3xl border border-slate-850">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Subtasks Checklist Builder</span>
            
            {/* Added Subtask List */}
            {subtasks.length > 0 && (
              <div id="form-subtasks-list" className="flex flex-col gap-1.5 border-b border-slate-850 pb-3 mb-2 max-h-48 overflow-y-auto">
                {subtasks.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="flex justify-between items-center p-2 rounded-xl bg-slate-950 border border-slate-850 text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px] bg-slate-900 border border-slate-800 h-5 w-5 rounded-full flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-semibold">{sub.name}</span>
                        {sub.reminderEnabled && sub.reminderTime && (
                          <span className="text-[9px] text-amber-500 flex items-center gap-1 font-bold">
                            <Clock className="w-2.5 h-2.5" />
                            Daily {sub.reminderTime}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`subtask-move-up-${idx}`}
                        type="button"
                        onClick={() => handleMoveSubtask(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded bg-slate-900 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`subtask-move-down-${idx}`}
                        type="button"
                        onClick={() => handleMoveSubtask(idx, 'down')}
                        disabled={idx === subtasks.length - 1}
                        className="p-1 rounded bg-slate-900 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`subtask-delete-${idx}`}
                        type="button"
                        onClick={() => handleRemoveSubtask(sub.id)}
                        className="p-1.5 rounded bg-slate-900 hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sticky subtask text field input */}
            <div className="flex flex-col gap-2.5 mt-1">
              <div className="flex items-center gap-2">
                <input
                  id="new-subtask-name"
                  type="text"
                  placeholder="Create subtask e.g. Stretch neck"
                  value={newSubtaskName}
                  onChange={(e) => setNewSubtaskName(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 outline-none font-medium"
                />
                <button
                  id="add-subtask-to-builder"
                  type="button"
                  onClick={handleAddSubtask}
                  className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/10 transition-colors shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Subtask alert checklist info */}
              <div className="flex items-center justify-between px-1">
                <button
                  id="toggle-subtask-reminder"
                  type="button"
                  onClick={() => setNewSubtaskReminder((p) => !p)}
                  className={`flex items-center gap-1.5 text-[10px] font-bold ${
                    newSubtaskReminder ? 'text-amber-500' : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {newSubtaskReminder ? 'Daily alarm active' : 'Set daily alert?'}
                </button>

                {newSubtaskReminder && (
                  <input
                    id="new-subtask-time"
                    type="time"
                    value={newSubtaskTime}
                    onChange={(e) => setNewSubtaskTime(e.target.value)}
                    className="px-2 py-0.5 text-[10px] font-bold bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none"
                  />
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            id="habit-form-cancel"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-850"
          >
            Cancel
          </button>
          
          <button
            id="habit-form-submit"
            type="button"
            onClick={handleFormSubmit}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/15 shadow-lg active:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
          >
            {habitToEdit ? 'Save Routine Changes' : 'Launch New Habit'}
          </button>
        </div>
      </div>

      {/* Visual Modals */}
      {showSoundModal && (
        <SoundSelectorModal
          selectedSoundId={alarmSound}
          onSelectSound={(snd) => setAlarmSound(snd)}
          onClose={() => setShowSoundModal(false)}
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
          initialTime={alarmTime}
          onSelectTime={(t24) => setAlarmTime(t24)}
          onClose={() => setShowTimePickerModal(false)}
        />
      )}
    </div>
  );
}
