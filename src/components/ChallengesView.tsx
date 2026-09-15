/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Trophy, CheckCircle, Flame, Calendar, Star, ChevronLeft, Award } from 'lucide-react';
import { DayChallenge } from '../types';
import { playConfetti } from './ConfettiEffect';

interface ChallengesViewProps {
  challenges: DayChallenge[];
  onUpdateChallenge: (challenge: DayChallenge) => void;
}

export default function ChallengesView({
  challenges,
  onUpdateChallenge,
}: ChallengesViewProps) {
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

  const activeChallenge = challenges.find((c) => c.id === selectedChallengeId);

  const calculateChallengeCompletion = (challenge: DayChallenge) => {
    const completedDays = challenge.days.filter((d) => d.completed).length;
    const totalDays = challenge.days.length;
    const rate = Math.round((completedDays / totalDays) * 100);
    return { completedDays, totalDays, rate };
  };

  const handleToggleDay = (challenge: DayChallenge, dayNumber: number) => {
    const dayIndex = dayNumber - 1;
    const isNowCompleted = !challenge.days[dayIndex].completed;

    const updatedDays = challenge.days.map((day) => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          completed: isNowCompleted,
          dateCompleted: isNowCompleted ? new Date().toISOString().split('T')[0] : undefined,
        };
      }
      return day;
    });

    const updatedChallenge: DayChallenge = {
      ...challenge,
      days: updatedDays,
    };

    onUpdateChallenge(updatedChallenge);

    if (isNowCompleted) {
      playConfetti();
      
      // If completing the entire challenge (30th day)
      const allDone = updatedDays.every((d) => d.completed);
      if (allDone) {
        alert(`🎉 INSANE STREAK ARCHITECT! You fully completed the "${challenge.name}" 30-Day Challenge! Congratulations on achieving this milestone!`);
      }
    }
  };

  return (
    <div id="challenges-view-container" className="flex flex-col gap-4">
      {/* If looking at a deep-dive challenge */}
      {activeChallenge ? (
        <div id={`challenge-deep-${activeChallenge.id}`} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4 animate-fadeIn">
          {/* Header */}
          <div className="flex gap-3 items-center justify-between border-b border-slate-850 pb-4">
            <button
              id="back-to-challenges-list"
              type="button"
              onClick={() => setSelectedChallengeId(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-400 hover:text-white text-[10px] font-bold flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Challenges
            </button>
            <span className="text-xl bg-slate-950 p-2 border border-slate-850 rounded-xl select-none">
              {activeChallenge.emoji}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-black text-white">{activeChallenge.name}</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {activeChallenge.description}
            </p>
          </div>

          {/* Progress bar info */}
          {(() => {
            const metrics = calculateChallengeCompletion(activeChallenge);
            return (
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full border-2 border-dashed border-indigo-500 flex items-center justify-center text-xs text-indigo-400 font-extrabold shadow shadow-indigo-500/10">
                  {metrics.rate}%
                </div>
                <div className="flex-1">
                  <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Overall progression</span>
                  <div className="text-xs font-bold text-slate-100 mt-0.5">
                    {metrics.completedDays} of {metrics.totalDays} Days Completed
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850 mt-1.5">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${metrics.rate}%` }} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Core 30 Days Grid cell blocks */}
          <div className="grid grid-cols-5 gap-2.5 my-1">
            {activeChallenge.days.map((day) => {
              const borderAccent = activeChallenge.color || 'indigo';
              return (
                <button
                  id={`challenge-cell-day-${day.dayNumber}`}
                  key={day.dayNumber}
                  type="button"
                  onClick={() => handleToggleDay(activeChallenge, day.dayNumber)}
                  className={`h-14 rounded-2xl border flex flex-col justify-between items-center p-1.5 transition-all outline-none ${
                    day.completed
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-600/30'
                      : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-300'
                  }`}
                  title={`${day.title}`}
                >
                  <span className="text-[9px] uppercase font-black tracking-tighter block leading-none">Day</span>
                  <span className="text-xs font-black block leading-none my-0.5">{day.dayNumber}</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-current" />
                </button>
              );
            })}
          </div>

          {/* Detailed challenge step guideline summary */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col gap-1.5">
            <span className="text-[9px] uppercase font-black text-indigo-400 tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Day Objectives Guidelines
            </span>
            <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
              Tap any numbered box to log completion and build your continuous 30-day streak milestone!
            </p>
          </div>
        </div>
      ) : (
        /* Challenges Overview List */
        <div className="flex flex-col gap-3">
          {challenges.map((chal) => {
            const metrics = calculateChallengeCompletion(chal);
            return (
              <div
                id={`challenge-card-${chal.id}`}
                key={chal.id}
                onClick={() => setSelectedChallengeId(chal.id)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-3xl transition-all cursor-pointer flex justify-between items-center gap-4 h-24"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl h-11 w-11 bg-slate-950 border border-slate-850 flex items-center justify-center rounded-2xl select-none">
                    {chal.emoji}
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-100">{chal.name}</h4>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-tight mt-0.5">
                      Completed: {metrics.completedDays}/{metrics.totalDays} Days ({metrics.rate}%)
                    </span>
                    <div className="h-1.5 w-24 bg-slate-950 rounded-full border border-slate-850 overflow-hidden mt-1.5">
                      <div className="h-full bg-indigo-500" style={{ width: `${metrics.rate}%` }} />
                    </div>
                  </div>
                </div>

                <div className="h-8 w-8 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-850 hover:text-indigo-400 text-slate-500 transition-colors shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
