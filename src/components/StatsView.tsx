/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  LineChart,
  Award,
  Flame,
  CheckSquare,
  Sparkles,
  TrendingUp,
  ChevronRight,
  Activity,
  Zap,
  Calendar,
  Layers,
  PieChart,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Habit, DailyLog } from '../types';
import { COLOR_ACCENTS, BADGES } from '../utils/dummyData';

interface StatsViewProps {
  habits: Habit[];
  dailyLogs: { [logId: string]: DailyLog };
}

interface AIDiagnosis {
  headline: string;
  assessment: string;
  recommendation: string;
  momentumScore: number;
  modelUsed?: string;
}

export default function StatsView({ habits, dailyLogs }: StatsViewProps) {
  // Definitive Section Sub-Tabs: 'overview' | 'deepdive' | 'badges'
  const [activeTab, setActiveTab] = useState<'overview' | 'deepdive' | 'badges'>('overview');

  const [selectedHabitId, setSelectedHabitId] = useState<string>(
    habits.length > 0 ? habits[0].id : ''
  );

  // Deep dive time window: 7 days vs 14 days
  const [deepDiveWindow, setDeepDiveWindow] = useState<7 | 14>(7);

  // AI Behavioral Diagnosis State
  const [aiDiagnosis, setAiDiagnosis] = useState<AIDiagnosis | null>(() => {
    try {
      const saved = localStorage.getItem('habitflow_stats_ai_diagnosis');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Auto-select first habit if none is active
  useEffect(() => {
    if (!selectedHabitId && habits.length > 0) {
      setSelectedHabitId(habits[0].id);
    }
  }, [habits, selectedHabitId]);

  // 1. Core Metric Calculations
  const logsList = Object.values(dailyLogs);
  const totalAllTimeCompletions = logsList.filter((log) => log.completed).length;

  // Streak calculations helper
  const calculateHabitStreaks = (habitId: string) => {
    const completedDates = logsList
      .filter((log) => log.habitId === habitId && log.completed)
      .map((log) => log.date)
      .sort();

    if (completedDates.length === 0) return { current: 0, best: 0 };

    let bestStreak = 0;
    let tempStreak = 0;
    let currentStreak = 0;

    const parseLocalDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const isConsecutiveStr = (dateStrPrev: string, dateStrNext: string) => {
      const prev = parseLocalDate(dateStrPrev);
      const next = parseLocalDate(dateStrNext);
      const diffTime = Math.abs(next.getTime() - prev.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays === 1;
    };

    if (completedDates.length > 0) {
      tempStreak = 1;
      bestStreak = 1;
      for (let i = 1; i < completedDates.length; i++) {
        if (isConsecutiveStr(completedDates[i - 1], completedDates[i])) {
          tempStreak++;
        } else if (completedDates[i - 1] !== completedDates[i]) {
          tempStreak = 1;
        }
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const hasToday = completedDates.includes(todayStr);
    const hasYesterday = completedDates.includes(yesterdayStr);

    if (hasToday || hasYesterday) {
      const reverseCompleted = [...new Set(completedDates)].reverse();
      let lastCheckedDate = hasToday ? todayStr : yesterdayStr;
      currentStreak = 1;

      let currIdx = reverseCompleted.indexOf(lastCheckedDate);
      if (currIdx !== -1) {
        for (let j = currIdx + 1; j < reverseCompleted.length; j++) {
          if (isConsecutiveStr(reverseCompleted[j], reverseCompleted[j - 1])) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    } else {
      currentStreak = 0;
    }

    return { current: currentStreak, best: bestStreak };
  };

  // Global Streaks
  let globalBestStreak = 0;
  let globalCurrentStreak = 0;
  habits.forEach((h) => {
    const { current, best } = calculateHabitStreaks(h.id);
    if (best > globalBestStreak) globalBestStreak = best;
    if (current > globalCurrentStreak) globalCurrentStreak = current;
  });

  // Calculate 7-day weekly rate
  const calculateRecentCompletionsRate = (daysBack = 7) => {
    let scheduledCount = 0;
    let completedCount = 0;

    const today = new Date();
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const dow = d.getDay();

      habits.forEach((h) => {
        if (h.isArchived) return;

        let isActive = false;
        if (h.isTask) {
          isActive = h.dueDate === dStr;
        } else {
          if (h.frequency === 'daily') isActive = true;
          else if (h.frequency === 'specific') isActive = h.frequencyDays?.includes(dow) ?? false;
          else isActive = true;
        }

        if (isActive) {
          scheduledCount++;
          const logId = `${h.id}_${dStr}`;
          if (dailyLogs[logId]?.completed && !dailyLogs[logId]?.isOffForToday) {
            completedCount++;
          }
        }
      });
    }

    return scheduledCount === 0 ? 0 : Math.round((completedCount / scheduledCount) * 100);
  };

  const recentRate = calculateRecentCompletionsRate(7);
  const previousWeekRate = calculateRecentCompletionsRate(14); // comparison baseline

  // Consistency Grade Evaluation
  const getConsistencyGrade = (rate: number, streak: number) => {
    if (rate >= 85 && streak >= 7) return { grade: 'A+', text: 'Peak Flow State', color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' };
    if (rate >= 75) return { grade: 'A', text: 'Solid Discipline', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' };
    if (rate >= 60) return { grade: 'B+', text: 'Building Momentum', color: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10' };
    if (rate >= 40) return { grade: 'B', text: 'Regular Practice', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' };
    return { grade: 'C', text: 'Starting Out', color: 'text-slate-400 border-slate-700 bg-slate-800/40' };
  };

  const currentGrade = getConsistencyGrade(recentRate, globalCurrentStreak);

  // Category Breakdown Metrics
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {};

    habits.forEach((h) => {
      const cat = h.category || 'General';
      if (!stats[cat]) stats[cat] = { total: 0, completed: 0 };
    });

    logsList.forEach((log) => {
      const habit = habits.find((h) => h.id === log.habitId);
      if (habit) {
        const cat = habit.category || 'General';
        if (!stats[cat]) stats[cat] = { total: 0, completed: 0 };
        stats[cat].total++;
        if (log.completed && !log.isOffForToday) {
          stats[cat].completed++;
        }
      }
    });

    return Object.entries(stats).map(([category, data]) => ({
      category,
      total: data.total,
      completed: data.completed,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));
  }, [habits, logsList]);

  // Trigger Gemini AI Behavioral Diagnosis
  const handleFetchAiDiagnosis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const habitsSummary = habits.map((h) => {
        const streaks = calculateHabitStreaks(h.id);
        return {
          name: h.name,
          category: h.category,
          bestStreak: streaks.best,
          currentStreak: streaks.current,
        };
      });

      const res = await fetch('/api/gemini-stats-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habitsSummary,
          totalCompletions: totalAllTimeCompletions,
          weeklyRate: recentRate,
          bestStreak: globalBestStreak,
          currentStreak: globalCurrentStreak,
        }),
      });

      const data = await res.json();
      if (data.headline) {
        setAiDiagnosis(data);
        localStorage.setItem('habitflow_stats_ai_diagnosis', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('AI diagnosis fetch failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Habit Deep Dive metrics
  const selectedHabit = habits.find((h) => h.id === selectedHabitId);
  const selectedStreak = selectedHabit ? calculateHabitStreaks(selectedHabit.id) : { current: 0, best: 0 };

  const getPercentageForHabit = (habitId: string) => {
    const hLogs = logsList.filter((log) => log.habitId === habitId);
    if (hLogs.length === 0) return 0;
    const completedCount = hLogs.filter((log) => log.completed && !log.isOffForToday).length;
    return Math.round((completedCount / hLogs.length) * 100);
  };

  const selectedAvgPercent = selectedHabit ? getPercentageForHabit(selectedHabit.id) : 0;
  const selectedTotalDone = selectedHabit
    ? logsList.filter((l) => l.habitId === selectedHabit.id && l.completed && !l.isOffForToday).length
    : 0;

  // Chart plotting values (7-day or 14-day)
  const getChartData = (daysCount: number) => {
    if (!selectedHabit) return [];
    const list = [];
    const today = new Date();
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const log = dailyLogs[`${selectedHabit.id}_${dStr}`];

      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      let progressVal = 0;
      let isOff = log?.isOffForToday;

      if (log && !isOff) {
        if (selectedHabit.type === 'numeric') {
          const target = selectedHabit.targetValue || 1;
          progressVal = Math.min(100, Math.round(((log.value || 0) / target) * 100));
        } else {
          progressVal = log.completed ? 100 : 0;
        }
      }

      list.push({
        label: dayName,
        dateStr: dStr,
        value: progressVal,
        completed: Boolean(log?.completed && !isOff),
        isOff: Boolean(isOff),
      });
    }
    return list;
  };

  const chartData = getChartData(deepDiveWindow);
  const accentClass = selectedHabit ? (COLOR_ACCENTS.find((a) => a.name === selectedHabit.color) || COLOR_ACCENTS[1]) : COLOR_ACCENTS[1];

  // 14-day heatmap dates for Overview
  const last14Days = React.useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      list.push({
        dateStr: dStr,
        shortLabel: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
        dayNum: d.getDate(),
      });
    }
    return list;
  }, []);

  return (
    <div id="stats-dashboard-view" className="flex flex-col gap-4 px-3 md:px-0 mt-1 mb-10 overflow-x-hidden animate-fadeIn">
      
      {/* 1. Definitive Top Bento KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow flex flex-col justify-between gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">All-Time Done</span>
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">{totalAllTimeCompletions}</span>
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-tight">Completions</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow flex flex-col justify-between gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">7-Day Rate</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white">{recentRate}%</span>
              {recentRate >= 60 ? (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center">
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 flex items-center">
                  <ArrowDownRight className="w-3 h-3" />
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-tight">Success velocity</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow flex flex-col justify-between gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Best Streak</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">{globalBestStreak}d</span>
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-tight">Longest spark</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow flex flex-col justify-between gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Current Spark</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">{globalCurrentStreak}d</span>
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-tight">Active today</span>
          </div>
        </div>
      </div>

      {/* 2. Definitive Segmented View Switcher */}
      <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl gap-1">
        <button
          id="stats-subtab-overview"
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          id="stats-subtab-deepdive"
          type="button"
          onClick={() => setActiveTab('deepdive')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'deepdive'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Habit Deep Dive</span>
        </button>

        <button
          id="stats-subtab-badges"
          type="button"
          onClick={() => setActiveTab('badges')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'badges'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Milestones</span>
        </button>
      </div>

      {/* 3. SUB-VIEW A: OVERVIEW & ACTIVITY */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* Consistency Grade Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Discipline Rating
              </span>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>{currentGrade.text}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Maintaining {recentRate}% completion rate across {habits.filter((h) => !h.isArchived).length} habits
              </p>
            </div>

            <div className={`px-4 py-3 rounded-2xl border text-center shrink-0 ${currentGrade.color}`}>
              <span className="text-2xl font-black block leading-none">{currentGrade.grade}</span>
              <span className="text-[9px] uppercase font-extrabold tracking-wider mt-1 block">Tier</span>
            </div>
          </div>

          {/* Gemini AI Performance Behavioral Diagnosis */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-5 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  Gemini Behavioral Diagnosis
                </h4>
              </div>

              <button
                type="button"
                onClick={handleFetchAiDiagnosis}
                disabled={isAnalyzing}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-200" />
                    <span>{aiDiagnosis ? 'Refresh Diagnosis' : 'Generate Diagnosis'}</span>
                  </>
                )}
              </button>
            </div>

            {aiDiagnosis ? (
              <div className="flex flex-col gap-2.5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300">
                    &ldquo;{aiDiagnosis.headline}&rdquo;
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    Momentum: {aiDiagnosis.momentumScore}/100
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {aiDiagnosis.assessment}
                </p>
                <div className="pt-2 border-t border-slate-850 flex items-start gap-2 text-xs text-indigo-200">
                  <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong>Recommended Focus:</strong> {aiDiagnosis.recommendation}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Tap <strong>Generate Diagnosis</strong> to have Gemini review your recent streaks, completion rate, and behavioral momentum.
              </p>
            )}
          </div>

          {/* 14-Day Activity Heatmap Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>14-Day Habit Activity Matrix</span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold">Past 2 Weeks</span>
            </div>

            {habits.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">No active habits to display</div>
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[340px] flex flex-col gap-2">
                  {/* Date labels row */}
                  <div className="grid grid-cols-[100px_repeat(14,1fr)] items-center text-[9px] font-bold text-slate-400 pb-1 border-b border-slate-800">
                    <span className="truncate">Habit</span>
                    {last14Days.map((d, idx) => (
                      <span key={idx} className="text-center font-mono" title={d.dateStr}>
                        {d.shortLabel}
                      </span>
                    ))}
                  </div>

                  {/* Habit rows */}
                  {habits.filter((h) => !h.isArchived).slice(0, 6).map((habit) => (
                    <div key={habit.id} className="grid grid-cols-[100px_repeat(14,1fr)] items-center gap-1 py-1">
                      <div className="flex items-center gap-1.5 truncate pr-1">
                        <span className="text-xs">{habit.emoji}</span>
                        <span className="text-[11px] font-bold text-slate-300 truncate">{habit.name}</span>
                      </div>

                      {last14Days.map((d, dIdx) => {
                        const log = dailyLogs[`${habit.id}_${d.dateStr}`];
                        const isDone = log?.completed && !log?.isOffForToday;
                        const isOff = log?.isOffForToday;

                        return (
                          <div
                            key={dIdx}
                            title={`${habit.name} on ${d.dateStr}: ${isOff ? 'Off for today' : isDone ? 'Done' : 'Not completed'}`}
                            className={`h-5 rounded-md flex items-center justify-center text-[8px] transition-all ${
                              isOff
                                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                                : isDone
                                ? 'bg-emerald-500/80 border border-emerald-400 text-white font-black'
                                : 'bg-slate-950 border border-slate-850 text-slate-700'
                            }`}
                          >
                            {isOff ? '💤' : isDone ? '✓' : ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          {categoryStats.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                <span>Completions by Category</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categoryStats.map((cat, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/70 border border-slate-850 rounded-2xl flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-200">{cat.category}</span>
                      <span className="text-indigo-400 font-mono">{cat.completed} done ({cat.rate}%)</span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, cat.rate))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SUB-VIEW B: HABIT DEEP DIVE */}
      {activeTab === 'deepdive' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Individual Habit Inspection
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Examine specific consistency velocity and 7-day or 14-day trends
              </p>
            </div>

            {/* Time Window Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDeepDiveWindow(7)}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                  deepDiveWindow === 7 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDeepDiveWindow(14)}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                  deepDiveWindow === 14 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                14 Days
              </button>
            </div>
          </div>

          {habits.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              Set up active habits to review individual deep-dive metrics!
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Habit Picker Selector */}
              <div className="flex flex-col gap-1.5 bg-slate-950 p-3.5 rounded-2xl border border-slate-850">
                <label htmlFor="deepview-habit-selector" className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">
                  Select Habit to Analyze:
                </label>
                <select
                  id="deepview-habit-selector"
                  value={selectedHabitId}
                  onChange={(e) => setSelectedHabitId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
                >
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.emoji} {h.name} ({h.category})
                    </option>
                  ))}
                </select>
              </div>

              {selectedHabit && (
                <div id="habit-deepview-details" className="flex flex-col gap-4">
                  {/* Visual Stats Mini Board */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 bg-slate-950 rounded-2xl text-center border border-slate-850">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Longest Spark</span>
                      <span className="text-lg font-black text-white block mt-1">🔥 {selectedStreak.best}d</span>
                      <span className="text-[8px] text-slate-500 font-bold block uppercase mt-0.5">Consecutive</span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-2xl text-center border border-slate-850">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Consistency</span>
                      <span className="text-lg font-black text-white block mt-1">📈 {selectedAvgPercent}%</span>
                      <span className="text-[8px] text-slate-500 font-bold block uppercase mt-0.5">All-time</span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-2xl text-center border border-slate-850">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Completed</span>
                      <span className="text-lg font-black text-white block mt-1">✨ {selectedTotalDone}</span>
                      <span className="text-[8px] text-slate-500 font-bold block uppercase mt-0.5">Sessions</span>
                    </div>
                  </div>

                  {/* SVG Line / Progression Chart */}
                  <div className="flex flex-col gap-2.5 bg-slate-950 rounded-3xl p-4 border border-slate-850">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-extrabold text-slate-300 tracking-wider block">
                        {deepDiveWindow}-Day Progression Velocity (%)
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {chartData.filter((d) => d.completed).length}/{deepDiveWindow} Days Done
                      </span>
                    </div>

                    <div className="relative h-44 w-full mt-2 flex items-end">
                      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />
                        <line x1="0" y1="80" x2="100" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2" />

                        {/* Area gradient fill */}
                        <polygon
                          points={`
                            -5,100
                            ${chartData.map((d, idx) => `${(idx / (chartData.length - 1)) * 100},${100 - d.value * 0.8}`).join(' ')}
                            105,100
                          `}
                          fill={`url(#area-gradient-stats)`}
                          opacity="0.25"
                        />

                        {/* Line path */}
                        <path
                          d={chartData.map((d, idx) => {
                            const x = (idx / (chartData.length - 1)) * 100;
                            const y = 100 - d.value * 0.8;
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Dot markers */}
                        {chartData.map((d, idx) => {
                          const x = (idx / (chartData.length - 1)) * 100;
                          const y = 100 - d.value * 0.8;
                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r="3.5"
                              fill={d.completed ? '#10b981' : d.isOff ? '#f59e0b' : '#334155'}
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                          );
                        })}

                        <defs>
                          <linearGradient id="area-gradient-stats" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>

                    {/* Horizontal Labels */}
                    <div className="flex justify-between text-[9px] uppercase font-bold text-slate-500 px-1 mt-1">
                      {chartData.map((d, idx) => (
                        <span key={idx} className="text-center font-mono select-none" style={{ width: `${100 / chartData.length}%` }}>
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. SUB-VIEW C: MILESTONE BADGES */}
      {activeTab === 'badges' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Milestone Trophy Cabinet
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Track exact progress towards achievement badges. Complete daily routines to unlock gold tiers.
              </p>
            </div>

            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black">
              🏆 Gamification
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {BADGES.map((badge) => {
              let isBadgeUnlocked = false;
              let currentProgress = 0;
              let targetGoal = 1;

              switch (badge.id) {
                case 'first_step':
                  isBadgeUnlocked = totalAllTimeCompletions >= 1;
                  currentProgress = Math.min(1, totalAllTimeCompletions);
                  targetGoal = 1;
                  break;
                case 'streak_7':
                  isBadgeUnlocked = globalBestStreak >= 7;
                  currentProgress = Math.min(7, globalBestStreak);
                  targetGoal = 7;
                  break;
                case 'streak_30':
                  isBadgeUnlocked = globalBestStreak >= 30;
                  currentProgress = Math.min(30, globalBestStreak);
                  targetGoal = 30;
                  break;
                case 'completions_50':
                  isBadgeUnlocked = totalAllTimeCompletions >= 50;
                  currentProgress = Math.min(50, totalAllTimeCompletions);
                  targetGoal = 50;
                  break;
                case 'completions_100':
                  isBadgeUnlocked = totalAllTimeCompletions >= 100;
                  currentProgress = Math.min(100, totalAllTimeCompletions);
                  targetGoal = 100;
                  break;
                case 'completions_200':
                  isBadgeUnlocked = totalAllTimeCompletions >= 200;
                  currentProgress = Math.min(200, totalAllTimeCompletions);
                  targetGoal = 200;
                  break;
                case 'perfectionist':
                  isBadgeUnlocked = globalBestStreak >= 3;
                  currentProgress = Math.min(3, globalBestStreak);
                  targetGoal = 3;
                  break;
                case 'architect':
                  const activeCount = habits.filter((h) => !h.isArchived).length;
                  isBadgeUnlocked = activeCount >= 5;
                  currentProgress = Math.min(5, activeCount);
                  targetGoal = 5;
                  break;
                default:
                  break;
              }

              const progressPercent = Math.round((currentProgress / targetGoal) * 100);

              return (
                <div
                  id={`badge-card-${badge.id}`}
                  key={badge.id}
                  className={`flex flex-col p-4 rounded-2xl border transition-all ${
                    isBadgeUnlocked
                      ? 'bg-amber-950/25 border-amber-600/40 text-amber-200 shadow-md shadow-amber-500/5'
                      : 'bg-slate-950/60 border-slate-900 text-slate-400'
                  }`}
                >
                  <div className="flex gap-3 items-center">
                    <span className="text-3xl bg-slate-900 border border-slate-800 p-2.5 rounded-2xl select-none shrink-0 shadow-inner">
                      {badge.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-black truncate ${isBadgeUnlocked ? 'text-amber-400' : 'text-slate-300'}`}>
                          {badge.title} {isBadgeUnlocked && '👑'}
                        </h4>
                        {isBadgeUnlocked && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase">
                            Unlocked
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{badge.description}</p>
                    </div>
                  </div>

                  {/* Progress Bar towards Milestone */}
                  <div className="mt-3 pt-2.5 border-t border-slate-850/60 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-400">
                      <span>Requirement: {badge.requirementText}</span>
                      <span className={isBadgeUnlocked ? 'text-amber-400' : 'text-slate-400'}>
                        {currentProgress} / {targetGoal} ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-850">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isBadgeUnlocked ? 'bg-amber-400' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
