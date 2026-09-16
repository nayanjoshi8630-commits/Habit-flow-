/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, 
  Calendar, 
  TrendingUp, 
  Sliders, 
  Sparkles, 
  Clock, 
  X, 
  Bell, 
  Tv, 
  User as UserIcon, 
  ShieldAlert,
  Trophy,
  Check,
  Sun,
  Moon,
  LogOut,
  LogIn
} from 'lucide-react';

import { onAuthStateChanged, auth, signInWithGoogle, logOut, User } from './lib/firebase';
import { 
  subscribeToUserData, 
  seedFirestoreFromLocalState,
  syncHabitToFirestore,
  deleteHabitFromFirestore,
  syncDailyLogToFirestore,
  syncScheduleItemToFirestore,
  deleteScheduleItemFromFirestore,
  syncUserStatsToFirestore,
  syncAppSettingsToFirestore
} from './lib/firebaseSync';

import { HabitFlowState, Habit, DailyLog, DayChallenge, UserStats, AppSettings, ScheduleItem } from './types';
import { 
  INITIAL_USER_STATS, 
  INITIAL_SETTINGS, 
  PRESET_CHALLENGES, 
  HabitTemplate,
  COLOR_ACCENTS
} from './utils/dummyData';
import { playAlarmSound, startContinuousAlarm, stopContinuousAlarm, SoundCatalog } from './utils/audio';

import GoogleLoginView from './components/GoogleLoginView';
import Onboarding from './components/Onboarding';
import UpcomingTaskBar from './components/UpcomingTaskBar';
import ConfettiEffect, { playConfetti } from './components/ConfettiEffect';
import TodayView from './components/TodayView';
import ScheduleView from './components/ScheduleView';
import CalendarView from './components/CalendarView';
import ChallengesView from './components/ChallengesView';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import HabitForm from './components/HabitForm';
import GeminiCommandView from './components/GeminiCommandView';

