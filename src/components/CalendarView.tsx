/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, HelpCircle, Activity, LayoutGrid } from 'lucide-react';
import { Habit, DailyLog } from '../types';

interface CalendarViewProps {
  habits: Habit[];
  dailyLogs: { [logId: string]: DailyLog };
  activeDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  weekStartMonday: boolean;
}

export default function CalendarView({
  habits,
  dailyLogs,
  activeDate,
  onSelectDate,
  weekStartMonday,
}: CalendarViewProps) {
  const [currentNavDate, setCurrentNavDate] = useState<Date>(new Date(activeDate + 'T00:00:00'));

  // Get total completion metrics for a specific date
  const getDateStats = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();

    // Find what was active
    const activeOnDay = habits.filter((h) => {
      if (h.isArchived) return false;
      const createdDateString = h.createdAt.split('T')[0];
      if (dateStr < createdDateString) return false; // Not created yet

      if (h.isTask) {
        return h.dueDate === dateStr;
      }

      if (h.frequency === 'daily') return true;
      if (h.frequency === 'specific') {
        return h.frequencyDays?.includes(dow) ?? false;
      }
      return true; // weekly habits are active every day
    });

    if (activeOnDay.length === 0) return { total: 0, completed: 0, percentage: 0 };

    let completed = 0;
    activeOnDay.forEach((h) => {
      const logId = `${h.id}_${dateStr}`;
      const log = dailyLogs[logId];
      if (log && log.completed) {
        completed++;
      }
    });

    return {
      total: activeOnDay.length,
      completed,
      percentage: Math.round((completed / activeOnDay.length) * 100),
    };
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentNavDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentNavDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  // Generate calendar dates
  const year = currentNavDate.getFullYear();
  const month = currentNavDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  // Adjust starting day of the week based on setting (Monday vs Sunday start)
  let startDayOffset = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
  if (weekStartMonday) {
    startDayOffset = startDayOffset === 0 ? 6 : startDayOffset - 1;
  }

  const daysGrid: (string | null)[] = [];
  // Empty slots for start offset
  for (let s = 0; s < startDayOffset; s++) {
    daysGrid.push(null);
  }
  // Fill actual dates
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    daysGrid.push(dStr);
  }

  // HEATMAP Generation: Last 180 days list split in weeks
  const getPastDateStrings = (numDays: number): string[] => {
    const list: string[] = [];
    const today = new Date();
    for (let i = numDays - 1; i >= 0; i--) {
      const temp = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const yStr = temp.getFullYear();
      const mStr = (temp.getMonth() + 1).toString().padStart(2, '0');
      const dStr = temp.getDate().toString().padStart(2, '0');
      list.push(`${yStr}-${mStr}-${dStr}`);
    }
    return list;
  };

  const heatmapDays = getPastDateStrings(140); // 20 weeks width (perfect for mobile & cards!)

  // Color mapper helper for heatmap values
  const getHeatmapBg = (percentage: number, total: number) => {
    if (total === 0) return 'bg-slate-900 border-slate-950';
    if (percentage === 0) return 'bg-slate-850 border-slate-900 hover:bg-slate-800';
    if (percentage <= 25) return 'bg-indigo-900/40 border-indigo-900/30 text-indigo-400 hover:bg-indigo-900/60';
    if (percentage <= 50) return 'bg-indigo-800/70 border-indigo-800/50 text-indigo-300 hover:bg-indigo-800/90';
    if (percentage <= 75) return 'bg-indigo-600/90 border-indigo-600/60 text-indigo-200 hover:bg-indigo-600';
    return 'bg-indigo-500 border-indigo-400 text-white shadow-sm shadow-indigo-500/20';
  };

  const dayLabels = weekStartMonday 
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] 
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div id="calendar-view-main" className="flex flex-col gap-5 px-4 md:px-0 mt-2 mb-10 overflow-x-hidden">
      
      {/* Overview Block */}
      <div className="flex gap-4 items-center bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-lg">
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-100">Daily Completion Index</h2>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
            Select any calendar date to log details or fill in backlog tasks!
          </p>
        </div>
      </div>

      {/* Monthly Calendar layout container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-lg p-5 flex flex-col gap-4">
        
        {/* Month Selector header */}
        <div className="flex justify-between items-center bg-slate-950 p-2 rounded-2xl border border-slate-850">
          <button
            id="cal-prev-month"
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-400 transition-all border border-slate-850"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <h3 className="text-xs uppercase font-extrabold text-slate-100 tracking-widest bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-850">
            {monthNames[month]} {year}
          </h3>

          <button
            id="cal-next-month"
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-400 transition-all border border-slate-850"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Days labels */}
        <div className="grid grid-cols-7 gap-2.5 text-center px-1">
          {dayLabels.map((lbl, idx) => (
            <span key={idx} className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
              {lbl}
            </span>
          ))}
        </div>

        {/* Calendar core grid cells */}
        <div className="grid grid-cols-7 gap-2">
          {daysGrid.map((dStr, idx) => {
            if (!dStr) {
              return <div key={`empty-${idx}`} className="h-10 rounded-xl bg-slate-950/20" />;
            }

            const stats = getDateStats(dStr);
            const isToday = dStr === new Date().toISOString().split('T')[0];
            const isCellSelected = dStr === activeDate;

            // Highlight backgrounds based on completion
            let bgClass = 'bg-slate-950 border border-slate-850 hover:border-slate-700 hover:bg-slate-850';
            let textClass = 'text-slate-400';

            if (stats.total > 0) {
              if (stats.percentage === 100) {
                bgClass = 'bg-emerald-600 border border-emerald-500 shadow shadow-emerald-600/30';
                textClass = 'text-white font-bold';
              } else if (stats.percentage > 0) {
                bgClass = 'bg-indigo-950/80 border border-indigo-600/50';
                textClass = 'text-slate-100 font-bold';
              }
            }

            if (isCellSelected) {
              bgClass += ' ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-500';
            }

            const dayNumber = dStr.split('-')[2];

            return (
              <button
                id={`calendar-cell-${dStr}`}
                key={dStr}
                type="button"
                onClick={() => onSelectDate(dStr)}
                className={`h-11 rounded-2xl flex flex-col justify-between items-center p-1 cursor-pointer select-none transition-all ${bgClass}`}
              >
                <div className="flex justify-between items-center w-full px-1">
                  <span className={`text-[10px] ${textClass}`}>{Number(dayNumber)}</span>
                  {isToday && (
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" title="Today" />
                  )}
                </div>

                {/* completion index bar/dot */}
                {stats.total > 0 ? (
                  <div className="w-full px-1 mb-0.5">
                    <div className="h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-950/40">
                      <div 
                        className={`h-full ${stats.percentage === 100 ? 'bg-white' : 'bg-indigo-400'}`} 
                        style={{ width: `${stats.percentage}%` }} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-1 w-1 bg-slate-700 rounded-full mb-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex justify-between items-center px-1 pt-3 border-t border-slate-850 mt-1 max-w-full overflow-x-auto gap-2">
          <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Metrics Helper:</span>
          <div className="flex gap-2.5 items-center text-[9px] font-bold text-slate-400 shrink-0">
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-slate-950 border border-slate-850" /> 0% Done</span>
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-indigo-950/80 border border-indigo-600/50" /> Logged</span>
            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-emerald-600 border border-emerald-500" /> Perfect Day</span>
          </div>
        </div>
      </div>

      {/* GitHub Heatmap Grid scroll box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-3.5">
        <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-indigo-400 animate-pulse" /> 140-Day Performance Grid
        </h3>
        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
          Striving for momentum. Shaded cells correspond to days completed with custom routines. Hover or tap to load historical logs!
        </p>

        {/* Scrollable grid strip */}
        <div className="overflow-x-auto pb-1 max-w-full scrollbar-thin scrollbar-thumb-slate-800 rounded-xl bg-slate-950 p-3.5 border border-slate-850">
          <div className="grid grid-flow-col grid-rows-7 gap-1.5 w-max">
            {heatmapDays.map((dStr) => {
              const stats = getDateStats(dStr);
              const isToday = dStr === new Date().toISOString().split('T')[0];
              const isCellSelected = dStr === activeDate;
              const dateMeta = new Date(dStr + 'T00:00:00');
              const formattedTip = `${dateMeta.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${stats.completed}/${stats.total} habits completed`;

              // Heat map coloring shade levels
              const styleBg = getHeatmapBg(stats.percentage, stats.total);

              return (
                <button
                  id={`heatmap-cell-${dStr}`}
                  key={dStr}
                  type="button"
                  onClick={() => onSelectDate(dStr)}
                  title={formattedTip}
                  className={`h-4.5 w-4.5 rounded-md border text-[8px] flex items-center justify-center transition-all cursor-pointer ${styleBg} ${
                    isCellSelected ? 'ring-1 ring-white scale-110 shadow-lg' : ''
                  }`}
                >
                  {isToday && <div className="h-1 w-1 rounded-full bg-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend block */}
        <div className="flex gap-2 justify-end items-center text-[9.5px] text-slate-500 font-bold px-1.5 pt-1.5">
          <span>Less Done</span>
          <div className="h-3 w-3 rounded-md bg-slate-850 border border-slate-900" />
          <div className="h-3 w-3 rounded-md bg-indigo-900/45 border border-indigo-900/30" />
          <div className="h-3 w-3 rounded-md bg-indigo-800/70 border border-indigo-800/50" />
          <div className="h-3 w-3 rounded-md bg-indigo-600/90 border border-indigo-600/60" />
          <div className="h-3 w-3 rounded-md bg-indigo-500 border border-indigo-400" />
          <span>More Perfect</span>
        </div>
      </div>
    </div>
  );
}
