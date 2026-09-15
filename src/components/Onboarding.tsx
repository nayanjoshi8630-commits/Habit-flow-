/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sparkles, Calendar, Award, CheckCircle2, ChevronRight, Check } from 'lucide-react';
import { COLOR_ACCENTS, HABIT_TEMPLATES, HabitTemplate } from '../utils/dummyData';

interface OnboardingProps {
  initialUserName?: string;
  onComplete: (data: {
    userName: string;
    appAccent: 'emerald' | 'indigo' | 'rose' | 'amber' | 'cyan';
    selectedTemplates: HabitTemplate[];
  }) => void;
}

export default function Onboarding({ initialUserName = '', onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState(initialUserName);
  const [appAccent, setAppAccent] = useState<'emerald' | 'indigo' | 'rose' | 'amber' | 'cyan'>('indigo');
  const [selectedTemplates, setSelectedTemplates] = useState<HabitTemplate[]>([]);

  const handleToggleTemplate = (template: HabitTemplate) => {
    setSelectedTemplates((prev) => {
      const exists = prev.some((t) => t.name === template.name);
      if (exists) {
        return prev.filter((t) => t.name !== template.name);
      } else {
        return [...prev, template];
      }
    });
  };

  const currentAccentConfig = COLOR_ACCENTS.find((a) => a.name === appAccent) || COLOR_ACCENTS[1];

  const handleNext = () => {
    if (step === 1 && !userName.trim()) {
      alert('Please fill out your name to customize your tracker!');
      return;
    }
    if (step < 3) {
      setStep((p) => p + 1);
    } else {
      onComplete({
        userName: userName.trim(),
        appAccent,
        selectedTemplates,
      });
    }
  };

  return (
    <div id="onboarding-main-container" className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col justify-between min-h-[500px]">
        {/* Step Indicator Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? `w-8 bg-indigo-500`
                    : s < step
                      ? 'w-2 bg-indigo-500/40'
                      : 'w-2 bg-slate-800'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
            Step {step} of 3
          </span>
        </div>

        {/* Dynamic Step Body */}
        <div className="flex-1 flex flex-col justify-center py-4">
          {step === 1 && (
            <div id="onboarding-step-1" className="flex flex-col gap-5 animate-fadeIn">
              <div className="flex items-center gap-3">
                <img 
                  src="/icon.svg" 
                  alt="HabitFlow" 
                  className="w-14 h-14 rounded-2xl shadow-lg border border-slate-800 object-cover bg-slate-950 p-0.5" 
                />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight leading-none">
                  Welcome to <span className="text-indigo-400">HabitFlow</span>
                </h1>
                <p className="text-slate-400 text-sm mt-2 font-medium">
                  Let's craft sustainable routines, track visual calendars, and unlock accomplishments together.
                </p>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <label htmlFor="user-name-input" className="text-xs uppercase font-extrabold text-slate-500 tracking-wider">
                  What should we call you?
                </label>
                <input
                  id="user-name-input"
                  type="text"
                  placeholder="Enter your name..."
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-semibold text-slate-200 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div id="onboarding-step-2" className="flex flex-col gap-4 animate-fadeIn">
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Calendar className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Match Your <span className="text-indigo-400">Vibe</span>
                </h1>
                <p className="text-slate-400 text-sm mt-1 font-medium">
                  Choose a favorite accent color. You can change this anytime.
                </p>
              </div>

              <div className="grid grid-cols-5 gap-3 my-4">
                {COLOR_ACCENTS.map((color) => (
                  <button
                    id={`accent-picker-${color.name}`}
                    key={color.name}
                    type="button"
                    onClick={() => setAppAccent(color.name as any)}
                    className={`h-14 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                      appAccent === color.name
                        ? `bg-slate-950 border-${color.name}-500 ring-2 ring-${color.name}-500/30 shadow-lg`
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`h-6 w-6 rounded-full ${color.bg} shadow-md flex items-center justify-center text-white`}>
                      {appAccent === color.name && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] mt-1 font-bold text-slate-500 uppercase tracking-tight">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div id="onboarding-step-3" className="flex flex-col gap-3 animate-fadeIn">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Choose Starter <span className="text-indigo-400">Habits</span>
                </h1>
                <p className="text-slate-400 text-xs font-medium">
                  Select routine templates below to jumpstart your dashboard in one click.
                </p>
              </div>

              <div className="max-h-56 overflow-y-auto pr-1 flex flex-col gap-4 mt-2 scrollbar-thin scrollbar-thumb-slate-800">
                {HABIT_TEMPLATES.map((group) => (
                  <div key={group.group} className="flex flex-col gap-1.5">
                    <h3 className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                      {group.group}
                    </h3>
                    <div className="flex flex-col gap-1">
                      {group.items.map((item) => {
                        const isSelected = selectedTemplates.some((t) => t.name === item.name);
                        return (
                          <button
                            id={`onboarding-template-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                            key={item.name}
                            type="button"
                            onClick={() => handleToggleTemplate(item)}
                            className={`flex items-center justify-between text-left p-2.5 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-indigo-950/20 border-indigo-600/50'
                                : 'bg-slate-950 border-slate-800/80 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg bg-slate-900 h-8 w-8 flex items-center justify-center rounded-lg border border-slate-800">
                                {item.emoji}
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-100">{item.name}</h4>
                                <p className="text-[10px] text-slate-400 line-clamp-1">{item.description}</p>
                              </div>
                            </div>
                            <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-700 text-white'
                                : 'border-slate-700 bg-slate-900'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Button Footer */}
        <div className="flex items-center gap-4 mt-6">
          {step > 1 && (
            <button
              id="onboarding-back-btn"
              type="button"
              onClick={() => setStep((p) => p - 1)}
              className="px-5 py-3.5 bg-slate-950 hover:bg-slate-850 active:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 rounded-xl font-semibold text-sm transition-colors"
            >
              Back
            </button>
          )}
          <button
            id="onboarding-next-btn"
            type="button"
            onClick={handleNext}
            className={`flex-1 flex items-center justify-center gap-1.5 px-6 py-3.5 bg-${currentAccentConfig.name}-500 hover:bg-${currentAccentConfig.name}-600 active:bg-${currentAccentConfig.name}-700 text-white shadow-lg shadow-${currentAccentConfig.name}-500/10 rounded-xl font-bold text-sm transition-colors`}
          >
            {step === 3 ? 'Start HabitFlow' : 'Continue'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