export default function App() {
  // Authentication & Guest State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(() => {
    return localStorage.getItem('habitflow_guest_mode') === 'true';
  });

  // Global App States
  const [state, setState] = useState<HabitFlowState>({
    habits: [],
    dailyLogs: {},
    challenges: PRESET_CHALLENGES,
    userStats: INITIAL_USER_STATS,
    settings: INITIAL_SETTINGS,
  });

  const [activeTab, setActiveTab] = useState<'today' | 'schedule' | 'gemini' | 'stats' | 'settings'>('today');
  const [calendarSubTab, setCalendarSubTab] = useState<'log' | 'challenges'>('log');
  
  // Dedicated Schedule Items State
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('habitflow_schedule_items');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return [
      {
        id: 'sch_1',
        title: 'Morning Mindful Breathing & Stretch',
        time: '07:30',
        category: 'Mind',
        emoji: '🧘',
        alarmEnabled: true,
        alarmSound: 'soft_chime',
        days: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: 'sch_2',
        title: 'Deep Focus Momentum Session',
        time: '09:30',
        category: 'Work',
        emoji: '💡',
        alarmEnabled: true,
        alarmSound: 'morning_breeze',
        days: [1, 2, 3, 4, 5],
      },
      {
        id: 'sch_3',
        title: 'Evening Hydration & Reflection',
        time: '20:30',
        category: 'Health',
        emoji: '💧',
        alarmEnabled: true,
        alarmSound: 'zen_bell',
        days: [0, 1, 2, 3, 4, 5, 6],
      },
    ];
  });

  const [activeDate, setActiveDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [showHabitForm, setShowHabitForm] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);
  
  // Real-time Alarm / Reminder System
  const [activeAlarm, setActiveAlarm] = useState<{
    id: string;
    title: string;
    emoji: string;
    category: string;
    alarmSound: string;
    habitId?: string;
    subtaskId?: string;
  } | null>(null);
  
  const [snoozedAlarms, setSnoozedAlarms] = useState<{ [id: string]: number }>({});
  const lastAlarmCheckedMinute = useRef<string>('');

  // Save Schedule Items to LocalStorage and Firestore
  const saveScheduleItems = (items: ScheduleItem[]) => {
    setScheduleItems(items);
    localStorage.setItem('habitflow_schedule_items', JSON.stringify(items));
    if (currentUser) {
      for (const item of items) {
        syncScheduleItemToFirestore(currentUser.uid, item);
      }
    }
  };

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        setGuestMode(false);
        localStorage.removeItem('habitflow_guest_mode');
      }
    });
    return () => unsubscribe();
  }, []);
    // Real-time Firestore synchronization when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    // Seed Firestore with local state if database is fresh
    seedFirestoreFromLocalState(currentUser.uid, state, scheduleItems).catch((err) => {
      console.error('Initial Firestore sync error:', err);
    });

    // Subscribe to live cloud updates
    const unsub = subscribeToUserData(currentUser.uid, (data) => {
      setState((prev) => {
        const next = { ...prev };
        if (data.habits && data.habits.length > 0) next.habits = data.habits;
        if (data.dailyLogs && Object.keys(data.dailyLogs).length > 0) next.dailyLogs = data.dailyLogs;
        if (data.userStats) next.userStats = { ...prev.userStats, ...data.userStats };
        if (data.settings) next.settings = { ...prev.settings, ...data.settings };
        if (data.challenges && data.challenges.length > 0) next.challenges = data.challenges;
        return next;
      });
      if (data.scheduleItems && data.scheduleItems.length > 0) {
        setScheduleItems(data.scheduleItems);
      }
    });

    return () => unsub();
  }, [currentUser?.uid]);

  // 1. Initial State Loading from LocalStorage
  useEffect(() => {
    const rawData = localStorage.getItem('habitflow_state');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData) as HabitFlowState;
        
        const sanitState: HabitFlowState = {
          habits: parsed.habits || [],
          dailyLogs: parsed.dailyLogs || {},
          challenges: parsed.challenges && parsed.challenges.length > 0 ? parsed.challenges : PRESET_CHALLENGES,
          userStats: parsed.userStats ? { ...INITIAL_USER_STATS, ...parsed.userStats } : INITIAL_USER_STATS,
          settings: parsed.settings ? { ...INITIAL_SETTINGS, ...parsed.settings } : INITIAL_SETTINGS,
        };

        setState(sanitState);
      } catch (e) {
        console.error('Failed restoration of state from LocalStorage:', e);
      }
    }
  }, []);

  // 2. Synchronize to LocalStorage & Firestore
  const saveState = (newState: HabitFlowState) => {
    setState(newState);
    localStorage.setItem('habitflow_state', JSON.stringify(newState));
    if (currentUser) {
      syncUserStatsToFirestore(currentUser.uid, newState.userStats);
      syncAppSettingsToFirestore(currentUser.uid, newState.settings);
    }
  };

  // 3. Daily check-in logic updates check-in date silently on startup
  useEffect(() => {
    if (state.userStats.onboardingCompleted) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (state.userStats.lastCheckInDate !== todayStr) {
        saveState({
          ...state,
          userStats: {
            ...state.userStats,
            lastCheckInDate: todayStr,
          },
        });
      }
    }
  }, [state.userStats.onboardingCompleted]);

  // 4. Real-time Alarm checks every 10 seconds
  useEffect(() => {
    if (!state.userStats.onboardingCompleted) return;

    const interval = setInterval(() => {
      const now = new Date();
      const HH = now.getHours().toString().padStart(2, '0');
      const MM = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${HH}:${MM}`;
      const todayStr = now.toISOString().split('T')[0];
      const dow = now.getDay();

      if (lastAlarmCheckedMinute.current === currentTimeStr) return;

      // 1. Scan Schedule Items
      for (const item of scheduleItems) {
        if (!item.alarmEnabled) continue;
        if (item.time === currentTimeStr) {
          const isActiveDay = !item.days || item.days.includes(dow);
          if (!isActiveDay) continue;

          const snoozeExpiry = snoozedAlarms[item.id];
          if (snoozeExpiry && Date.now() < snoozeExpiry) continue;

          lastAlarmCheckedMinute.current = currentTimeStr;
          setActiveAlarm({
            id: item.id,
            title: item.title,
            emoji: item.emoji,
            category: item.category,
            alarmSound: item.alarmSound || 'soft_chime',
            habitId: item.habitId,
          });

          if (!state.settings.muteSounds) {
            playAlarmSound(item.alarmSound || 'soft_chime');
          }
          return;
        }
      }

      // 2. Scan Habits and Subtasks
      for (const h of state.habits) {
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

        if (h.alarmEnabled && h.alarmTime === currentTimeStr) {
          const alarmKey = `habit_${h.id}`;
          const snoozeExpiry = snoozedAlarms[alarmKey];
          if (!snoozeExpiry || Date.now() >= snoozeExpiry) {
            lastAlarmCheckedMinute.current = currentTimeStr;
            setActiveAlarm({
              id: alarmKey,
              title: h.name,
              emoji: h.emoji,
              category: h.category,
              alarmSound: h.alarmSound || 'soft_chime',
              habitId: h.id,
            });

            if (!state.settings.muteSounds) {
              playAlarmSound(h.alarmSound || 'soft_chime');
            }
            return;
          }
        }

        for (const sub of h.subtasks) {
          if (sub.reminderTime === currentTimeStr && sub.reminderEnabled) {
            const logId = `${h.id}_${todayStr}`;
            const log = state.dailyLogs[logId];
            const isCompleted = log?.completedSubtasks.includes(sub.id) ?? false;
            if (isCompleted) continue;

            const snoozeExpiry = snoozedAlarms[sub.id];
            if (snoozeExpiry && Date.now() < snoozeExpiry) continue;

            lastAlarmCheckedMinute.current = currentTimeStr;
            setActiveAlarm({
              id: sub.id,
              title: `${h.name}: ${sub.name}`,
              emoji: h.emoji,
              category: h.category,
              alarmSound: sub.alarmSound || h.alarmSound || 'soft_chime',
              habitId: h.id,
              subtaskId: sub.id,
            });

            if (!state.settings.muteSounds) {
              playAlarmSound(sub.alarmSound || h.alarmSound || 'soft_chime');
            }
            return;
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [
    state.habits,
    scheduleItems,
    state.dailyLogs,
    snoozedAlarms,
    state.userStats.onboardingCompleted,
    state.settings.muteSounds,
  ]);

  const [alarmMuted, setAlarmMuted] = useState(false);

  useEffect(() => {
    if (activeAlarm && !state.settings.muteSounds && !alarmMuted) {
      startContinuousAlarm(activeAlarm.alarmSound || 'classic_ring');
    } else {
      stopContinuousAlarm();
    }

    return () => {
      stopContinuousAlarm();
    };
  }, [activeAlarm, state.settings.muteSounds, alarmMuted]);
    // State modification actions passed to sub views
  const handleOnboardingComplete = (data: {
    userName: string;
    appAccent: 'emerald' | 'indigo' | 'rose' | 'amber' | 'cyan';
    selectedTemplates: HabitTemplate[];
  }) => {
    const createdHabits: Habit[] = data.selectedTemplates.map((temp, index) => {
      const hId = Math.random().toString(36).substring(2, 9);
      const subtasks = temp.subtaskNames.map((name, sIdx) => ({
        id: `sub_${hId}_${sIdx}`,
        name,
        reminderEnabled: false,
      }));

      return {
        id: hId,
        name: temp.name,
        description: temp.description,
        type: temp.type,
        isTask: false,
        emoji: temp.emoji,
        color: temp.color,
        category: temp.category,
        frequency: temp.frequency,
        targetFrequencyDays: temp.targetFrequencyDays,
        frequencyDays: temp.frequencyDays,
        targetValue: temp.targetValue,
        unit: temp.unit,
        targetMinutes: temp.targetMinutes,
        order: index,
        subtasks,
        createdAt: new Date().toISOString(),
        isArchived: false,
      };
    });

    const updatedState: HabitFlowState = {
      habits: createdHabits,
      dailyLogs: {},
      challenges: PRESET_CHALLENGES,
      userStats: {
        ...INITIAL_USER_STATS,
        userName: data.userName,
        onboardingCompleted: true,
      },
      settings: {
        ...state.settings,
        appAccent: data.appAccent,
      },
    };

    saveState(updatedState);
  };

  const handleUpdateLog = (newLog: DailyLog) => {
    saveState({
      ...state,
      dailyLogs: {
        ...state.dailyLogs,
        [newLog.id]: newLog,
      },
    });
    if (currentUser) {
      syncDailyLogToFirestore(currentUser.uid, newLog);
    }
  };

  const handleCreateOrUpdateHabit = (habitData: Omit<Habit, 'order' | 'createdAt'> & { id?: string }) => {
    if (habitData.id) {
      let savedHabit: Habit | null = null;
      const updatedHabits = state.habits.map((h) => {
        if (h.id === habitData.id) {
          savedHabit = {
            ...h,
            ...habitData,
          } as Habit;
          return savedHabit;
        }
        return h;
      });
      saveState({ ...state, habits: updatedHabits });
      if (currentUser && savedHabit) {
        syncHabitToFirestore(currentUser.uid, savedHabit);
      }
    } else {
      const newHabit: Habit = {
        ...habitData,
        id: Math.random().toString(36).substring(2, 9),
        order: state.habits.length,
        createdAt: new Date().toISOString(),
      } as Habit;

      saveState({
        ...state,
        habits: [...state.habits, newHabit],
      });
      if (currentUser) {
        syncHabitToFirestore(currentUser.uid, newHabit);
      }
    }
    setShowHabitForm(false);
    setHabitToEdit(null);
  };

  const handleDeleteHabit = (id: string) => {
    const updatedHabits = state.habits.filter((h) => h.id !== id);
    const updatedLogs = { ...state.dailyLogs };
    for (const logKey in updatedLogs) {
      if (updatedLogs[logKey].habitId === id) {
        delete updatedLogs[logKey];
      }
    }
    saveState({
      ...state,
      habits: updatedHabits,
      dailyLogs: updatedLogs,
    });
    if (currentUser) {
      deleteHabitFromFirestore(currentUser.uid, id);
    }
  };

  const handleDuplicateHabit = (habit: Habit) => {
    const dup: Habit = {
      ...habit,
      id: Math.random().toString(36).substring(2, 9),
      name: `${habit.name} (Copy)`,
      order: state.habits.length,
      createdAt: new Date().toISOString(),
      subtasks: habit.subtasks.map((sub, sIdx) => ({
        ...sub,
        id: `sub_dup_${sIdx}_${Math.random().toString(36).substring(2, 5)}`,
      })),
    };
    saveState({
      ...state,
      habits: [...state.habits, dup],
    });
    alert(`Duplicated: "${habit.name}" successfully!`);
  };

  const handleArchiveHabit = (id: string) => {
    const updatedHabits = state.habits.map((h) => {
      if (h.id === id) {
        return { ...h, isArchived: !h.isArchived };
      }
      return h;
    });
    saveState({ ...state, habits: updatedHabits });
    const isArchived = updatedHabits.find(h => h.id === id)?.isArchived;
    alert(isArchived ? 'Habit moved to archives. Past stats retained.' : 'Habit brought back from archives.');
  };

  const handleUpdateChallenge = (updatedChallenge: DayChallenge) => {
    const updatedChallenges = state.challenges.map((c) => {
      if (c.id === updatedChallenge.id) {
        return updatedChallenge;
      }
      return c;
    });
    saveState({
      ...state,
      challenges: updatedChallenges,
    });
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    saveState({
      ...state,
      settings: newSettings,
    });
  };

  const handleUpdateStats = (newStats: UserStats) => {
    saveState({
      ...state,
      userStats: newStats,
    });
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `habitflow_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportData = (importString: string) => {
    try {
      const parsed = JSON.parse(importString);
      if (parsed.habits && parsed.dailyLogs && parsed.userStats) {
        saveState(parsed as HabitFlowState);
        alert('Database restored successfully! Reloading...');
        window.location.reload();
      } else {
        alert('Invalid database backup structure. Please make sure files have active tables!');
      }
    } catch (e) {
      alert('Failed parsing backup. Files must be valid JSON strings.');
    }
  };

  const handleResetData = () => {
    localStorage.removeItem('habitflow_state');
    alert('All application data completely wiped out. Hard refreshing...');
    window.location.reload();
  };

  // Schedule Item Operations
  const handleAddScheduleItem = (itemData: Omit<ScheduleItem, 'id'>) => {
    const newItem: ScheduleItem = {
      ...itemData,
      id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    saveScheduleItems([...scheduleItems, newItem]);
  };

  const handleSetWholeSchedule = (newItems: ScheduleItem[]) => {
    saveScheduleItems(newItems);
  };

  const handleAppendSchedule = (newItems: ScheduleItem[]) => {
    saveScheduleItems([...scheduleItems, ...newItems]);
  };

  const handleToggleScheduleAlarm = (id: string) => {
    const updated = scheduleItems.map((item) => {
      if (item.id === id) {
        return { ...item, alarmEnabled: !item.alarmEnabled };
      }
      return item;
    });
    saveScheduleItems(updated);
  };

  const handleDeleteScheduleItem = (id: string) => {
    saveScheduleItems(scheduleItems.filter((i) => i.id !== id));
    if (currentUser) {
      deleteScheduleItemFromFirestore(currentUser.uid, id);
    }
  };
    // Google Authentication Actions
  const handleSignOut = async () => {
    try {
      await logOut();
      setCurrentUser(null);
      setGuestMode(false);
      localStorage.removeItem('habitflow_guest_mode');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const handleSignInWithGoogle = async () => {
    try {
      const res = await signInWithGoogle();
      if (res && res.user) {
        setCurrentUser(res.user);
        setGuestMode(false);
        localStorage.removeItem('habitflow_guest_mode');
      }
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  // Autonomous Gemini State Settlement (Saves to state, LocalStorage, and syncs to Firestore)
  const handleUpdateFromGemini = (changes: {
    habits: Habit[];
    dailyLogs: Record<string, DailyLog>;
    scheduleItems: ScheduleItem[];
    theme?: 'light' | 'dark';
  }) => {
    // 1. Update State & LocalStorage
    saveState({
      ...state,
      habits: changes.habits,
      dailyLogs: changes.dailyLogs,
      settings: changes.theme ? { ...state.settings, theme: changes.theme } : state.settings,
    });
    saveScheduleItems(changes.scheduleItems);

    // 2. Cloud Firestore Sync for logged in user
    if (currentUser) {
      for (const h of changes.habits) {
        syncHabitToFirestore(currentUser.uid, h);
      }
      for (const logId in changes.dailyLogs) {
        syncDailyLogToFirestore(currentUser.uid, changes.dailyLogs[logId]);
      }
      for (const s of changes.scheduleItems) {
        syncScheduleItemToFirestore(currentUser.uid, s);
      }
    }

    playConfetti();
  };

  const handleUpdateScheduleItemSound = (id: string, sound: string) => {
    const updated = scheduleItems.map((item) => {
      if (item.id === id) {
        return { ...item, alarmSound: sound };
      }
      return item;
    });
    saveScheduleItems(updated);
  };

  // Alarm Dialog responses
  const handleCompleteAlarmSubtask = () => {
    if (!activeAlarm) return;
    const todayStr = new Date().toISOString().split('T')[0];

    if (activeAlarm.habitId) {
      const habit = state.habits.find((h) => h.id === activeAlarm.habitId);
      if (habit) {
        const logId = `${habit.id}_${todayStr}`;
        const log = state.dailyLogs[logId] || {
          id: logId,
          habitId: habit.id,
          date: todayStr,
          completed: false,
          value: 0,
          completedSubtasks: [],
        };

        if (activeAlarm.subtaskId) {
          if (!log.completedSubtasks.includes(activeAlarm.subtaskId)) {
            const updatedSubtasks = [...log.completedSubtasks, activeAlarm.subtaskId];
            const allDone = habit.subtasks.every((sub) => updatedSubtasks.includes(sub.id));
            let mainDone = log.completed;

            if (state.settings.requireAllSubtasksComplete && habit.subtasks.length > 0) {
              mainDone = allDone;
            }

            handleUpdateLog({
              ...log,
              completedSubtasks: updatedSubtasks,
              completed: mainDone,
            });
            playConfetti();
          }
        } else {
          if (!log.completed) {
            handleUpdateLog({
              ...log,
              completed: true,
            });
            playConfetti();
          }
        }
      }
    } else {
      playConfetti();
    }

    setActiveAlarm(null);
  };

  const handleSnoozeAlarm = () => {
    if (!activeAlarm) return;
    const resTimestamp = Date.now() + 5 * 60 * 1000;
    setSnoozedAlarms({
      ...snoozedAlarms,
      [activeAlarm.id]: resTimestamp,
    });
    setActiveAlarm(null);
  };

  const handleQuickCompleteUpcomingHabit = (habitId: string) => {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const logId = `${habitId}_${todayStr}`;
    const existingLog = state.dailyLogs[logId];

    handleUpdateLog({
      id: logId,
      habitId,
      date: todayStr,
      completed: true,
      completedSubtasks: habit.subtasks ? habit.subtasks.map((s) => s.id) : [],
      value: existingLog?.value || 1,
    });

    playConfetti();
  };

  const accentTheme = COLOR_ACCENTS.find((a) => a.name === state.settings.appAccent) || COLOR_ACCENTS[1];
  const isLight = state.settings.theme === 'light';

  useEffect(() => {
    if (state.settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [state.settings.theme]);

  // 1. Initial Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <img src="/icon.svg" alt="HabitFlow" className="w-16 h-16 rounded-2xl animate-pulse shadow-2xl" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Loading HabitFlow...</span>
      </div>
    );
  }

  // 2. Google Login Screen Gating
  if (!currentUser && !guestMode) {
    return (
      <GoogleLoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setGuestMode(false);
          localStorage.removeItem('habitflow_guest_mode');
          if (user.displayName && (!state.userStats.userName || state.userStats.userName === 'Champion')) {
            handleUpdateStats({
              ...state.userStats,
              userName: user.displayName,
            });
          }
        }}
        onContinueAsGuest={() => {
          setGuestMode(true);
          localStorage.setItem('habitflow_guest_mode', 'true');
        }}
      />
    );
  }

  // 3. Onboarding Screen Gating
  if (!state.userStats.onboardingCompleted) {
    return (
      <div className={`${isLight ? 'light bg-[#FAF8F5] text-stone-900' : 'dark bg-slate-950 text-white'} min-h-screen transition-colors duration-200`}>
        <Onboarding 
          initialUserName={currentUser?.displayName || state.userStats.userName || ''} 
          onComplete={handleOnboardingComplete} 
        />
      </div>
    );
  }
    return (
    <div className={`${isLight ? 'light bg-[#FAF8F5] text-stone-900' : 'dark bg-slate-950 text-slate-100'} min-h-screen flex flex-col justify-between overflow-x-hidden transition-colors duration-200`}>
      <ConfettiEffect />

      {/* Top Banner Dashboard header */}
      <header id="habitflow-main-header" className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 py-3.5 md:px-0">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="HabitFlow Logo" className="w-8 h-8 rounded-xl object-cover shadow-md border border-slate-800 shrink-0 bg-slate-950 p-0.5" />
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                Habit<span className={accentTheme.text}>Flow</span>
              </span>
              <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-slate-500" /> Hi, {currentUser?.displayName || state.userStats.userName || 'Champion'}!
              </span>
            </div>
          </div>

          {/* Quick Controls: User Account + Theme Switcher */}
          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 pr-2 shadow-sm">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || 'Google User'} 
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-lg object-cover border border-slate-700" 
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 text-xs font-black flex items-center justify-center">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                  </div>
                )}
                <button
                  id="header-signout-btn"
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out of Google"
                  className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="header-google-signin-btn"
                type="button"
                onClick={handleSignInWithGoogle}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-[10px] font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer select-none"
                title="Sign in with Google"
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Sign In</span>
              </button>
            )}

            <button
              id="theme-quick-toggle-btn"
              type="button"
              onClick={() => {
                const nextTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
                handleUpdateSettings({ ...state.settings, theme: nextTheme });
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer select-none"
              title={`Switch to ${state.settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}`}
            >
              {state.settings.theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-300 hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-600 hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main body viewport */}
      <main className="flex-1 w-full max-w-xl mx-auto pt-4 pb-20">
        <UpcomingTaskBar
          habits={state.habits}
          dailyLogs={state.dailyLogs}
          scheduleItems={scheduleItems}
          onCompleteHabit={handleQuickCompleteUpcomingHabit}
          accentColor={state.settings.appAccent}
        />
        
        {/* TAB 1: Today Dashboard */}
        {activeTab === 'today' && (
          <TodayView
            habits={state.habits}
            dailyLogs={state.dailyLogs}
            userName={state.userStats.userName}
            onUpdateLog={handleUpdateLog}
            onEditHabit={(h) => {
              setHabitToEdit(h);
              setShowHabitForm(true);
            }}
            onDeleteHabit={handleDeleteHabit}
            onDuplicateHabit={handleDuplicateHabit}
            onArchiveHabit={handleArchiveHabit}
            onCreateHabitClick={() => {
              setHabitToEdit(null);
              setShowHabitForm(true);
            }}
            onOpenGemini={() => setActiveTab('gemini')}
            settings={state.settings}
            activeDate={activeDate}
          />
        )}

        {/* TAB 2: Schedule & Alarms Manager */}
        {activeTab === 'schedule' && (
          <ScheduleView
            scheduleItems={scheduleItems}
            habits={state.habits}
            categoriesList={state.userStats.customCategories}
            onAddScheduleItem={handleAddScheduleItem}
            onSetWholeSchedule={handleSetWholeSchedule}
            onAppendSchedule={handleAppendSchedule}
            onToggleScheduleAlarm={handleToggleScheduleAlarm}
            onDeleteScheduleItem={handleDeleteScheduleItem}
            onUpdateScheduleItemSound={handleUpdateScheduleItemSound}
          />
        )}

        {/* TAB 3: Gemini Command Center */}
        {activeTab === 'gemini' && (
          <GeminiCommandView
            habits={state.habits}
            dailyLogs={state.dailyLogs}
            scheduleItems={scheduleItems}
            challenges={state.challenges}
            userName={state.userStats.userName}
            activeDate={activeDate}
            onUpdateFullState={handleUpdateFromGemini}
            onUpdateChallenge={handleUpdateChallenge}
            onSelectDate={(dStr) => {
              setActiveDate(dStr);
              setActiveTab('today');
            }}
            weekStartMonday={state.settings.weekStartMonday}
            categoriesList={state.userStats.customCategories}
          />
        )}

        {/* TAB 4: Statistics */}
        {activeTab === 'stats' && (
          <StatsView
            habits={state.habits}
            dailyLogs={state.dailyLogs}
          />
        )}

        {/* TAB 5: Settings */}
        {activeTab === 'settings' && (
          <SettingsView
            settings={state.settings}
            userStats={state.userStats}
            currentUser={currentUser}
            onSignInWithGoogle={handleSignInWithGoogle}
            onSignOut={handleSignOut}
            onUpdateSettings={handleUpdateSettings}
            onUpdateStats={handleUpdateStats}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onResetData={handleResetData}
          />
        )}
      </main>

      {/* Habit Form Modal */}
      {showHabitForm && (
        <HabitForm
          habitToEdit={habitToEdit}
          categoriesList={state.userStats.customCategories}
          onSave={handleCreateOrUpdateHabit}
          onClose={() => {
            setShowHabitForm(false);
            setHabitToEdit(null);
          }}
        />
      )}

      {/* Fullscreen Alarm Modal */}
      {activeAlarm && (
        <div
          id="reminder-alarm-popup"
          className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-md flex flex-col items-center justify-between py-10 px-6 animate-fadeIn select-none"
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="w-80 h-80 rounded-full bg-rose-500/10 animate-ping" />
            <div className="w-96 h-96 rounded-full bg-indigo-500/10 animate-pulse" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-2 mt-4 text-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest animate-pulse">
              <Bell className="w-3.5 h-3.5 animate-bounce" /> Alarm Ringing Loudly
            </div>
            
            <h2 className="text-4xl font-black text-white tracking-wider mt-2">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </h2>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="relative z-10 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl text-center w-full max-w-sm flex flex-col items-center gap-3 shadow-2xl shadow-indigo-600/20">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-3xl text-4xl shadow-inner mb-1">
              {activeAlarm.emoji}
            </div>

            <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase text-indigo-400 tracking-wider">
              {activeAlarm.category}
            </span>

            <h3 className="text-lg font-black text-white leading-snug">
              {activeAlarm.title}
            </h3>

            {activeAlarm.alarmSound && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 border border-slate-800 rounded-xl text-[10px] font-bold text-amber-300">
                <span>{SoundCatalog.OPTIONS.find((s) => s.id === activeAlarm.alarmSound)?.emoji || '🎵'}</span>
                <span className="truncate max-w-[180px]">
                  {SoundCatalog.OPTIONS.find((s) => s.id === activeAlarm.alarmSound)?.name || 'Alarm Tune'}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setAlarmMuted(!alarmMuted)}
              className={`mt-1 px-4 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
                alarmMuted
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  : 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
              }`}
            >
              {alarmMuted ? '🔇 Audio Silenced (Tap to Unmute)' : '🔊 Ringing (Tap to Mute)'}
            </button>
          </div>

          <div className="relative z-10 flex flex-col gap-3 w-full max-w-sm mb-4">
            <button
              id="alarm-btn-complete"
              type="button"
              onClick={handleCompleteAlarmSubtask}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-2xl uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[3]" /> Turn Off & Complete (+10g)
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="alarm-btn-snooze"
                type="button"
                onClick={handleSnoozeAlarm}
                className="py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 text-amber-400 font-extrabold text-xs uppercase rounded-2xl transition-all cursor-pointer"
              >
                Snooze 5 Min
              </button>

              <button
                id="alarm-btn-dismiss"
                type="button"
                onClick={() => setActiveAlarm(null)}
                className="py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 text-slate-400 hover:text-white font-extrabold text-xs uppercase rounded-2xl transition-all cursor-pointer"
              >
                Dismiss Alarm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Bottom Navigation bar */}
      <nav id="habitflow-bottom-nav" className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/85 backdrop-blur-md border-t border-slate-900 py-3.5 px-2">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5">
          <button
            id="nav-tab-today"
            type="button"
            onClick={() => { setActiveTab('today'); }}
            className={`flex flex-col items-center gap-1 transition-colors outline-none cursor-pointer select-none ${
              activeTab === 'today' ? accentTheme.text : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <CheckSquare className="w-5 h-5" strokeWidth={activeTab === 'today' ? 2.5 : 2} />
            <span className="text-[8px] font-extrabold uppercase tracking-wider">Today</span>
          </button>

          <button
            id="nav-tab-schedule"
            type="button"
            onClick={() => { setActiveTab('schedule'); }}
            className={`flex flex-col items-center gap-1 transition-colors outline-none cursor-pointer select-none ${
              activeTab === 'schedule' ? accentTheme.text : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Clock className="w-5 h-5" strokeWidth={activeTab === 'schedule' ? 2.5 : 2} />
            <span className="text-[8px] font-extrabold uppercase tracking-wider">Schedule</span>
          </button>

          <button
            id="nav-tab-gemini"
            type="button"
            onClick={() => { setActiveTab('gemini'); }}
            className={`flex flex-col items-center gap-1 transition-colors outline-none cursor-pointer select-none relative ${
              activeTab === 'gemini' ? accentTheme.text : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <div className="relative">
              <Sparkles className="w-5 h-5" strokeWidth={activeTab === 'gemini' ? 2.5 : 2} />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <span className="text-[8px] font-extrabold uppercase tracking-wider">Gemini AI</span>
          </button>

          <button
            id="nav-tab-stats"
            type="button"
            onClick={() => { setActiveTab('stats'); }}
            className={`flex flex-col items-center gap-1 transition-colors outline-none cursor-pointer select-none ${
              activeTab === 'stats' ? accentTheme.text : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <TrendingUp className="w-5 h-5" strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
            <span className="text-[8px] font-extrabold uppercase tracking-wider">Stats</span>
          </button>

          <button
            id="nav-tab-settings"
            type="button"
            onClick={() => { setActiveTab('settings'); }}
            className={`flex flex-col items-center gap-1 transition-colors outline-none cursor-pointer select-none ${
              activeTab === 'settings' ? accentTheme.text : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Sliders className="w-5 h-5" strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[8px] font-extrabold uppercase tracking-wider">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

