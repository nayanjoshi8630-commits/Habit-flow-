/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Clock, Sun, Moon, Sunrise, Sunset, Sparkles, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface TimePickerModalProps {
  initialTime: string; // "HH:MM" in 24h format, e.g., "08:00" or "14:30"
  onSelectTime: (time24: string) => void;
  onClose: () => void;
}

const ROUTINE_PRESETS = [
  { label: 'Early Rise', time: '06:00', icon: '🌅' },
  { label: 'Morning', time: '08:00', icon: '☀️' },
  { label: 'Midday', time: '12:00', icon: '🌤️' },
  { label: 'Afternoon', time: '15:00', icon: '☕' },
  { label: 'Evening', time: '18:00', icon: '🌆' },
  { label: 'Night Routine', time: '21:30', icon: '🌙' },
];

export default function TimePickerModal({
  initialTime,
  onSelectTime,
  onClose,
}: TimePickerModalProps) {
  // Parse initial 24h time into 12h representation
  const parseTime = (time24: string) => {
    let [h, m] = (time24 || '08:00').split(':').map((num) => parseInt(num, 10));
    if (isNaN(h)) h = 8;
    if (isNaN(m)) m = 0;

    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;

    return {
      hours12: h12,
      minutes: m,
      period: period as 'AM' | 'PM',
    };
  };

  const parsed = parseTime(initialTime);
  const [hours12, setHours12] = useState<number>(parsed.hours12);
  const [minutes, setMinutes] = useState<number>(parsed.minutes);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);

  const triggerHaptic = () => {
    try {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } catch (e) {}
  };

  // Convert current 12h state back to "HH:MM" 24h string
  const get24HourString = (h12: number, min: number, ampm: 'AM' | 'PM') => {
    let h24 = h12 % 12;
    if (ampm === 'PM') h24 += 12;
    const hStr = h24.toString().padStart(2, '0');
    const mStr = min.toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
  };

  const handleAdjustMinutes = (delta: number) => {
    triggerHaptic();
    let newMin = minutes + delta;
    let newHour = hours12;
    let newPeriod = period;

    if (newMin >= 60) {
      newMin -= 60;
      newHour += 1;
      if (newHour > 12) {
        newHour = 1;
      }
      if (hours12 === 11) {
        newPeriod = period === 'AM' ? 'PM' : 'AM';
      }
    } else if (newMin < 0) {
      newMin += 60;
      newHour -= 1;
      if (newHour < 1) {
        newHour = 12;
      }
      if (hours12 === 12) {
        newPeriod = period === 'AM' ? 'PM' : 'AM';
      }
    }

    setMinutes(newMin);
    setHours12(newHour);
    setPeriod(newPeriod);
  };

  const handleAdjustHours = (delta: number) => {
    triggerHaptic();
    let newHour = hours12 + delta;
    if (newHour > 12) newHour = 1;
    if (newHour < 1) newHour = 12;
    setHours12(newHour);
  };

  const handlePresetSelect = (presetTime24: string) => {
    triggerHaptic();
    const p = parseTime(presetTime24);
    setHours12(p.hours12);
    setMinutes(p.minutes);
    setPeriod(p.period);
  };

  const handleConfirm = () => {
    try {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } catch (e) {}

    const time24 = get24HourString(hours12, minutes, period);
    onSelectTime(time24);
    onClose();
  };

  const formattedDisplayHour = hours12.toString().padStart(2, '0');
  const formattedDisplayMin = minutes.toString().padStart(2, '0');

  return (
    <div id="time-picker-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                Set Alarm Clock <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                Adjust hour, minute, and period
              </p>
            </div>
          </div>

          <button
            id="close-time-picker-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Clock Face Card */}
        <div className="p-5 flex flex-col gap-5 items-center">
          
          {/* Neon Digital Clock Display */}
          <div className="w-full bg-slate-950 border border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />

            {/* Glowing Clock Digits */}
            <div className="flex items-center justify-center gap-2 font-mono text-4xl sm:text-5xl font-black text-white tracking-wider">
              
              {/* Hours Control Block */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleAdjustHours(1)}
                  className="p-1 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <span className="text-white drop-shadow-[0_0_12px_rgba(99,102,241,0.5)] select-none">
                  {formattedDisplayHour}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustHours(-1)}
                  className="p-1 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              <span className="text-indigo-400 animate-pulse pb-1 select-none">:</span>

              {/* Minutes Control Block */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleAdjustMinutes(5)}
                  className="p-1 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <span className="text-white drop-shadow-[0_0_12px_rgba(99,102,241,0.5)] select-none">
                  {formattedDisplayMin}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustMinutes(-5)}
                  className="p-1 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* AM / PM Toggle Pill */}
              <div className="flex flex-col gap-1.5 ml-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setPeriod('AM');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    period === 'AM'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md scale-105'
                      : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setPeriod('PM');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    period === 'PM'
                      ? 'bg-indigo-600 text-white font-black shadow-md scale-105'
                      : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Quick Time Stepper Pills */}
            <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-850/80 w-full justify-center">
              <button
                type="button"
                onClick={() => handleAdjustMinutes(-15)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
              >
                -15m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(-5)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
              >
                -5m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(5)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(15)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
              >
                +15m
              </button>
            </div>
          </div>

          {/* Routine Quick Presets */}
          <div className="w-full flex flex-col gap-2">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
              Routine Quick Presets
            </span>
            <div className="grid grid-cols-3 gap-2">
              {ROUTINE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetSelect(preset.time)}
                  className="p-2.5 bg-slate-950 hover:bg-indigo-950/40 border border-slate-850 hover:border-indigo-500/40 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer group"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">{preset.icon}</span>
                  <span className="text-[10px] font-extrabold text-white">{preset.label}</span>
                  <span className="text-[9px] font-bold text-slate-500">{preset.time}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Set Clock Time
          </button>
        </div>

      </div>
    </div>
  );
}

/**
 * Utility helper to convert 24h string ("14:30") to formatted 12h display ("02:30 PM")
 */
export function formatTime12h(time24: string): string {
  if (!time24) return '08:00 AM';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) h = 8;
  const period = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const formattedMin = isNaN(m) ? '00' : m.toString().padStart(2, '0');
  const formattedHour = h12.toString().padStart(2, '0');
  return `${formattedHour}:${formattedMin} ${period}`;
}
