/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getCustomRingtones, initCustomAudioStorage, CustomRingtone } from './customAudioStorage';

export interface SoundOption {
  id: string;
  name: string;
  description: string;
  emoji: string;
  audioUrl?: string;
  isCustom?: boolean;
  fileSize?: string;
  durationSeconds?: number;
}

// Kick off custom audio storage initialization
if (typeof window !== 'undefined') {
  initCustomAudioStorage().catch(() => {});
}

export class SoundCatalog {
  static readonly BUILTIN_OPTIONS: SoundOption[] = [
    {
      id: 'music_box',
      name: 'Music Box Lullaby',
      description: 'Delicate and whimsical music box chime melody',
      emoji: '🧸',
      audioUrl: '/sounds/music_box_lullaby.wav',
    },
    {
      id: 'digital_beep',
      name: 'Digital Alarm Beep',
      description: 'Sharp repeating 4-burst digital clock alarm',
      emoji: '⏰',
      audioUrl: '/sounds/digital_alarm_beep.wav',
    },
    {
      id: 'scifi_siren',
      name: 'Sci-Fi Siren',
      description: 'Pulsing futuristic space siren sweep',
      emoji: '🛸',
      audioUrl: '/sounds/scifi_siren.wav',
    },
    {
      id: 'classic_ring',
      name: 'Classic Phone Alarm',
      description: 'Loud repeating phone alarm ringer',
      emoji: '🚨',
    },
    {
      id: 'soft_chime',
      name: 'Soft Chime',
      description: 'Calm, gentle pentatonic chime sequence',
      emoji: '🎐',
    },
    {
      id: 'zen_bell',
      name: 'Zen Tibetan Bowl',
      description: 'Deep resonant bowl vibration for peaceful focus',
      emoji: '🧘',
    },
    {
      id: 'morning_breeze',
      name: 'Morning Breeze',
      description: 'Warm soothing synth chords',
      emoji: '🌅',
    },
    {
      id: 'digital_pulse',
      name: 'Soft Digital Pulse',
      description: 'Clean modern subtle alert pulse',
      emoji: '⏱️',
    },
    {
      id: 'energetic_beep',
      name: 'Motivational Beat',
      description: 'Uplifting rhythmic completion tune',
      emoji: '⚡',
    },
  ];

  /**
   * Dynamically returns custom user device ringtones first, followed by built-in presets
   */
  static get OPTIONS(): SoundOption[] {
    const customList: SoundOption[] = getCustomRingtones().map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      emoji: c.emoji || '🎵',
      audioUrl: c.audioUrl,
      isCustom: true,
      fileSize: c.fileSize,
      durationSeconds: c.durationSeconds,
    }));
    return [...customList, ...SoundCatalog.BUILTIN_OPTIONS];
  }

  static get CUSTOM_OPTIONS(): SoundOption[] {
    return getCustomRingtones().map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      emoji: c.emoji || '🎵',
      audioUrl: c.audioUrl,
      isCustom: true,
      fileSize: c.fileSize,
      durationSeconds: c.durationSeconds,
    }));
  }
}

let audioCtx: AudioContext | null = null;
let activeAudioElements: HTMLAudioElement[] = [];
let activeOscillators: OscillatorNode[] = [];

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

let activeAlarmInterval: number | null = null;
let alarmStartTime = 0;

