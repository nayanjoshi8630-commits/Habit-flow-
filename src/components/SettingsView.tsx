/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Plus,
  Info,
  Sun,
  Moon,
  Check,
  Smartphone,
  Music,
  Bell,
  Play,
  Square,
  Sparkles,
  UserCheck,
  LogOut,
  LogIn,
  Cloud,
  ShieldCheck
} from 'lucide-react';
import { User } from '../lib/firebase';
import { AppSettings, UserStats } from '../types';
import { COLOR_ACCENTS } from '../utils/dummyData';
import { playAlarmSound, stopContinuousAlarm } from '../utils/audio';
import { subscribeCustomAudioChanges, deleteCustomRingtone, CustomRingtone } from '../utils/customAudioStorage';
import CustomTuneUploader from './CustomTuneUploader';

interface SettingsViewProps {
  settings: AppSettings;
  userStats: UserStats;
  currentUser?: User | null;
  onSignInWithGoogle?: () => void;
  onSignOut?: () => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onUpdateStats: (stats: UserStats) => void;
  onExportData?: () => void;
  onImportData?: (importString: string) => void;
  onResetData?: () => void;
}

export default function SettingsView({
  settings,
  userStats,
  currentUser,
  onSignInWithGoogle,
  onSignOut,
  onUpdateSettings,
  onUpdateStats,
}: SettingsViewProps) {
  const [newCatName, setNewCatName] = useState('');
  const [customTunes, setCustomTunes] = useState<CustomRingtone[]>([]);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeCustomAudioChanges((tunes) => {
      setCustomTunes(tunes);
    });
    return () => {
      stopContinuousAlarm();
      unsub();
    };
  }, []);

  const handleTogglePreview = (soundId: string) => {
    if (playingSoundId === soundId) {
      stopContinuousAlarm();
      setPlayingSoundId(null);
    } else {
      stopContinuousAlarm();
      playAlarmSound(soundId);
      setPlayingSoundId(soundId);
      setTimeout(() => {
        setPlayingSoundId((curr) => (curr === soundId ? null : curr));
      }, 5000);
    }
  };

  const handleDeleteCustomTune = async (id: string, name: string) => {
    if (window.confirm(`Remove custom ringtune "${name}" from your device library?`)) {
      if (playingSoundId === id) {
        stopContinuousAlarm();
        setPlayingSoundId(null);
      }
      await deleteCustomRingtone(id);
    }
  };

  // Toggle boolean settings
  const handleToggleMute = () => {
    onUpdateSettings({ ...settings, muteSounds: !settings.muteSounds });
  };

  const handleToggleWeekStart = () => {
    onUpdateSettings({ ...settings, weekStartMonday: !settings.weekStartMonday });
  };

  const handleToggleAllSubtasksRule = () => {
    onUpdateSettings({ ...settings, requireAllSubtasksComplete: !settings.requireAllSubtasksComplete });
  };

  // Change primary color theme accent
  const handleSelectAccent = (colorName: 'emerald' | 'indigo' | 'rose' | 'amber' | 'cyan') => {
    onUpdateSettings({ ...settings, appAccent: colorName });
  };

  // Categories list management
  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    if (userStats.customCategories.includes(newCatName.trim())) {
      alert('This Category label already exists!');
      return;
    }

    onUpdateStats({
      ...userStats,
      customCategories: [...userStats.customCategories, newCatName.trim()],
    });

    setNewCatName('');
  };

  const handleRemoveCategory = (cat: string) => {
    if (userStats.customCategories.length <= 1) {
      alert('Keep at least one category tag to register routine items!');
      return;
    }
    if (window.confirm(`Are you sure you want to remove the Category: "${cat}"? Individual habits won't be deleted but their tags will remain.`)) {
      onUpdateStats({
        ...userStats,
        customCategories: userStats.customCategories.filter((c) => c !== cat),
      });
    }
  };

  return (
    <div id="settings-view-main" className="flex flex-col gap-5 px-4 md:px-0 mt-2 mb-10 overflow-x-hidden animate-fadeIn">
      
      {/* Google Account & Cloud Sync Section */}
      <div id="settings-google-account-card" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
            <Cloud className="w-4 h-4 text-indigo-400" /> Google Account & Cloud Sync
          </h3>
          {currentUser ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Connected
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Guest Mode
            </span>
          )}
        </div>

        {currentUser ? (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.displayName || 'Google User'} 
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-2xl border border-slate-700 object-cover shadow"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-black text-sm shrink-0">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-white truncate flex items-center gap-1.5">
                  {currentUser.displayName || 'Google User'}
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {currentUser.email}
                </span>
                <span className="text-[9px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                  ✓ Habits & Alarms auto-synced to Cloud Firestore
                </span>
              </div>
            </div>

            {onSignOut && (
              <button
                id="settings-signout-btn"
                type="button"
                onClick={onSignOut}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-900/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Sign in with Google
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5 max-w-sm leading-relaxed">
                Connect your Google account to back up your routine schedules, custom tunes, and habit streaks safely to the cloud.
              </p>
            </div>

            {onSignInWithGoogle && (
              <button
                id="settings-signin-btn"
                type="button"
                onClick={onSignInWithGoogle}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-black transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-md"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Visual Customize settings block */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4">
        <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" /> visual identity and theme
        </h3>

        {/* Interface Appearance Theme Mode */}
        <div className="flex flex-col gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-850">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
              Interface Theme Mode
            </span>
            <span className="text-[9px] font-bold text-slate-500">
              Current: <strong className="text-slate-300 capitalize">{settings.theme || 'dark'}</strong> (Default: Dark)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1.5">
            {/* Dark Mode (Default) */}
            <button
              id="settings-theme-dark-btn"
              type="button"
              onClick={() => onUpdateSettings({ ...settings, theme: 'dark' })}
              className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer select-none text-left relative ${
                settings.theme !== 'light'
                  ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                  : 'bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-400'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                settings.theme !== 'light' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-950 text-slate-500'
              }`}>
                <Moon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-black block ${settings.theme !== 'light' ? 'text-white' : 'text-slate-300'}`}>
                    Dark Mode
                  </span>
                  <span className="text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/50">
                    Default
                  </span>
                </div>
                <span className="text-[9.5px] text-slate-400 block truncate">
                  Default sleek UI
                </span>
              </div>
              {settings.theme !== 'light' && (
                <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </button>

            {/* Light Mode */}
            <button
              id="settings-theme-light-btn"
              type="button"
              onClick={() => onUpdateSettings({ ...settings, theme: 'light' })}
              className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer select-none text-left relative ${
                settings.theme === 'light'
                  ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                  : 'bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-400'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                settings.theme === 'light' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-950 text-slate-500'
              }`}>
                <Sun className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-black block ${settings.theme === 'light' ? 'text-amber-500' : 'text-slate-300'}`}>
                    Light Mode
                  </span>
                </div>
                <span className="text-[9.5px] text-slate-400 block truncate">
                  Creamy white warm UI
                </span>
              </div>
              {settings.theme === 'light' && (
                <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic theme accent picker */}
        <div className="flex flex-col gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-850">
          <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">App Primary Theme Accent</span>
          <div className="grid grid-cols-5 gap-2.5 mt-1.5">
            {COLOR_ACCENTS.map((color) => (
              <button
                id={`settings-accent-btn-${color.name}`}
                key={color.name}
                type="button"
                onClick={() => handleSelectAccent(color.name as any)}
                className={`h-11 rounded-xl flex flex-col items-center justify-center border transition-all ${
                  settings.appAccent === color.name
                    ? 'bg-slate-900 border-indigo-500 shadow-md transform scale-105'
                    : 'bg-slate-900 border-slate-850 hover:border-slate-800'
                }`}
              >
                <div className={`h-4.5 w-4.5 rounded-full ${color.bg}`} />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{color.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Routine rules guidelines setup */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4">
        <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
          ⚙️ Routine Schedules and rules
        </h3>

        <div className="flex flex-col gap-3">
          {/* Rule 1: Sound muter */}
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-850">
            <div className="flex items-center gap-3">
              {settings.muteSounds ? (
                <VolumeX className="w-5 h-5 text-red-400 shrink-0" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <div>
                <span className="text-xs font-bold text-slate-200 block">Sounds / completion chimes</span>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Play sound on activity check-off</span>
              </div>
            </div>
            <button
              id="settings-toggle-mute"
              type="button"
              onClick={handleToggleMute}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase select-none transition-all ${
                settings.muteSounds
                  ? 'bg-rose-950/40 text-rose-450 border border-red-900/30'
                  : 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/40'
              }`}
            >
              {settings.muteSounds ? 'Muted' : 'Enabled'}
            </button>
          </div>

          {/* Rule 2: Week starting date */}
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-850">
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0 select-none">📅</span>
              <div>
                <span className="text-xs font-bold text-slate-200 block">First day of week</span>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Start day on calendars and log boards</span>
              </div>
            </div>
            <button
              id="settings-toggle-week-start"
              type="button"
              onClick={handleToggleWeekStart}
              className="px-4 py-1.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-[10px] rounded-xl uppercase transition-all"
            >
              {settings.weekStartMonday ? 'Monday' : 'Sunday'}
            </button>
          </div>

          {/* Rule 3: require all subtasks */}
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-850">
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0 select-none">🛡️</span>
              <div>
                <span className="text-xs font-bold text-slate-200 block">Subtasks checklock</span>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Require all subtasks done to check habit card</span>
              </div>
            </div>
            <button
              id="settings-toggle-all-subs"
              type="button"
              onClick={handleToggleAllSubtasksRule}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase select-none transition-all ${
                settings.requireAllSubtasksComplete
                  ? 'bg-indigo-950/40 text-indigo-405 border border-indigo-900/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-850'
              }`}
            >
              {settings.requireAllSubtasksComplete ? 'Hardlock' : 'Loose'}
            </button>
          </div>
        </div>
      </div>

      {/* Habits categories list manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4">
        <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
          🗂️ Routine Category tags manager
        </h3>

        <div className="flex flex-col gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
          <div className="flex gap-2">
            <input
              id="settings-add-cat-input"
              type="text"
              placeholder="Custom Category name..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-bold text-xs outline-none"
            />
            <button
              id="settings-add-cat-btn"
              type="button"
              onClick={handleAddCategory}
              className="px-3 bg-indigo-600 h-8 hover:bg-indigo-500 rounded-lg text-white font-extrabold text-xs flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div id="settings-categories-list" className="flex flex-wrap gap-2 mt-2 max-h-40 overflow-y-auto pr-1">
            {userStats.customCategories.map((cat) => (
              <span
                id={`cat-badge-item-${cat}`}
                key={cat}
                className="flex items-center gap-2 bg-slate-900 border border-slate-850 text-slate-300 pl-3.5 pr-2 py-1 rounded-full text-[10px] font-bold"
              >
                {cat}
                <button
                  id={`remove-cat-btn-${cat}`}
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  className="p-0.5 rounded-full hover:bg-rose-950/40 text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Device Ring Tunes & Alarms Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-widest flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-400" /> Device Ring Tunes & Custom Alarms
          </h3>
          <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            {customTunes.length} {customTunes.length === 1 ? 'Tune' : 'Tunes'} Added
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed -mt-1">
          Import your own custom audio files from your device to use as alarm tones for habits and schedule items.
        </p>

        {/* Uploader */}
        <CustomTuneUploader />

        {/* List of Custom Tunes */}
        {customTunes.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-850">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
              Installed Device Tunes ({customTunes.length})
            </span>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {customTunes.map((tune) => {
                const isPlaying = playingSoundId === tune.id;

                return (
                  <div
                    key={tune.id}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-850 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800">
                        {tune.emoji}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-200 truncate">{tune.name}</span>
                        <span className="text-[9px] text-slate-500 truncate">
                          {tune.fileName} • {tune.fileSize}
                          {tune.durationSeconds ? ` • ${tune.durationSeconds}s` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(tune.id)}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                          isPlaying
                            ? 'bg-rose-600/20 text-rose-300 border-rose-500/40 animate-pulse'
                            : 'bg-amber-600/20 text-amber-300 border-amber-500/30 hover:bg-amber-600/30'
                        }`}
                        title={isPlaying ? 'Stop Preview' : 'Listen Preview'}
                      >
                        {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCustomTune(tune.id, tune.name)}
                        className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-rose-950/40 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete Ring Tune"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-2 text-[10px] text-slate-500">
            No custom ringtones yet. Drop or browse audio above to add ringtones from this device.
          </div>
        )}
      </div>

      {/* Credit Info footer block */}
      <div className="flex gap-2 bg-slate-900/40 p-4 border border-slate-850 rounded-2xl items-start">
        <Info className="w-4.5 h-4.5 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase">Device Encrypted Sandboxed Store</span>
          <p className="text-[9.5px] text-slate-500 leading-relaxed mt-0.5">
            Your data remains totally secure inside local browser storage cookies. Export database backups periodically to preserve history when modifying caches or cleaning software drives.
          </p>
        </div>
      </div>
    </div>
  );
}
