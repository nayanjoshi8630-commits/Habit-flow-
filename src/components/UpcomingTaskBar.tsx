/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  CheckCircle2, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  ArrowRight,
  Zap
} from 'lucide-react';
import { Habit, DailyLog, ScheduleItem } from '../types';

interface UpcomingTaskBarProps {
  habits: Habit[];
  dailyLogs: Record<string, DailyLog>;
  scheduleItems: ScheduleItem[];
  onCompleteHabit: (habitId: string) => void;
  onStartHabitTimer?: (habit: Habit) => void;
  accentColor?: string;
}

interface UpcomingCandidate {
  id: string;
  type: 'habit' | 'schedule';
  title: string;
  emoji: string;
  category: string;
  time: string; // "HH:MM"
  targetMinutes?: number;
  habitRef?: Habit;
  scheduleRef?: ScheduleItem;
  isOverdue: boolean;
}

export default function UpcomingTaskBar({
  habits,
  dailyLogs,
  scheduleItems,
  onCompleteHabit,
  onStartHabitTimer,
  accentColor = 'indigo',
}: UpcomingTaskBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [nowTimeStr, setNowTimeStr] = useState('');
  const [nextCandidate, setNextCandidate] = useState<UpcomingCandidate | null>(null);
  const [totalRemainingToday, setTotalRemainingToday] = useState(0);

  // Update current time every 10 seconds
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      setNowTimeStr(`${hh}:${mm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute upcoming candidate whenever habits, logs, or scheduleItems change
  useEffect(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const dow = now.getDay();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const currentHHMM = `${hh}:${mm}`;

    const candidates: UpcomingCandidate[] = [];
    let remainingCount = 0;

    // 1. Gather Schedule Items for Today
    for (const item of scheduleItems) {
      const isActiveDay = !item.days || item.days.includes(dow);
      if (!isActiveDay) continue;

      // Note: Schedule items are time markers, count as candidate
      candidates.push({
        id: item.id,
        type: 'schedule',
        title: item.title,
        emoji: item.emoji || '📌',
        category: item.category || 'Routine',
        time: item.time,
        scheduleRef: item,
        isOverdue: item.time < currentHHMM,
      });
    }

    // 2. Gather Habits for Today
    for (const h of habits) {
      if (h.isArchived) continue;

      let isScheduledToday = false;
      if (h.isTask) {
        isScheduledToday = h.dueDate === todayStr;
      } else {
        if (h.frequency === 'daily') isScheduledToday = true;
        else if (h.frequency === 'specific') isScheduledToday = h.frequencyDays?.includes(dow) ?? false;
        else isScheduledToday = true;
      }

      if (!isScheduledToday) continue;

      // Check log completion or off for today
      const logId = `${h.id}_${todayStr}`;
      const log = dailyLogs[logId];
      const isDone = (log?.completed || log?.isOffForToday) ?? false;

      if (!isDone) {
        remainingCount++;

        const time = h.alarmTime || '12:00'; // Default midpoint if no specific alarm set
        candidates.push({
          id: h.id,
          type: 'habit',
          title: h.name,
          emoji: h.emoji || '⭐',
          category: h.category || 'General',
          time,
          targetMinutes: h.targetMinutes,
          habitRef: h,
          isOverdue: time < currentHHMM && Boolean(h.alarmTime),
        });
      }
    }

    setTotalRemainingToday(remainingCount);

    if (candidates.length === 0) {
      setNextCandidate(null);
      return;
    }

    // Sort candidates by time
    candidates.sort((a, b) => a.time.localeCompare(b.time));

    // Find the first upcoming candidate whose time >= currentHHMM
    const upcoming = candidates.find((c) => c.time >= currentHHMM);

    if (upcoming) {
      setNextCandidate(upcoming);
    } else {
      // If all times have passed today, pick the first incomplete candidate (overdue)
      setNextCandidate(candidates[0]);
    }
  }, [habits, dailyLogs, scheduleItems, nowTimeStr]);

  // Format time display (12-hour AM/PM)
  const format12Hour = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  // Calculate minutes difference from now
  const getTimeDiffLabel = (timeStr: string) => {
    if (!timeStr) return '';
    const now = new Date();
    const [h, m] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);

    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins === 0) return 'Right now!';
    if (diffMins > 0) {
      if (diffMins < 60) return `in ${diffMins} min${diffMins > 1 ? 's' : ''}`;
      const hours = Math.floor(diffMins / 60);
      const remMins = diffMins % 60;
      return `in ${hours}h ${remMins}m`;
    } else {
      const absMins = Math.abs(diffMins);
      if (absMins < 60) return `${absMins} min${absMins > 1 ? 's' : ''} ago`;
      const hours = Math.floor(absMins / 60);
      return `${hours}h ago`;
    }
  };

  return (
    <div id="upcoming-notification-bar" className="w-full mb-3 px-4 md:px-0">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg shadow-indigo-950/20 overflow-hidden transition-all duration-300">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950/60 border-b border-indigo-500/20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>

            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Upcoming Routine Focus
            </span>

            {totalRemainingToday > 0 && (
              <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                {totalRemainingToday} Left Today
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
            title={isCollapsed ? 'Expand Notification Bar' : 'Collapse Notification Bar'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Bar Content */}
        {!isCollapsed && (
          <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            {nextCandidate ? (
              <>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl shrink-0 shadow-inner">
                    {nextCandidate.emoji}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white truncate max-w-[200px] sm:max-w-[260px]">
                        {nextCandidate.title}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700">
                        {nextCandidate.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-400">
                      <span className="flex items-center gap-1 text-indigo-400">
                        <Clock className="w-3 h-3" /> {format12Hour(nextCandidate.time)}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className={nextCandidate.isOverdue ? 'text-amber-400 font-extrabold' : 'text-emerald-400 font-extrabold'}>
                        {getTimeDiffLabel(nextCandidate.time)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800/80">
                  {nextCandidate.type === 'habit' && nextCandidate.habitRef && (
                    <>
                      {nextCandidate.habitRef.targetMinutes && onStartHabitTimer && (
                        <button
                          type="button"
                          onClick={() => onStartHabitTimer(nextCandidate.habitRef!)}
                          className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow shadow-indigo-600/20 transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> {nextCandidate.habitRef.targetMinutes}m Timer
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onCompleteHabit(nextCandidate.id)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                      </button>
                    </>
                  )}

                  {nextCandidate.type === 'schedule' && (
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                      ⏰ Scheduled Alert
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 py-1">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                <span>All scheduled routines and tasks for today are completed! Fantastic work! 🎉</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