export function triggerVibration(soundId: string = 'classic_ring', isEscalated: boolean = false): void {
  try {
    Haptics.impact({ style: isEscalated ? ImpactStyle.Heavy : ImpactStyle.Medium }).catch(() => {});
  } catch (e) {
    // ignore
  }

  if (typeof navigator === 'undefined' || !('vibrate' in navigator) || !navigator.vibrate) {
    return;
  }

  // Base vibration patterns matching sound intensity & style
  const basePatterns: Record<string, number[]> = {
    music_box: [150, 200, 150, 200, 150, 800],
    digital_beep: [80, 40, 80, 40, 80, 40, 80, 600],
    scifi_siren: [300, 80, 300, 80, 400, 400],
    classic_ring: [200, 100, 200, 100, 200, 400],
    energetic_beep: [150, 100, 150, 100, 300],
    digital_pulse: [100, 80, 100, 600],
    morning_breeze: [300, 200, 300, 800],
    soft_chime: [200, 150, 200, 1000],
    zen_bell: [500, 1000],
  };

  // Escalated vibration patterns (higher frequency, urgent bursts, complex pulse sequences after 30 seconds)
  const escalatedPatterns: Record<string, number[]> = {
    music_box: [250, 100, 250, 100, 350, 400],
    digital_beep: [100, 30, 100, 30, 100, 30, 100, 30, 100, 300],
    scifi_siren: [450, 50, 450, 50, 500, 150],
    classic_ring: [400, 80, 400, 80, 400, 80, 400, 200],
    energetic_beep: [200, 50, 200, 50, 200, 50, 200, 150],
    digital_pulse: [150, 50, 150, 50, 150, 50, 150, 300],
    morning_breeze: [400, 100, 300, 100, 500, 500],
    soft_chime: [300, 100, 300, 100, 400, 500],
    zen_bell: [800, 200, 800, 800],
  };

  const patternMap = isEscalated ? escalatedPatterns : basePatterns;
  const pattern = patternMap[soundId] || patternMap.classic_ring;

  try {
    navigator.vibrate(pattern);
  } catch (err) {
    console.warn('Vibration API error:', err);
  }
}

export function startContinuousAlarm(soundId: string = 'classic_ring'): () => void {
  stopContinuousAlarm(); // stop any existing
  
  alarmStartTime = Date.now();

  const soundOption = SoundCatalog.OPTIONS.find((s) => s.id === soundId);

  // If custom audio with dedicated audioUrl, loop it directly for realistic alarm experience
  if (soundOption?.isCustom && soundOption?.audioUrl && typeof Audio !== 'undefined') {
    try {
      const audio = new Audio(soundOption.audioUrl);
      audio.loop = true;
      activeAudioElements.push(audio);
      audio.play().catch((e) => {
        console.warn('Continuous custom audio play error:', e);
      });

      const vibrateLoop = () => {
        const elapsed = Date.now() - alarmStartTime;
        const isEscalated = elapsed >= 30000;
        triggerVibration(soundId, isEscalated);
      };

      vibrateLoop();
      activeAlarmInterval = window.setInterval(vibrateLoop, 2500);
      return stopContinuousAlarm;
    } catch (err) {
      console.warn('Custom continuous audio playback failed, falling back:', err);
    }
  }

  const playIteration = () => {
    const elapsed = Date.now() - alarmStartTime;
    const isEscalated = elapsed >= 30000; // Escalates complexity & intensity after 30 seconds if not turned off
    
    playAlarmSound(soundId);
    triggerVibration(soundId, isEscalated);
  };

  // Play immediately
  playIteration();

  // Repeat interval depending on sound duration
  const intervalMs =
    soundId === 'zen_bell' ? 3200 :
    soundId === 'music_box' ? 4500 :
    soundId === 'morning_breeze' ? 2200 :
    soundId === 'scifi_siren' ? 2600 :
    soundId === 'digital_beep' ? 1600 : 1500;

  activeAlarmInterval = window.setInterval(playIteration, intervalMs);

  return stopContinuousAlarm;
}

export function stopContinuousAlarm(): void {
  if (activeAlarmInterval !== null) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }
  activeAudioElements.forEach((el) => {
    try {
      el.pause();
      el.currentTime = 0;
    } catch (e) {}
  });
  activeAudioElements = [];

  activeOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) {}
  });
  activeOscillators = [];

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
    try {
      navigator.vibrate(0); // Cancel any ongoing vibration pattern
    } catch (e) {
      // ignore
    }
  }
}

