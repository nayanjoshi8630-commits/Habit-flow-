/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CustomRingtone {
  id: string; // e.g. "custom_1726300000000"
  name: string;
  description: string;
  emoji: string;
  audioUrl: string; // blob URL or data URL
  fileName: string;
  fileSize: string;
  durationSeconds?: number;
  createdAt: string;
  isCustom: true;
}

const DB_NAME = 'HabitFlowAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'ringtones';
const LOCAL_STORAGE_META_KEY = 'habitflow_custom_audio_meta_v1';

// In-memory cache of custom ringtones
let inMemoryRingtones: CustomRingtone[] = [];
let isInitialized = false;
type AudioChangeListener = (ringtones: CustomRingtone[]) => void;
const listeners: Set<AudioChangeListener> = new Set();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Format bytes to readable string (e.g. 520 KB, 2.1 MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Clean filename to use as default ringtone title
 */
export function sanitizeRingtoneName(filename: string): string {
  // Remove file extension
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  // Replace underscores and dashes with spaces
  const withSpaces = withoutExt.replace(/[_-]/g, ' ');
  // Capitalize words
  return withSpaces
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .slice(0, 30);
}

/**
 * Measure audio duration from a Blob
 */
function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const dur = Math.round(audio.duration || 0);
        URL.revokeObjectURL(url);
        resolve(dur);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      audio.src = url;
    } catch {
      resolve(0);
    }
  });
}

/**
 * Initialize and load custom audio from IndexedDB & localStorage
 */
export async function initCustomAudioStorage(): Promise<CustomRingtone[]> {
  if (isInitialized && inMemoryRingtones.length > 0) {
    return inMemoryRingtones;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    const dbRecords: any[] = await new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });

    const loadedRingtones: CustomRingtone[] = [];

    for (const record of dbRecords) {
      let audioUrl = '';
      if (record.blob instanceof Blob) {
        audioUrl = URL.createObjectURL(record.blob);
      } else if (record.dataUrl) {
        audioUrl = record.dataUrl;
      }

      if (audioUrl) {
        loadedRingtones.push({
          id: record.id,
          name: record.name,
          description: record.description || `Custom ringtune • ${record.fileSize || ''}`,
          emoji: record.emoji || '🎵',
          audioUrl,
          fileName: record.fileName || 'custom_sound',
          fileSize: record.fileSize || '',
          durationSeconds: record.durationSeconds,
          createdAt: record.createdAt || new Date().toISOString(),
          isCustom: true,
        });
      }
    }

    inMemoryRingtones = loadedRingtones;
    isInitialized = true;
    notifyListeners();
    return inMemoryRingtones;
  } catch (err) {
    console.warn('IndexedDB load failed, attempting localStorage fallback:', err);
    // Fallback to localStorage metadata
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        inMemoryRingtones = parsed;
        isInitialized = true;
        notifyListeners();
        return inMemoryRingtones;
      }
    } catch (e) {
      console.warn('localStorage audio load failed:', e);
    }
    isInitialized = true;
    return [];
  }
}

/**
 * Add a new custom ringtone from a user device file
 */
export async function addCustomRingtone(
  file: File,
  customTitle?: string,
  customEmoji?: string
): Promise<CustomRingtone> {
  // Validate file is audio
  const isAudioType = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|weba|wma)$/i.test(file.name);
  if (!isAudioType && file.type) {
    throw new Error('Please select a valid audio file (e.g. MP3, WAV, M4A, OGG, AAC).');
  }

  // Check file size (e.g. max 25MB)
  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Audio file exceeds the 25MB limit for ring tunes.');
  }

  const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = (customTitle && customTitle.trim()) || sanitizeRingtoneName(file.name);
  const emoji = customEmoji || '🎵';
  const fileSize = formatBytes(file.size);
  const durationSeconds = await getAudioDuration(file);

  const durationStr = durationSeconds > 0 ? `${durationSeconds}s` : '';
  const description = durationStr
    ? `Custom device tune • ${durationStr} • ${fileSize}`
    : `Custom device tune • ${fileSize}`;

  // Create Object URL for live playback
  const audioUrl = URL.createObjectURL(file);

  const newRingtone: CustomRingtone = {
    id,
    name: title,
    description,
    emoji,
    audioUrl,
    fileName: file.name,
    fileSize,
    durationSeconds,
    createdAt: new Date().toISOString(),
    isCustom: true,
  };

  // 1. Save to IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Also store Base64 if file is small (<1.5MB) for quick recovery
    let dataUrl: string | undefined = undefined;
    if (file.size < 1.5 * 1024 * 1024) {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    const recordToSave = {
      id,
      name: title,
      description,
      emoji,
      blob: file,
      dataUrl,
      fileName: file.name,
      fileSize,
      durationSeconds,
      createdAt: newRingtone.createdAt,
    };

    await new Promise((resolve, reject) => {
      const req = store.put(recordToSave);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Saving audio to IndexedDB failed, keeping in memory:', err);
  }

  // 2. Add to in-memory list
  inMemoryRingtones = [newRingtone, ...inMemoryRingtones];
  
  // 3. Update localStorage metadata
  try {
    const metaList = inMemoryRingtones.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      emoji: r.emoji,
      fileName: r.fileName,
      fileSize: r.fileSize,
      durationSeconds: r.durationSeconds,
      createdAt: r.createdAt,
      isCustom: true,
    }));
    localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(metaList));
  } catch (e) {
    // Ignore quota issues
  }

  notifyListeners();
  return newRingtone;
}

/**
 * Delete a custom ringtone
 */
export async function deleteCustomRingtone(id: string): Promise<void> {
  const target = inMemoryRingtones.find((r) => r.id === id);
  if (target && target.audioUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(target.audioUrl);
    } catch {}
  }

  inMemoryRingtones = inMemoryRingtones.filter((r) => r.id !== id);

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.warn('Error deleting from IndexedDB:', err);
  }

  try {
    const metaList = inMemoryRingtones.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      emoji: r.emoji,
      fileName: r.fileName,
      fileSize: r.fileSize,
      durationSeconds: r.durationSeconds,
      createdAt: r.createdAt,
      isCustom: true,
    }));
    localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(metaList));
  } catch {}

  notifyListeners();
}

/**
 * Get the current loaded custom ringtones synchronously
 */
export function getCustomRingtones(): CustomRingtone[] {
  return inMemoryRingtones;
}

/**
 * Subscribe to custom ringtones updates
 */
export function subscribeCustomAudioChanges(cb: AudioChangeListener): () => void {
  listeners.add(cb);
  cb(inMemoryRingtones);
  return () => {
    listeners.delete(cb);
  };
}

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb(inMemoryRingtones);
    } catch (e) {
      console.warn('Audio change listener error:', e);
    }
  });
}
