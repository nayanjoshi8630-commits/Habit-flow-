/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Habit, DayChallenge, Badge, AppSettings, UserStats } from '../types';

export const DEFAULT_CATEGORIES = [
  'Health',
  'Mind',
  'Work',
  'Personal',
  'Fitness',
  'Finance',
];

export const CATEGORY_COLORS: { [key: string]: string } = {
  Health: 'emerald',
  Mind: 'indigo',
  Work: 'amber',
  Personal: 'rose',
  Fitness: 'cyan',
  Finance: 'violet',
};

export const COLOR_ACCENTS = [
  { name: 'emerald', bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-500', label: 'Emerald' },
  { name: 'indigo', bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500', ring: 'ring-indigo-500', label: 'Indigo' },
  { name: 'rose', bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500', ring: 'ring-rose-500', label: 'Rose' },
  { name: 'amber', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', ring: 'ring-amber-500', label: 'Amber' },
  { name: 'cyan', bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500', ring: 'ring-cyan-500', label: 'Cyan' },
];

export const PRESET_EMOJIS = [
  '🧘', '💧', '🏃', '🏋️', '🚭', '🥛', '📓', '🌬️', '📚', '🍏', 
  '🥗', '🚴', '🏊', '🚶', '🤸', '🛌', '⏰', '🧼', '🧹', '🍵', 
  '🎨', '🎸', '🗣️', '💼', '📊', '💡', '💰', '🔑', '❤️', '🌳', 
  '☀️', '📱', '🔋', '✈️', '🎮', '🧩', '🧁', '🍿', '🥤', '🧼'
];

export const COMPLETED_SOUNDS = [
  'https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav', // high level chime
  'https://assets.mixkit.co/active_storage/sfx/2017/2017-84.wav', // level up sound
];

export const BAD_COMPLETED_SOUNDS = [
  'https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav'
];

export const BADGES: Badge[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first habit activity!',
    icon: '🎯',
    category: 'completions',
    requirementText: 'Complete 1 habit task',
  },
  {
    id: 'streak_7',
    title: 'Week of Fire',
    description: 'Maintain a 7-day streak on any habit!',
    icon: '🔥',
    category: 'streaks',
    requirementText: 'Any habit streak ≥ 7',
  },
  {
    id: 'streak_30',
    title: 'Unstoppable Habit',
    description: 'Keep a streak alive for 30 consecutive days!',
    icon: '👑',
    category: 'streaks',
    requirementText: 'Any habit streak ≥ 30',
  },
  {
    id: 'completions_50',
    title: 'Half Century',
    description: 'Complete 50 days of habits in total!',
    icon: '⭐',
    category: 'completions',
    requirementText: 'Total completions ≥ 50',
  },
  {
    id: 'completions_200',
    title: 'Habit Master',
    description: 'Complete 200 days of habits! You are on autopilot!',
    icon: '🚀',
    category: 'completions',
    requirementText: 'Total completions ≥ 200',
  },
  {
    id: 'completions_100',
    title: 'Centurion',
    description: 'Achieve 100 total habit completions across all routines.',
    icon: '🏆',
    category: 'completions',
    requirementText: 'Total completions ≥ 100',
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Complete all scheduled habits and tasks for today.',
    icon: '🎖️',
    category: 'special',
    requirementText: 'All today\'s habits completed (min 2 items)',
  },
  {
    id: 'architect',
    title: 'Habit Architect',
    description: 'Have at least 5 active habits in your routine.',
    icon: '🏗️',
    category: 'habits',
    requirementText: 'Manage 5+ active habits',
  },
];

export interface HabitTemplate {
  name: string;
  description: string;
  type: 'simple' | 'numeric' | 'timer';
  emoji: string;
  color: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'specific';
  targetFrequencyDays?: number;
  frequencyDays?: number[];
  targetValue?: number;
  unit?: string;
  targetMinutes?: number;
  subtaskNames: string[];
}

export const HABIT_TEMPLATES: { group: string; items: HabitTemplate[] }[] = [
  {
    group: 'Morning Routine',
    items: [
      {
        name: 'Make the Bed',
        description: 'Set up your day for order and success.',
        type: 'simple',
        emoji: '🛏️',
        color: 'indigo',
        category: 'Personal',
        frequency: 'daily',
        subtaskNames: ['Fluff pillows', 'Spread the sheet', 'Fold the blanket'],
      },
      {
        name: 'Morning Meditate',
        description: 'Centered and grounded starting routine.',
        type: 'timer',
        emoji: '🧘',
        color: 'indigo',
        category: 'Mind',
        frequency: 'daily',
        targetMinutes: 10,
        subtaskNames: ['Sit tall', 'Focus on 10 deep breaths', 'Set dynamic intent'],
      },
      {
        name: 'Gratitude Journal',
        description: 'List three positives.',
        type: 'simple',
        emoji: '📓',
        color: 'amber',
        category: 'Mind',
        frequency: 'daily',
        subtaskNames: ['Write thing 1', 'Write thing 2', 'Write thing 3'],
      }
    ],
  },
  {
    group: 'Fitness & Health',
    items: [
      {
        name: 'Water Intake',
        description: 'Stay active and properly hydrated.',
        type: 'numeric',
        emoji: '💧',
        color: 'cyan',
        category: 'Health',
        frequency: 'daily',
        targetValue: 8,
        unit: 'glasses',
        subtaskNames: ['Morning cup', 'Before lunch cup', 'Afternoon recharge', 'Dinner drink', 'Bedtime hydration'],
      },
      {
        name: 'Daily Run',
        description: 'Build cardio and stamina.',
        type: 'timer',
        emoji: '🏃',
        color: 'rose',
        category: 'Fitness',
        frequency: 'specific',
        frequencyDays: [1, 3, 5], // Mon, Wed, Fri
        targetMinutes: 30,
        subtaskNames: ['Stretching', '30 min jog', 'Cool down walk'],
      },
      {
        name: 'Quick Strengths',
        description: 'Short workout to stimulate muscle building.',
        type: 'simple',
        emoji: '🏋️',
        color: 'rose',
        category: 'Fitness',
        frequency: 'weekly',
        targetFrequencyDays: 3,
        subtaskNames: ['Pushups x30', 'Squats x30', 'Plank 2 minutes'],
      }
    ],
  },
  {
    group: 'Productivity & Mind',
    items: [
      {
        name: 'Deep Reading',
        description: 'Expand your mind with chapters.',
        type: 'numeric',
        emoji: '📚',
        color: 'amber',
        category: 'Work',
        frequency: 'daily',
        targetValue: 20,
        unit: 'pages',
        subtaskNames: ['Find a quiet spot', 'Set distraction free', 'Bookmark notes'],
      },
      {
        name: 'Focus Session',
        description: 'High momentum work blocks.',
        type: 'timer',
        emoji: '💡',
        color: 'violet',
        category: 'Work',
        frequency: 'daily',
        targetMinutes: 45,
        subtaskNames: ['Close social tabs', 'Enable do-not-disturb', 'Draft goals'],
      }
    ]
  },
  {
    group: 'Quit bad habits',
    items: [
      {
        name: 'No Junk Food',
        description: 'Choose clean proteins, carbs, and fats.',
        type: 'simple',
        emoji: '🥗',
        color: 'emerald',
        category: 'Health',
        frequency: 'daily',
        subtaskNames: ['No oily fast food today', 'Eat balanced home meal'],
      },
      {
        name: 'Limit Phone Screen',
        description: 'Stay present in the real world.',
        type: 'timer',
        emoji: '📱',
        color: 'rose',
        category: 'Personal',
        frequency: 'daily',
        targetMinutes: 60, // Maximum allowable screen time
        subtaskNames: ['Mute unimportant notifications', 'Screen-free during meals'],
      }
    ]
  }
];

export const PRESET_CHALLENGES: DayChallenge[] = [
  {
    id: 'sleep_well_30',
    name: '30-Day Sleep Well Mastery',
    description: 'Transform your energy levels, focus, and brain recovery. Track 30 days of consistent sleep habits.',
    category: 'Health',
    emoji: '🛌',
    color: 'indigo',
    days: Array.from({ length: 30 }, (_, idx) => ({
      dayNumber: idx + 1,
      title: idx % 3 === 0 
        ? 'No screen 30m before bed' 
        : idx % 3 === 1 
          ? 'Deep slow breathing in bed' 
          : 'Read a book chapter instead of scrolling',
      completed: false,
    })),
  },
  {
    id: 'hydration_30',
    name: '30-Day Pure Hydration',
    description: 'Flush out toxins, clear your skin, and maximize your focus by consistently hydrating every day.',
    category: 'Health',
    emoji: '💧',
    color: 'cyan',
    days: Array.from({ length: 30 }, (_, idx) => ({
      dayNumber: idx + 1,
      title: 'Drank at least 2.5 Liters of water today',
      completed: false,
    })),
  },
  {
    id: 'mindful_coding_30',
    name: '30-Day Daily Code Sculptor',
    description: 'Engage your logical brain daily. Read or write code for 30 consecutive days to build muscle memory.',
    category: 'Work',
    emoji: '💻',
    color: 'rose',
    days: Array.from({ length: 30 }, (_, idx) => ({
      dayNumber: idx + 1,
      title: idx % 4 === 0 
        ? 'Write 50 lines of clean code' 
        : idx % 4 === 1 
          ? 'Optimize existing codebase functions' 
          : idx % 4 === 2 
            ? 'Read documentation on a new library' 
            : 'Solve a core programming logic puzzle',
      completed: false,
    })),
  }
];

export const INITIAL_USER_STATS: UserStats = {
  userName: '',
  onboardingCompleted: false,
  customCategories: [...DEFAULT_CATEGORIES],
  unlockedBadges: [],
};

export const INITIAL_SETTINGS: AppSettings = {
  appAccent: 'indigo',
  theme: 'dark', // Warm modern default dark mode
  muteSounds: false,
  weekStartMonday: true,
  requireAllSubtasksComplete: false,
};
