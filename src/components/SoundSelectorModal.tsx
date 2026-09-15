/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Volume2, Play, Square, Check, Sparkles, Music, Bell, Trash2, Smartphone, Disc3 } from 'lucide-react';
import { SoundCatalog, playAlarmSound, stopContinuousAlarm, SoundOption } from '../utils/audio';
import { deleteCustomRingtone, subscribeCustomAudioChanges, CustomRingtone } from '../utils/customAudioStorage';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import CustomTuneUploader from './CustomTuneUploader';

interface SoundSelectorModalProps {
  selectedSoundId: string;
  onSelectSound: (soundId: string) => void;
  onClose: () => void;
}

export default function SoundSelectorModal({
  selectedSoundId,
  onSelectSound,
  onClose,
}: SoundSelectorModalProps) {
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [customTunes, setCustomTunes] = useState<CustomRingtone[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'custom' | 'builtin'>('all');

  useEffect(() => {
    const unsubscribe = subscribeCustomAudioChanges((tunes) => {
      setCustomTunes(tunes);
    });
    return () => {
      stopContinuousAlarm();
      unsubscribe();
    };
  }, []);

  const handleTogglePlay = (soundId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } catch (err) {}

    if (playingSoundId === soundId) {
      stopContinuousAlarm();
      setPlayingSoundId(null);
    } else {
      stopContinuousAlarm();
      playAlarmSound(soundId);
      setPlayingSoundId(soundId);

      // Auto reset playing status after preview duration
      const isCustom = soundId.startsWith('custom_');
      const customItem = customTunes.find((c) => c.id === soundId);
      const timeoutMs = isCustom
        ? (customItem?.durationSeconds ? Math.min(customItem.durationSeconds * 1000, 10000) : 6000)
        : soundId === 'music_box'
        ? 4500
        : soundId === 'zen_bell'
        ? 3200
        : soundId === 'scifi_siren'
        ? 2400
        : 2500;

      setTimeout(() => {
        setPlayingSoundId((curr) => (curr === soundId ? null : curr));
      }, timeoutMs);
    }
  };

  const handleSelect = (soundId: string) => {
    try {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } catch (err) {}

    stopContinuousAlarm();
    onSelectSound(soundId);
    onClose();
  };

  const handleDeleteCustomTune = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete custom ringtune "${name}" from your device library?`)) {
      if (playingSoundId === id) {
        stopContinuousAlarm();
        setPlayingSoundId(null);
      }
      await deleteCustomRingtone(id);
      if (selectedSoundId === id) {
        onSelectSound('classic_ring');
      }
    }
  };

  const handleCustomTuneAdded = (newTune: CustomRingtone) => {
    // Automatically select the newly imported tune
    onSelectSound(newTune.id);
  };

  const builtInSounds = SoundCatalog.BUILTIN_OPTIONS;

  return (
    <div id="sound-selector-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 sm:px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                Alarm Tunes & Ring Tones <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                Pick a built-in chime or add custom ringtones from your device
              </p>
            </div>
          </div>

          <button
            id="close-sound-modal-btn"
            type="button"
            onClick={() => {
              stopContinuousAlarm();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col gap-4 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Uploader Section */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Import From Device
            </span>
            <CustomTuneUploader onTuneAdded={handleCustomTuneAdded} />
          </div>

          {/* Section Filter Pills */}
          {customTunes.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Tunes ({customTunes.length + builtInSounds.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'custom'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>My Device Tunes ({customTunes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('builtin')}
                className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'builtin'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Disc3 className="w-3 h-3" />
                <span>Presets ({builtInSounds.length})</span>
              </button>
            </div>
          )}

          {/* 1. Custom Device Ringtones List */}
          {(activeTab === 'all' || activeTab === 'custom') && customTunes.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Your Custom Device Tunes ({customTunes.length})
                </span>
                <span className="text-[9px] text-slate-500 font-semibold">Stored locally on device</span>
              </div>

              <div className="flex flex-col gap-2">
                {customTunes.map((snd) => {
                  const isSelected = selectedSoundId === snd.id;
                  const isPlaying = playingSoundId === snd.id;

                  return (
                    <div
                      id={`sound-tune-card-${snd.id}`}
                      key={snd.id}
                      onClick={() => handleSelect(snd.id)}
                      className={`group relative p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-950/40 via-indigo-950/50 to-slate-900 border-amber-500/60 ring-2 ring-amber-500/30 shadow-lg shadow-amber-950/20'
                          : 'bg-slate-950/60 border-slate-850 hover:border-slate-750 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Left: Emoji & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105 shadow-inner ${
                            isSelected
                              ? 'bg-amber-600/20 border border-amber-500/40 text-white'
                              : 'bg-slate-900 border border-slate-800'
                          }`}
                        >
                          {snd.emoji}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white truncate">{snd.name}</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                              Device Tune
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 truncate mt-0.5">
                            {snd.fileName} • {snd.fileSize}
                            {snd.durationSeconds ? ` • ${snd.durationSeconds}s` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isPlaying && (
                          <div className="flex items-end gap-1 h-5 px-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <div className="w-1 bg-amber-400 rounded-full animate-bounce h-full" style={{ animationDuration: '400ms' }} />
                            <div className="w-1 bg-amber-300 rounded-full animate-bounce h-3" style={{ animationDuration: '600ms' }} />
                            <div className="w-1 bg-yellow-400 rounded-full animate-bounce h-4" style={{ animationDuration: '350ms' }} />
                          </div>
                        )}

                        <button
                          id={`preview-sound-btn-${snd.id}`}
                          type="button"
                          onClick={(e) => handleTogglePlay(snd.id, e)}
                          className={`p-2 rounded-xl border font-bold text-xs flex items-center justify-center transition-all ${
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
                          onClick={(e) => handleDeleteCustomTune(snd.id, snd.name, e)}
                          className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-rose-950/40 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete Custom Tune"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Built-in Preset Tones List */}
          {(activeTab === 'all' || activeTab === 'builtin') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Disc3 className="w-3.5 h-3.5 text-indigo-400" /> Built-in Sound Presets ({builtInSounds.length})
                </span>
                <span className="text-[9px] text-slate-500 font-semibold">Web Audio & HD Chimes</span>
              </div>

              <div className="flex flex-col gap-2">
                {builtInSounds.map((snd) => {
                  const isSelected = selectedSoundId === snd.id;
                  const isPlaying = playingSoundId === snd.id;

                  return (
                    <div
                      id={`sound-tune-card-${snd.id}`}
                      key={snd.id}
                      onClick={() => handleSelect(snd.id)}
                      className={`group relative p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-950/60 to-slate-900 border-indigo-500/60 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/50'
                          : 'bg-slate-950/60 border-slate-850 hover:border-slate-750 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Left: Emoji & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105 shadow-inner ${
                            isSelected ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' : 'bg-slate-900 border border-slate-800'
                          }`}
                        >
                          {snd.emoji}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white truncate">{snd.name}</span>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 truncate mt-0.5">{snd.description}</span>
                        </div>
                      </div>

                      {/* Right: Soundwave & Play Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isPlaying && (
                          <div className="flex items-end gap-1 h-5 px-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <div className="w-1 bg-indigo-400 rounded-full animate-bounce h-full" style={{ animationDuration: '400ms' }} />
                            <div className="w-1 bg-indigo-300 rounded-full animate-bounce h-3" style={{ animationDuration: '600ms' }} />
                            <div className="w-1 bg-violet-400 rounded-full animate-bounce h-4" style={{ animationDuration: '350ms' }} />
                          </div>
                        )}

                        <button
                          id={`preview-sound-btn-${snd.id}`}
                          type="button"
                          onClick={(e) => handleTogglePlay(snd.id, e)}
                          className={`p-2 rounded-xl border font-bold text-xs flex items-center justify-center transition-all ${
                            isPlaying
                              ? 'bg-rose-600/20 text-rose-300 border-rose-500/40 animate-pulse'
                              : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/40'
                          }`}
                          title={isPlaying ? 'Stop Preview' : 'Listen Preview'}
                        >
                          {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        </button>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={() => {
              stopContinuousAlarm();
              onClose();
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-indigo-600/20"
          >
            Done Selecting Tune
          </button>
        </div>

      </div>
    </div>
  );
}