export function playAlarmSound(soundId: string = 'classic_ring'): void {
  const soundOption = SoundCatalog.OPTIONS.find((s) => s.id === soundId);

  // If sound has a dedicated audio file or custom audio URL, try playing it first
  if (soundOption?.audioUrl && typeof Audio !== 'undefined') {
    try {
      const audio = new Audio(soundOption.audioUrl);
      activeAudioElements.push(audio);
      audio.onended = () => {
        activeAudioElements = activeAudioElements.filter((a) => a !== audio);
      };
      audio.onerror = (e) => {
        console.warn('Audio element error, falling back:', e);
        activeAudioElements = activeAudioElements.filter((a) => a !== audio);
        playSynthesizedAlarm(soundId);
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play failed, falling back:', err);
          // Autoplay blocked or decode issue, fall back immediately to Web Audio synthesis
          activeAudioElements = activeAudioElements.filter((a) => a !== audio);
          playSynthesizedAlarm(soundId);
        });
      }
      return;
    } catch (e) {
      // Fall through to synthesized Web Audio
    }
  }

  playSynthesizedAlarm(soundId);
}

function playSynthesizedAlarm(soundId: string): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const trackOsc = (osc: OscillatorNode) => {
      activeOscillators.push(osc);
      osc.onended = () => {
        activeOscillators = activeOscillators.filter((o) => o !== osc);
      };
    };

    switch (soundId) {
      case 'music_box': {
        // Delicate, nostalgic music box lullaby arpeggios
        // E5, G#5, B5, E6, D#6, B5, G#5, F#5, A5, C#6, E6
        const melody = [
          { f: 659.25, t: 0.0, d: 1.2 },
          { f: 830.61, t: 0.35, d: 1.1 },
          { f: 987.77, t: 0.7, d: 1.1 },
          { f: 1318.51, t: 1.05, d: 1.5 },
          { f: 1174.66, t: 1.5, d: 1.2 },
          { f: 987.77, t: 1.85, d: 1.1 },
          { f: 830.61, t: 2.2, d: 1.1 },
          { f: 739.99, t: 2.65, d: 1.3 },
          { f: 880.0, t: 3.0, d: 1.2 },
          { f: 1108.73, t: 3.35, d: 1.4 },
          { f: 1318.51, t: 3.8, d: 1.8 },
        ];

        melody.forEach((note) => {
          const startTime = now + note.t;
          // Fundamental tine
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(note.f, startTime);

          // Metallic bell overtone (2.75x ratio characteristic of music box tines)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(note.f * 2.756, startTime);

          gain1.gain.setValueAtTime(0.001, startTime);
          gain1.gain.linearRampToValueAtTime(0.25, startTime + 0.015);
          gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + note.d);

          gain2.gain.setValueAtTime(0.001, startTime);
          gain2.gain.linearRampToValueAtTime(0.08, startTime + 0.01);
          gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + note.d * 0.4);

          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);

          trackOsc(osc1);
          trackOsc(osc2);

          osc1.start(startTime);
          osc2.start(startTime);
          osc1.stop(startTime + note.d);
          osc2.stop(startTime + note.d);
        });
        break;
      }

      case 'digital_beep': {
        // Classic 4-burst digital clock alarm (beep-beep-beep-beep)
        const beeps = [0, 0.11, 0.22, 0.33, 0.7, 0.81, 0.92, 1.03];
        beeps.forEach((delay) => {
          const startTime = now + delay;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'square';
          osc.frequency.setValueAtTime(2048, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.28, startTime + 0.005);
          gain.gain.setValueAtTime(0.28, startTime + 0.06);
          gain.gain.linearRampToValueAtTime(0.001, startTime + 0.065);

          osc.connect(gain);
          gain.connect(ctx.destination);

          trackOsc(osc);
          osc.start(startTime);
          osc.stop(startTime + 0.07);
        });
        break;
      }

      case 'scifi_siren': {
        // Dual-oscillator frequency modulated sci-fi laser siren sweep
        [0, 0.75, 1.5].forEach((offset) => {
          const startTime = now + offset;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sawtooth';
          osc2.type = 'sine';

          // Swoop up from 550Hz to 1650Hz, then quick curve
          osc1.frequency.setValueAtTime(550, startTime);
          osc1.frequency.exponentialRampToValueAtTime(1650, startTime + 0.35);
          osc1.frequency.exponentialRampToValueAtTime(650, startTime + 0.65);

          osc2.frequency.setValueAtTime(560, startTime);
          osc2.frequency.exponentialRampToValueAtTime(1675, startTime + 0.35);
          osc2.frequency.exponentialRampToValueAtTime(660, startTime + 0.65);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.28, startTime + 0.05);
          gain.gain.setValueAtTime(0.28, startTime + 0.55);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.68);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          trackOsc(osc1);
          trackOsc(osc2);

          osc1.start(startTime);
          osc2.start(startTime);
          osc1.stop(startTime + 0.7);
          osc2.stop(startTime + 0.7);
        });
        break;
      }

      case 'classic_ring': {
        // High-energy dual-tone phone alarm ringer
        [0, 0.15, 0.3, 0.45, 0.6].forEach((offset) => {
          const startTime = now + offset;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sawtooth';
          osc2.type = 'square';

          osc1.frequency.setValueAtTime(850, startTime);
          osc2.frequency.setValueAtTime(950, startTime);

          gain.gain.setValueAtTime(0.35, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          trackOsc(osc1);
          trackOsc(osc2);

          osc1.start(startTime);
          osc2.start(startTime);
          osc1.stop(startTime + 0.1);
          osc2.stop(startTime + 0.1);
        });
        break;
      }

      case 'zen_bell': {
        // Deep warm bowl tone (174 Hz Solfeggio frequency style)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(174, now);
        
        // Harmonics
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(348, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.4, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

        gain2.gain.setValueAtTime(0.01, now);
        gain2.gain.exponentialRampToValueAtTime(0.15, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        trackOsc(osc);
        trackOsc(osc2);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 3.0);
        osc2.stop(now + 2.5);
        break;
      }

      case 'morning_breeze': {
        // Arpeggiated gentle warm chord (E Major 7)
        const freqs = [329.63, 415.3, 493.88, 622.25, 659.25]; // E4, G#4, B4, D#5, E5
        freqs.forEach((freq, index) => {
          const startTime = now + index * 0.18;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.2, startTime + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

          osc.connect(gain);
          gain.connect(ctx.destination);

          trackOsc(osc);
          osc.start(startTime);
          osc.stop(startTime + 1.2);
        });
        break;
      }

      case 'digital_pulse': {
        // Clean double pulse
        [0, 0.2, 0.4].forEach((delay) => {
          const startTime = now + delay;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, startTime);
          osc.frequency.exponentialRampToValueAtTime(440, startTime + 0.12);

          gain.gain.setValueAtTime(0.25, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

          osc.connect(gain);
          gain.connect(ctx.destination);

          trackOsc(osc);
          osc.start(startTime);
          osc.stop(startTime + 0.13);
        });
        break;
      }

      case 'energetic_beep': {
        // Uplifting ascending major triad
        const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        freqs.forEach((freq, idx) => {
          const startTime = now + idx * 0.12;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.3, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

          osc.connect(gain);
          gain.connect(ctx.destination);

          trackOsc(osc);
          osc.start(startTime);
          osc.stop(startTime + 0.26);
        });
        break;
      }

      case 'soft_chime':
      default: {
        // Soothing pentatonic chime (A4, C5, D5, E5, G5)
        const notes = [440, 523.25, 587.33, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.15;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.0);

          osc.connect(gain);
          gain.connect(ctx.destination);

          trackOsc(osc);
          osc.start(startTime);
          osc.stop(startTime + 1.0);
        });
        break;
      }
    }
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}
