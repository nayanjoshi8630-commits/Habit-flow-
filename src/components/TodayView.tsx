/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Trophy, 
  Compass, 
  SlidersHorizontal,
  Bookmark,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  Search,
  CheckCircle,
  Hash,
  Copy,
  Archive,
  Bell,
  Sparkles,
  X
} from 'lucide-react';
import { Habit, Subtask, DailyLog } from '../types';
import { COLOR_ACCENTS, CATEGORY_COLORS, PRESET_EMOJIS } from '../utils/dummyData';
import { playAlarmSound } from '../utils/audio';
import { playConfetti } from './ConfettiEffect';

interface TodayViewProps {
  habits: Habit[];
  dailyLogs: { [logId: string]: DailyLog };
  userName: string;
  onUpdateLog: (log: DailyLog) => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  onDuplicateHabit: (habit: Habit) => void;
  onArchiveHabit: (id: string) => void;
  onCreateHabitClick: () => void;
  onOpenGemini?: () => void;
  settings: {
    appAccent: string;
    muteSounds: boolean;
    requireAllSubtasksComplete: boolean;
  };
  activeDate: string; // YYYY-MM-DD
}

export default function TodayView({
  habits,
  dailyLogs,
  userName,
  onUpdateLog,
  onEditHabit,
  onDeleteHabit,
  onDuplicateHabit,
  onArchiveHabit,
  onCreateHabitClick,
  onOpenGemini,
  settings,
  activeDate,
}: TodayViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedHabits, setExpandedHabits] = useState<{ [id: string]: boolean }>({});
  const [reorderMode, setReorderMode] = useState(false);

  // Timer overlay state
  const [activeTimerHabit, setActiveTimerHabit] = useState<Habit | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Numeric logger state
  const [activeNumericHabit, setActiveNumericHabit] = useState<Habit | null>(null);
  const [numericValue, setNumericValue] = useState<number>(0);

  // Categories extraction
  const categories = ['All', ...Array.from(new Set(habits.filter(h => !h.isArchived).map((h) => h.category)))];

  // Map habits relative to day of the week or specific dates
  const activeDateObj = new Date(activeDate + 'T00:00:00');
  const dayOfWeekIndex = activeDateObj.getDay(); // 0 is Sunday, 1 is Monday ...

  // Filter habits scheduled for today
  const dailyScheduledHabits = habits.filter((habit) => {
    if (habit.isArchived) return false;

    // Search term filtering
    if (searchTerm && !habit.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    // Category filtering
    if (selectedCategory !== 'All' && habit.category !== selectedCategory) return false;

    // If it's a task, check if it matches the current activeDate
    if (habit.isTask) {
      return habit.dueDate === activeDate;
    }

    // Checking recurring frequencies
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'specific') {
      return habit.frequencyDays?.includes(dayOfWeekIndex) ?? false;
    }
    if (habit.frequency === 'weekly') {
      // Weekly means it's available every day to log towards a weekly total
      return true;
    }

    return true;
  });

  // Split into habits and tasks
  const todayHabits = dailyScheduledHabits.filter(h => !h.isTask).sort((a, b) => a.order - b.order);
  const todayTasks = dailyScheduledHabits.filter(h => h.isTask).sort((a, b) => a.order - b.order);

  // Log updater helpers
  const getLogForHabit = (habitId: string): DailyLog => {
    const logId = `${habitId}_${activeDate}`;
    return dailyLogs[logId] || {
      id: logId,
      habitId,
      date: activeDate,
      completed: false,
      value: 0,
      completedSubtasks: [],
    };
  };

  const handleToggleSubtask = (habit: Habit, subtaskId: string) => {
    const log = getLogForHabit(habit.id);
    let updatedSubtasks = [...log.completedSubtasks];

    if (updatedSubtasks.includes(subtaskId)) {
      updatedSubtasks = updatedSubtasks.filter((id) => id !== subtaskId);
    } else {
      updatedSubtasks.push(subtaskId);
      // Play brief sound if not muted
      if (!settings.muteSounds) {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav').play().catch(() => {});
      }
    }

    // If require all subtasks complete is ON
    const allDone = habit.subtasks.every((sub) => updatedSubtasks.includes(sub.id));
    let mainDone = log.completed;

    if (settings.requireAllSubtasksComplete && habit.subtasks.length > 0) {
      mainDone = allDone;
      if (allDone && !log.completed) {
        playConfetti();
      }
    }

    const updatedLog: DailyLog = {
      ...log,
      completedSubtasks: updatedSubtasks,
      completed: mainDone,
    };

    onUpdateLog(updatedLog);
  };

  const handleToggleMainCheck = (habit: Habit) => {
    const log = getLogForHabit(habit.id);

    if (settings.requireAllSubtasksComplete && habit.subtasks.length > 0 && !log.completed) {
      const allSubtasksDone = habit.subtasks.every((sub) => log.completedSubtasks.includes(sub.id));
      if (!allSubtasksDone) {
        alert('All subtasks must be completed before marking this habit done! Adjust this in settings.');
        return;
      }
    }

    const nextCompleted = !log.completed;
    
    if (nextCompleted) {
      playConfetti();
      if (!settings.muteSounds) {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav').play().catch(() => {});
      }
      // auto-complete numeric if needed
      if (habit.type === 'numeric' && log.value === 0) {
        log.value = habit.targetValue || 1;
      }
    }

    onUpdateLog({
      ...log,
      completed: nextCompleted,
      isOffForToday: false,
      offReason: undefined,
      value: nextCompleted && habit.type === 'numeric' ? (habit.targetValue || 1) : log.value,
    });
  };

  const toggleExpand = (habitId: string) => {
    setExpandedHabits((prev) => ({
      ...prev,
      [habitId]: !prev[habitId],
    }));
  };

  // Timer Core Functionality with Background Wall-Clock Sync
  const timerEndTimeRef = useRef<number | null>(null);

  const startTimer = (habit: Habit) => {
    setActiveTimerHabit(habit);
    const log = getLogForHabit(habit.id);
    const totalSeconds = log.completed ? 0 : (habit.targetMinutes || 1) * 60;
    const targetTime = Date.now() + totalSeconds * 1000;
    
    timerEndTimeRef.current = targetTime;
    setTimerRemaining(totalSeconds);
    setTimerRunning(true);

    // Save timer state in localStorage for background preservation
    localStorage.setItem(
      'habitflow_bg_timer',
      JSON.stringify({ habitId: habit.id, endTime: targetTime, totalSeconds })
    );
  };

  // Restoration of running background timer on load/view mount
  useEffect(() => {
    const rawBgTimer = localStorage.getItem('habitflow_bg_timer');
    if (rawBgTimer) {
      try {
        const parsed = JSON.parse(rawBgTimer);
        const habitMatch = habits.find((h) => h.id === parsed.habitId);
        if (habitMatch) {
          const remaining = Math.max(0, Math.ceil((parsed.endTime - Date.now()) / 1000));
          setActiveTimerHabit(habitMatch);
          timerEndTimeRef.current = parsed.endTime;
          setTimerRemaining(remaining);
          if (remaining > 0) {
            setTimerRunning(true);
          } else {
            localStorage.removeItem('habitflow_bg_timer');
          }
        }
      } catch (e) {
        console.error('Failed to parse bg timer', e);
      }
    }
  }, [habits]);

  useEffect(() => {
    if (timerRunning && timerEndTimeRef.current) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((timerEndTimeRef.current! - Date.now()) / 1000));
        setTimerRemaining(remaining);

        // Update document tab title for background visibility
        const mins = Math.floor(remaining / 60);
        const secs = (remaining % 60).toString().padStart(2, '0');
        if (activeTimerHabit) {
          document.title = `⏱️ ${mins}:${secs} - ${activeTimerHabit.name}`;
        }

        if (remaining <= 0) {
          clearInterval(interval);
          setTimerRunning(false);
          document.title = 'HabitFlow';
          localStorage.removeItem('habitflow_bg_timer');

          if (activeTimerHabit) {
            const habit = activeTimerHabit;
            const log = getLogForHabit(habit.id);

            // Play selected alarm sound chime!
            if (!settings.muteSounds) {
              playAlarmSound(habit.alarmSound || 'soft_chime');
            }

            if (!log.completed) {
              playConfetti();
              onUpdateLog({
                ...log,
                completed: true,
              });
              alert(`🎉 Timer Complete! Spent ${habit.targetMinutes} minutes focused on: "${habit.name}"!`);
            }
            setActiveTimerHabit(null);
          }
        }
      }, 500);

      return () => {
        clearInterval(interval);
      };
    } else {
      document.title = 'HabitFlow';
    }
  }, [timerRunning, activeTimerHabit]);

  const handleStopTimer = () => {
    setTimerRunning(false);
    timerEndTimeRef.current = null;
    document.title = 'HabitFlow';
    localStorage.removeItem('habitflow_bg_timer');
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    document.title = 'HabitFlow';
    localStorage.removeItem('habitflow_bg_timer');
    if (activeTimerHabit) {
      const totalSeconds = (activeTimerHabit.targetMinutes || 1) * 60;
      setTimerRemaining(totalSeconds);
      timerEndTimeRef.current = Date.now() + totalSeconds * 1000;
    }
  };

  // Numeric Increment Core Functionality
  const openNumericInput = (habit: Habit) => {
    setActiveNumericHabit(habit);
    const log = getLogForHabit(habit.id);
    setNumericValue(log.value || 0);
  };

  const saveNumericValue = () => {
    if (!activeNumericHabit) return;
    const habit = activeNumericHabit;
    const log = getLogForHabit(habit.id);

    const prevCompleted = log.completed;
    const target = habit.targetValue || 1;
    const nextCompleted = numericValue >= target;

    if (nextCompleted && !prevCompleted) {
      playConfetti();
    }

    onUpdateLog({
      ...log,
      value: numericValue,
      completed: nextCompleted,
    });

    setActiveNumericHabit(null);
  };

  // Quick swap handles
  const shiftOrder = (habit: Habit, direction: 'up' | 'down') => {
    const list = habit.isTask ? todayTasks : todayHabits;
    const index = list.findIndex((h) => h.id === habit.id);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === list.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const sibling = list[targetIndex];

    // Swap ordering numbers
    const tempOrder = habit.order;
    habit.order = sibling.order;
    sibling.order = tempOrder;

    // Trigger save inside upper container
    onEditHabit(habit);
    onEditHabit(sibling);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="today-dashboard-view" className="flex flex-col gap-5 px-4 md:px-0 mt-2 mb-10 overflow-x-hidden">
      
      {/* Search & Active Header */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-lg">
        <div className="flex-1 flex items-center gap-2.5 bg-slate-950 border border-slate-850 rounded-2xl px-4 py-2.5">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            id="today-search-field"
            type="text"
            placeholder="Search habits and planned tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-0 outline-none text-xs text-slate-200 placeholder-slate-500 w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            id="reorder-routine-toggle"
            type="button"
            onClick={() => setReorderMode(!reorderMode)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              reorderMode 
                ? 'bg-amber-600 border-amber-500 text-white shadow-lg' 
                : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-350'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {reorderMode ? 'Done Layout' : 'Reorder'}
          </button>

          <button
            id="quick-add-today-btn"
            type="button"
            onClick={onCreateHabitClick}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Habit
          </button>

          {onOpenGemini && (
            <button
              id="today-gemini-cmd-btn"
              type="button"
              onClick={onOpenGemini}
              className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 border border-amber-500/30 text-amber-300 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
              title="Command Gemini"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Gemini</span>
            </button>
          )}
        </div>
      </div>

      {/* Categories slider */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
        {categories.map((cat) => {
          const colorName = CATEGORY_COLORS[cat] || 'indigo';
          const isSelected = selectedCategory === cat;
          return (
            <button
              id={`today-category-filter-${cat}`}
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border shrink-0 transition-all ${
                isSelected
                  ? `bg-indigo-600 border-indigo-500 text-white shadow-md`
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              {cat === 'All' ? '🌐 All Categories' : cat}
            </button>
          );
        })}
      </div>

      {/* Habits Checklist section */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-400" /> Recurring Habits ({todayHabits.length})
          </h2>
          {todayHabits.length > 0 && (
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
              Check to clear
            </span>
          )}
        </div>

        {todayHabits.length === 0 ? (
          <div id="habits-empty-state" className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center">
            <span className="text-4xl select-none mb-3">🪴</span>
            <h3 className="text-xs font-black text-slate-200">No Habits Scheduled</h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
              Nothing on the radar in this category. Complete tasks or tap "+ Habit" at the top to configure routines!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {todayHabits.map((habit) => {
              const log = getLogForHabit(habit.id);
              const isExpanded = expandedHabits[habit.id];
              const accentColor = COLOR_ACCENTS.find((a) => a.name === habit.color) || COLOR_ACCENTS[1];
              
              // Count subtasks progress
              const totalSubs = habit.subtasks.length;
              const completedSubs = log.completedSubtasks.length;
              const subProgressPercent = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0;

              return (
                <div
                  id={`habit-card-${habit.id}`}
                  key={habit.id}
                  className={`bg-slate-900 border transition-all rounded-2xl overflow-hidden ${
                    log.completed 
                      ? 'border-indigo-600/30 shadow' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Sort controls if reordering */}
                    {reorderMode && (
                      <div className="flex flex-col gap-1.5 pr-2 border-r border-slate-800">
                        <button
                          id={`habit-sort-up-${habit.id}`}
                          type="button"
                          onClick={() => shiftOrder(habit, 'up')}
                          className="p-1 rounded bg-slate-950 text-slate-400 hover:text-white transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          id={`habit-sort-down-${habit.id}`}
                          type="button"
                          onClick={() => shiftOrder(habit, 'down')}
                          className="p-1 rounded bg-slate-950 text-slate-400 hover:text-white transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Emoji, Info */}
                    <div
                      id={`habit-info-toggle-${habit.id}`}
                      onClick={() => toggleExpand(habit.id)}
                      className="flex-1 flex items-center gap-3 cursor-pointer select-none"
                    >
                      <span className="text-2xl h-11 w-11 flex items-center justify-center rounded-2xl bg-slate-950 border border-slate-850">
                        {habit.emoji}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`text-xs font-extrabold ${log.completed ? 'line-through text-slate-500' : log.isOffForToday ? 'text-amber-200 line-through' : 'text-slate-100'}`}>
                            {habit.name}
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold bg-${habit.color}-500/15 text-${habit.color}-400`}>
                            {habit.category}
                          </span>
                          {log.isOffForToday && (
                            <span className="px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              💤 Off Today ({log.offReason || 'Rest'})
                            </span>
                          )}
                        </div>
                        {habit.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{habit.description}</p>
                        )}
                        
                        {/* Interactive trackers */}
                        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                          {habit.type === 'timer' && (
                            <span className="text-[9px] font-extrabold text-slate-400 flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                              <Clock className="w-3 h-3 text-emerald-400" />
                              Minutes: {habit.targetMinutes}m
                            </span>
                          )}
                          {habit.type === 'numeric' && (
                            <span className="text-[9px] font-extrabold text-slate-400 flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                              <Hash className="w-3 h-3 text-cyan-400" />
                              {log.value || 0}/{habit.targetValue} {habit.unit}
                            </span>
                          )}
                          {totalSubs > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-indigo-400 flex items-center gap-0.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                                Sub: {completedSubs}/{totalSubs}
                              </span>
                              <div className="h-1 w-10 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div className="h-full bg-indigo-500 text-end" style={{ width: `${subProgressPercent}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Operational Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Timer play button */}
                      {habit.type === 'timer' && !log.completed && (
                        <button
                          id={`timer-trigger-${habit.id}`}
                          type="button"
                          onClick={() => startTimer(habit)}
                          className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-inner"
                        >
                          <Play className="w-3.5 h-3.5" strokeWidth={3} />
                        </button>
                      )}

                      {/* Numeric increment button */}
                      {habit.type === 'numeric' && (
                        <button
                          id={`numeric-trigger-${habit.id}`}
                          type="button"
                          onClick={() => openNumericInput(habit)}
                          className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                        </button>
                      )}

                      {/* General checkbox */}
                      <button
                        id={`habit-checkbox-${habit.id}`}
                        type="button"
                        onClick={() => handleToggleMainCheck(habit)}
                        title={log.isOffForToday ? 'Off for today — tap to resume' : log.completed ? 'Completed' : 'Mark as done'}
                        className={`h-9 w-9 rounded-xl flex items-center justify-center border-2 transition-transform active:scale-90 ${
                          log.isOffForToday
                            ? `bg-amber-500/20 border-amber-500/40 text-amber-300 shadow shadow-amber-500/20`
                            : log.completed
                            ? `bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/35`
                            : `bg-slate-950 border-slate-800 text-transparent hover:border-slate-700`
                        }`}
                      >
                        {log.isOffForToday ? (
                          <span className="text-xs select-none">💤</span>
                        ) : (
                          <Check className="w-5 h-5 font-black" strokeWidth={3} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Subtask Area & Actions */}
                  {isExpanded && (
                    <div id={`habit-drawer-${habit.id}`} className="bg-slate-950 border-t border-slate-850 p-4 animate-fadeIn flex flex-col gap-4">
                      {/* Subtask Section */}
                      {habit.subtasks.length > 0 && (
                        <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-2xl border border-slate-900">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Subtask Checklist:</span>
                          <div className="flex flex-col gap-1.5">
                            {habit.subtasks.map((sub) => {
                              const isSubDone = log.completedSubtasks.includes(sub.id);
                              return (
                                <div
                                  id={`subtask-row-${sub.id}`}
                                  key={sub.id}
                                  className="flex items-center justify-between py-1 px-1"
                                >
                                  <label
                                    id={`subtask-label-${sub.id}`}
                                    onClick={() => handleToggleSubtask(habit, sub.id)}
                                    className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none flex-1"
                                  >
                                    <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition-all ${
                                      isSubDone
                                        ? 'bg-indigo-600 border-indigo-700 text-white'
                                        : 'border-slate-700 bg-slate-950'
                                    }`}>
                                      {isSubDone && <Check className="w-3 h-3" strokeWidth={3} />}
                                    </div>
                                    <span className={isSubDone ? 'line-through text-slate-500 font-medium' : ''}>
                                      {sub.name}
                                    </span>
                                  </label>

                                  {sub.reminderEnabled && sub.reminderTime && (
                                    <span className="text-[9px] text-amber-500 flex items-center gap-0.5 font-bold">
                                      <Bell className="w-2.5 h-2.5 animate-bounce" /> {sub.reminderTime}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Settings rules notification */}
                      {habit.subtasks.length > 0 && settings.requireAllSubtasksComplete && (
                        <p className="text-[9px] text-slate-400 font-semibold bg-indigo-950/20 px-3 py-1 rounded border border-indigo-950 flex items-center gap-1.5">
                          🛡️ Rule active: completes automatically when all subtasks are finished!
                        </p>
                      )}

                      {/* Card utility actions */}
                      <div className="flex gap-2 justify-end">
                        <button
                          id={`card-action-duplicate-${habit.id}`}
                          type="button"
                          onClick={() => onDuplicateHabit(habit)}
                          title="Duplicate"
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 hover:text-indigo-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Copy className="w-3 h-3" /> Duplicate
                        </button>
                        <button
                          id={`card-action-archive-${habit.id}`}
                          type="button"
                          onClick={() => onArchiveHabit(habit.id)}
                          title="Archive"
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 hover:text-amber-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                        <button
                          id={`card-action-edit-${habit.id}`}
                          type="button"
                          onClick={() => onEditHabit(habit)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-850 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          id={`card-action-delete-${habit.id}`}
                          type="button"
                          onClick={() => {
                            if (window.confirm('Are you absolutely sure you want to completely erase this habit? Its past log history will be deleted.')) {
                              onDeleteHabit(habit.id);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-rose-950 text-slate-400 hover:text-rose-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Erase
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* One-time Tasks section */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-400" /> Today's One-Time Tasks ({todayTasks.length})
          </h2>
          {todayTasks.length > 0 && (
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
              Completed lists
            </span>
          )}
        </div>

        {todayTasks.length === 0 ? (
          <div id="tasks-empty-state" className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center">
            <span className="text-4xl select-none mb-3">📅</span>
            <h3 className="text-xs font-black text-slate-200">No One-Time Tasks Scheduled</h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
              Plan flexible tasks due today or tap "+ Habit" and select One-Time Task to configure deadline items.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {todayTasks.map((task) => {
              const log = getLogForHabit(task.id);
              const isExpanded = expandedHabits[task.id];
              const totalSubs = task.subtasks.length;
              const completedSubs = log.completedSubtasks.length;
              const subProgressPercent = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0;

              return (
                <div
                  id={`task-card-${task.id}`}
                  key={task.id}
                  className={`bg-slate-900 border transition-all rounded-2xl overflow-hidden ${
                    log.completed 
                      ? 'border-emerald-600/30' 
                      : 'border-slate-850 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Sort controls */}
                    {reorderMode && (
                      <div className="flex flex-col gap-1.5 pr-2 border-r border-slate-800">
                        <button
                          id={`task-sort-up-${task.id}`}
                          type="button"
                          onClick={() => shiftOrder(task, 'up')}
                          className="p-1 rounded bg-slate-950 text-slate-400 hover:text-white transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          id={`task-sort-down-${task.id}`}
                          type="button"
                          onClick={() => shiftOrder(task, 'down')}
                          className="p-1 rounded bg-slate-950 text-slate-400 hover:text-white transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div
                      id={`task-info-toggle-${task.id}`}
                      onClick={() => toggleExpand(task.id)}
                      className="flex-1 flex items-center gap-3 cursor-pointer select-none"
                    >
                      <span className="text-2xl h-11 w-11 flex items-center justify-center rounded-2xl bg-slate-950 border border-slate-850">
                        {task.emoji}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-xs font-bold ${log.completed ? 'line-through text-slate-500' : log.isOffForToday ? 'text-amber-200 line-through' : 'text-slate-100'}`}>
                            {task.name}
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold bg-emerald-500/10 text-emerald-400`}>
                            {task.category}
                          </span>
                          {log.isOffForToday && (
                            <span className="px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              💤 Off Today ({log.offReason || 'Rest'})
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                        
                        {totalSubs > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                              Sub: {completedSubs}/{totalSubs}
                            </span>
                            <div className="h-1 w-10 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div className="h-full bg-emerald-500 text-end" style={{ width: `${subProgressPercent}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`task-checkbox-${task.id}`}
                        type="button"
                        onClick={() => handleToggleMainCheck(task)}
                        className={`h-9 w-9 rounded-xl flex items-center justify-center border-2 transition-transform active:scale-90 ${
                          log.completed
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-600/35'
                            : 'bg-slate-950 border-slate-800 text-transparent hover:border-slate-700'
                        }`}
                      >
                        <Check className="w-5 h-5 font-black" strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Subtask Area & Actions */}
                  {isExpanded && (
                    <div id={`task-drawer-${task.id}`} className="bg-slate-950 border-t border-slate-850 p-4 animate-fadeIn flex flex-col gap-4">
                      {task.subtasks.length > 0 && (
                        <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-2xl border border-slate-900">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Subtask Checklist:</span>
                          <div className="flex flex-col gap-1.5">
                            {task.subtasks.map((sub) => {
                              const isSubDone = log.completedSubtasks.includes(sub.id);
                              return (
                                <div
                                  id={`task-subtask-row-${sub.id}`}
                                  key={sub.id}
                                  className="flex items-center justify-between py-1 px-1"
                                >
                                  <label
                                    id={`task-subtask-label-${sub.id}`}
                                    onClick={() => handleToggleSubtask(task, sub.id)}
                                    className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none flex-1"
                                  >
                                    <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition-all ${
                                      isSubDone
                                        ? 'bg-emerald-600 border-emerald-700 text-white'
                                        : 'border-slate-700 bg-slate-950'
                                    }`}>
                                      {isSubDone && <Check className="w-3 h-3" strokeWidth={3} />}
                                    </div>
                                    <span className={isSubDone ? 'line-through text-slate-500 font-medium' : ''}>
                                      {sub.name}
                                    </span>
                                  </label>

                                  {sub.reminderEnabled && sub.reminderTime && (
                                    <span className="text-[9px] text-amber-500 flex items-center gap-0.5 font-bold">
                                      <Bell className="w-2.5 h-2.5 animate-bounce" /> {sub.reminderTime}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button
                          id={`task-action-duplicate-${task.id}`}
                          type="button"
                          onClick={() => onDuplicateHabit(task)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 hover:text-indigo-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Copy className="w-3 h-3" /> Duplicate
                        </button>
                        <button
                          id={`task-action-edit-${task.id}`}
                          type="button"
                          onClick={() => onEditHabit(task)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-850 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          id={`task-action-delete-${task.id}`}
                          type="button"
                          onClick={() => {
                            if (window.confirm('Do you really want to delete this one-time task?')) {
                              onDeleteHabit(task.id);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-rose-950 text-slate-400 hover:text-rose-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Erase
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Numerical Log Dialog Popup Modal */}
      {activeNumericHabit && (
        <div id="numeric-log-dialog" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-4 text-center">
            <div>
              <span className="text-3xl select-none">{activeNumericHabit.emoji}</span>
              <h3 className="text-sm font-bold text-slate-100 mt-1">{activeNumericHabit.name}</h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                Target: {activeNumericHabit.targetValue} {activeNumericHabit.unit}
              </p>
            </div>

            <div className="flex justify-center items-center gap-4 my-2">
              <button
                id="num-log-minus"
                type="button"
                onClick={() => setNumericValue((v) => Math.max(0, v - 1))}
                className="h-10 w-10 flex items-center justify-center font-bold text-md text-slate-200 border border-slate-850 bg-slate-950 rounded-xl hover:bg-slate-800 active:scale-95 transition-all"
              >
                -
              </button>
              
              <div className="flex flex-col items-center">
                <input
                  id="numeric-value-input"
                  type="number"
                  min={0}
                  value={numericValue}
                  onChange={(e) => setNumericValue(Math.max(0, Number(e.target.value)))}
                  className="w-16 text-center text-xl font-bold bg-slate-950 border border-slate-850 text-white rounded-xl py-1 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                  {activeNumericHabit.unit}
                </span>
              </div>

              <button
                id="num-log-plus"
                type="button"
                onClick={() => setNumericValue((v) => v + 1)}
                className="h-10 w-10 flex items-center justify-center font-bold text-md text-slate-200 border border-slate-850 bg-slate-950 rounded-xl hover:bg-slate-800 active:scale-95 transition-all"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                id="numeric-log-cancel"
                type="button"
                onClick={() => setActiveNumericHabit(null)}
                className="py-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 font-bold border border-slate-850 text-xs text-center"
              >
                Cancel
              </button>
              <button
                id="numeric-log-save"
                type="button"
                onClick={saveNumericValue}
                className="py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/15"
              >
                Log Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Timer overlay popup */}
      {activeTimerHabit && (
        <div id="countdown-timer-overlay" className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-between py-12 px-6">
          <div className="flex flex-col items-center gap-2.5 mt-8">
            <span className="text-5xl select-none animate-pulse bg-slate-900 h-18 w-18 flex items-center justify-center rounded-3xl border border-slate-800">
              {activeTimerHabit.emoji}
            </span>
            <div className="text-center mt-2">
              <h3 className="text-lg font-black text-white">{activeTimerHabit.name}</h3>
              <p className="text-xs text-indigo-400 font-bold tracking-wider uppercase mt-0.5">
                Focus Session timer
              </p>
            </div>
          </div>

          {/* Clock face displays */}
          <div className="relative h-64 w-64 rounded-full border-4 border-slate-850 flex flex-col items-center justify-center shadow-2xl">
            {/* Spinning decorative orbit dot */}
            {timerRunning && (
              <div className="absolute inset-[2px] rounded-full border-2 border-dashed border-indigo-500/20 animate-spin" style={{ animationDuration: '30s' }} />
            )}
            
            <div className="text-center z-10">
              <div className="text-4xl font-extrabold text-white tracking-widest leading-none font-mono">
                {formatTimer(timerRemaining)}
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                Remaining time
              </p>
            </div>
          </div>

          {/* Action Button Controls */}
          <div className="flex flex-col gap-5 w-full max-w-xs mb-8">
            <div className="flex justify-center items-center gap-4">
              <button
                id="timer-btn-reset"
                type="button"
                onClick={handleResetTimer}
                className="h-12 w-12 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center border border-slate-850"
                title="Restart Session"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                id="timer-btn-toggle"
                type="button"
                onClick={timerRunning ? handleStopTimer : () => setTimerRunning(true)}
                className={`h-16 w-16 rounded-3xl flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 ${
                  timerRunning
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/10'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10'
                }`}
              >
                {timerRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
              </button>

              <button
                id="timer-btn-close"
                type="button"
                onClick={() => {
                  handleStopTimer();
                  setActiveTimerHabit(null);
                }}
                className="h-12 w-12 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-red-400 flex items-center justify-center border border-slate-850"
                title="Exit Timer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 font-medium text-center">
              Keep checking your dashboard. Closing or canceling early drops progress tracking!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
