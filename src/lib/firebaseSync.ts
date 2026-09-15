/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { HabitFlowState, Habit, DailyLog, DayChallenge, UserStats, AppSettings, ScheduleItem } from '../types';

/**
 * Recursively removes undefined fields from an object so Firestore setDoc / updateDoc doesn't reject it.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export async function syncHabitToFirestore(userId: string, habit: Habit) {
  const path = `users/${userId}/habits/${habit.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'habits', habit.id), cleanFirestoreData(habit));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHabitFromFirestore(userId: string, habitId: string) {
  const path = `users/${userId}/habits/${habitId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'habits', habitId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncDailyLogToFirestore(userId: string, log: DailyLog) {
  const path = `users/${userId}/dailyLogs/${log.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'dailyLogs', log.id), cleanFirestoreData(log));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncScheduleItemToFirestore(userId: string, item: ScheduleItem) {
  const path = `users/${userId}/scheduleItems/${item.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'scheduleItems', item.id), cleanFirestoreData(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteScheduleItemFromFirestore(userId: string, itemId: string) {
  const path = `users/${userId}/scheduleItems/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'scheduleItems', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncUserStatsToFirestore(userId: string, stats: UserStats) {
  const path = `users/${userId}/userStats/main`;
  try {
    await setDoc(doc(db, 'users', userId, 'userStats', 'main'), cleanFirestoreData(stats));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncAppSettingsToFirestore(userId: string, settings: AppSettings) {
  const path = `users/${userId}/settings/main`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'main'), cleanFirestoreData(settings));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncChallengesToFirestore(userId: string, challenges: DayChallenge[]) {
  const batch = writeBatch(db);
  challenges.forEach((c) => {
    const ref = doc(db, 'users', userId, 'challenges', c.id);
    batch.set(ref, cleanFirestoreData(c));
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/challenges`);
  }
}

/**
 * Uploads current local state to Firestore for a newly logged-in user if Firestore has no data.
 */
export async function seedFirestoreFromLocalState(userId: string, state: HabitFlowState, scheduleItems: ScheduleItem[]) {
  const habitsPath = `users/${userId}/habits`;
  try {
    const habitsSnap = await getDocs(collection(db, 'users', userId, 'habits'));
    
    // If Firestore already has data, don't overwrite
    if (!habitsSnap.empty) {
      return;
    }

    // Seed habits
    for (const habit of state.habits) {
      await syncHabitToFirestore(userId, habit);
    }

    // Seed daily logs
    for (const logId of Object.keys(state.dailyLogs)) {
      await syncDailyLogToFirestore(userId, state.dailyLogs[logId]);
    }

    // Seed schedule items
    for (const item of scheduleItems) {
      await syncScheduleItemToFirestore(userId, item);
    }

    // Seed user stats & settings
    await syncUserStatsToFirestore(userId, state.userStats);
    await syncAppSettingsToFirestore(userId, state.settings);
    await syncChallengesToFirestore(userId, state.challenges);

  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, habitsPath);
  }
}

/**
 * Sets up real-time Firestore listeners for logged-in user.
 */
export function subscribeToUserData(
  userId: string, 
  onUpdate: (data: {
    habits?: Habit[];
    dailyLogs?: { [id: string]: DailyLog };
    scheduleItems?: ScheduleItem[];
    userStats?: UserStats;
    settings?: AppSettings;
    challenges?: DayChallenge[];
  }) => void
) {
  const unsubscribers: (() => void)[] = [];

  // 1. Habits
  const habitsRef = collection(db, 'users', userId, 'habits');
  const unsubHabits = onSnapshot(habitsRef, (snapshot) => {
    const habits: Habit[] = snapshot.docs.map((d) => d.data() as Habit);
    onUpdate({ habits });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/habits`);
  });
  unsubscribers.push(unsubHabits);

  // 2. Daily Logs
  const logsRef = collection(db, 'users', userId, 'dailyLogs');
  const unsubLogs = onSnapshot(logsRef, (snapshot) => {
    const dailyLogs: { [id: string]: DailyLog } = {};
    snapshot.docs.forEach((d) => {
      const log = d.data() as DailyLog;
      dailyLogs[log.id] = log;
    });
    onUpdate({ dailyLogs });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/dailyLogs`);
  });
  unsubscribers.push(unsubLogs);

  // 3. Schedule Items
  const scheduleRef = collection(db, 'users', userId, 'scheduleItems');
  const unsubSchedule = onSnapshot(scheduleRef, (snapshot) => {
    const scheduleItems: ScheduleItem[] = snapshot.docs.map((d) => d.data() as ScheduleItem);
    onUpdate({ scheduleItems });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/scheduleItems`);
  });
  unsubscribers.push(unsubSchedule);

  // 4. User Stats
  const statsRef = doc(db, 'users', userId, 'userStats', 'main');
  const unsubStats = onSnapshot(statsRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ userStats: snapshot.data() as UserStats });
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/userStats/main`);
  });
  unsubscribers.push(unsubStats);

  // 5. Settings
  const settingsRef = doc(db, 'users', userId, 'settings', 'main');
  const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ settings: snapshot.data() as AppSettings });
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/settings/main`);
  });
  unsubscribers.push(unsubSettings);

  // Return master cleanup
  return () => {
    unsubscribers.forEach((u) => u());
  };
}
