/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, Music, AlertCircle, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import { addCustomRingtone, CustomRingtone, sanitizeRingtoneName, formatBytes } from '../utils/customAudioStorage';
import { playAlarmSound, stopContinuousAlarm } from '../utils/audio';

interface CustomTuneUploaderProps {
  onTuneAdded?: (newTune: CustomRingtone) => void;
  compact?: boolean;
}

const EMOJI_PRESETS = ['🎵', '🔔', '🎸', '🎹', '🎷', '🎺', '🎧', '🔊', '✨', '⚡'];

export default function CustomTuneUploader({ onTuneAdded, compact = false }: CustomTuneUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Staged file for naming and emoji selection
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [tuneTitle, setTuneTitle] = useState('');
  const [tuneEmoji, setTuneEmoji] = useState('🎵');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
    // Reset file input value so selecting the same file again works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processSelectedFile = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate audio extension / mime
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|weba|wma)$/i.test(file.name);
    if (!isAudio && file.type) {
      setErrorMessage('Unsupported file type. Please choose an audio file (MP3, WAV, M4A, OGG, AAC, FLAC).');
      return;
    }

    // Check size limit (25MB)
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage(`File is too large (${formatBytes(file.size)}). Max allowed size is 25MB.`);
      return;
    }

    setStagedFile(file);
    setTuneTitle(sanitizeRingtoneName(file.name));
    setTuneEmoji('🎵');
  };

  const handleConfirmAddTune = async () => {
    if (!stagedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const finalTitle = tuneTitle.trim() || sanitizeRingtoneName(stagedFile.name);
      const newTune = await addCustomRingtone(stagedFile, finalTitle, tuneEmoji);

      // Brief test sound preview
      try {
        stopContinuousAlarm();
        playAlarmSound(newTune.id);
        setTimeout(() => {
          stopContinuousAlarm();
        }, 3000);
      } catch {}

      setSuccessMessage(`Added "${newTune.name}" to your ring tunes!`);
      setStagedFile(null);
      setTuneTitle('');

      if (onTuneAdded) {
        onTuneAdded(newTune);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to import audio file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelStaged = () => {
    setStagedFile(null);
    setTuneTitle('');
    setErrorMessage(null);
  };

  return (
    <div id="custom-tune-uploader-container" className="flex flex-col gap-2.5">
      {/* Hidden manual file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba"
        onChange={handleFileChange}
        className="hidden"
        id="device-ringtone-file-input"
      />

      {/* Main Drag & Drop / Click Zone */}
      {!stagedFile ? (
        <div
          id="custom-tune-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group ${
            isDragging
              ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
              : 'border-slate-800 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-950/70'
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UploadCloud className="w-5 h-5" />
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs font-black text-slate-200 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
              <span>Add Custom Tune From Device</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Drag & drop audio here, or <span className="text-indigo-400 underline font-semibold">browse files</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
            {['MP3', 'WAV', 'M4A', 'OGG', 'AAC'].map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-0.5 rounded-md text-[8px] font-extrabold bg-slate-900 border border-slate-800 text-slate-400 uppercase tracking-wider"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* Staged File Editor (Rename & Pick Emoji before saving) */
        <div
          id="staged-tune-dialog"
          className="bg-slate-950 border border-indigo-500/40 rounded-2xl p-4 flex flex-col gap-3 shadow-lg shadow-indigo-950/30 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{tuneEmoji}</span>
              <div>
                <span className="text-xs font-black text-white block truncate max-w-[200px]">
                  {stagedFile.name}
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  {formatBytes(stagedFile.size)} • Ready to import
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancelStaged}
              className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title Editor */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-black text-indigo-400 tracking-wider">
              Tune Display Name
            </label>
            <input
              id="tune-title-input"
              type="text"
              value={tuneTitle}
              onChange={(e) => setTuneTitle(e.target.value)}
              placeholder="e.g. My Morning Alarm"
              maxLength={35}
              className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white font-bold outline-none focus:border-indigo-500"
            />
          </div>

          {/* Emoji Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider">
              Choose Icon
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setTuneEmoji(em)}
                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                    tuneEmoji === em
                      ? 'bg-indigo-600 text-white scale-110 shadow-md'
                      : 'bg-slate-900 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-900">
            <button
              type="button"
              onClick={handleCancelStaged}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl text-[11px] font-bold transition-all"
            >
              Cancel
            </button>
            <button
              id="confirm-import-tune-btn"
              type="button"
              onClick={handleConfirmAddTune}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Music className="w-3.5 h-3.5" />
                  <span>Save Ring Tune</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-850 text-rose-300 text-[11px] font-medium animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-850 text-emerald-300 text-[11px] font-medium animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
}
