import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 44100;

function createWavBuffer(samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.floor(intSample), offset);
    offset += 2;
  }

  return buffer;
}

// 1. Music Box Lullaby (Gentle music box chime arpeggios with metallic resonance)
function generateMusicBoxLullaby() {
  const durationSec = 8.0;
  const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(totalSamples);

  // Melody notes (freq, startSec, durationSec, velocity)
  // E5, G#5, B5, E6, B5, G#5, F#5, A5, C#6, E6, D#6, B5, G#5, E5
  const notes = [
    { f: 659.25, t: 0.0, d: 1.8, v: 0.7 },   // E5
    { f: 830.61, t: 0.35, d: 1.6, v: 0.65 },  // G#5
    { f: 987.77, t: 0.7, d: 1.5, v: 0.6 },   // B5
    { f: 1318.51, t: 1.05, d: 2.0, v: 0.75 }, // E6
    { f: 1174.66, t: 1.6, d: 1.5, v: 0.65 },  // D#6
    { f: 987.77, t: 2.0, d: 1.5, v: 0.6 },    // B5
    { f: 830.61, t: 2.4, d: 1.6, v: 0.55 },   // G#5
    { f: 739.99, t: 2.9, d: 1.8, v: 0.65 },   // F#5
    { f: 880.00, t: 3.25, d: 1.6, v: 0.65 },  // A5
    { f: 1108.73, t: 3.6, d: 1.8, v: 0.7 },   // C#6
    { f: 1318.51, t: 4.1, d: 2.2, v: 0.8 },   // E6
    { f: 1479.98, t: 4.8, d: 1.8, v: 0.7 },   // F#6
    { f: 1318.51, t: 5.3, d: 2.0, v: 0.65 },  // E6
    { f: 987.77, t: 5.8, d: 2.2, v: 0.6 },    // B5
    { f: 659.25, t: 6.3, d: 2.5, v: 0.75 },   // E5
  ];

  for (const n of notes) {
    const startIdx = Math.floor(n.t * SAMPLE_RATE);
    const len = Math.floor(n.d * SAMPLE_RATE);
    for (let i = 0; i < len && startIdx + i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      // Music box tine physical model: fundamental + 2.75x chime overtone + 5.4x subtle chime
      const decay1 = Math.exp(-t * 3.2);
      const decay2 = Math.exp(-t * 7.5);
      const decay3 = Math.exp(-t * 12.0);

      const f1 = n.f;
      const f2 = n.f * 2.756;
      const f3 = n.f * 5.404;

      const wave =
        Math.sin(2 * Math.PI * f1 * t) * decay1 * 0.7 +
        Math.sin(2 * Math.PI * f2 * t) * decay2 * 0.22 +
        Math.sin(2 * Math.PI * f3 * t) * decay3 * 0.08;

      samples[startIdx + i] += wave * n.v * 0.45;
    }
  }

  return samples;
}

// 2. Digital Alarm Beep (Classic rapid 4-beep digital clock buzzer repeating)
function generateDigitalAlarmBeep() {
  const durationSec = 6.0;
  const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(totalSamples);

  const freq = 2048; // Classic digital watch/alarm piezo frequency
  const beepDur = 0.065; // 65ms per beep
  const beepGap = 0.045; // 45ms silence between burst beeps
  const burstInterval = 0.85; // 850ms between bursts

  for (let burst = 0; burst < 7; burst++) {
    const burstStart = burst * burstInterval;
    for (let b = 0; b < 4; b++) {
      const startT = burstStart + b * (beepDur + beepGap);
      const startIdx = Math.floor(startT * SAMPLE_RATE);
      const beepLen = Math.floor(beepDur * SAMPLE_RATE);

      for (let i = 0; i < beepLen && startIdx + i < totalSamples; i++) {
        const t = i / SAMPLE_RATE;
        // Square wave with mild low-pass / edge smoothing for pleasant crispness
        const rawSquare = Math.sin(2 * Math.PI * freq * t) >= 0 ? 0.6 : -0.6;
        // Small attack/release ramp to avoid click
        const env = Math.min(1, Math.min(i / 100, (beepLen - i) / 100));
        samples[startIdx + i] += rawSquare * env * 0.55;
      }
    }
  }

  return samples;
}

// 3. Sci-Fi Siren (Futuristic oscillating pitch laser siren)
function generateSciFiSiren() {
  const durationSec = 6.0;
  const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(totalSamples);

  let phase1 = 0;
  let phase2 = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Repeating 0.75 second siren cycle
    const cycleT = (t % 0.75) / 0.75; // 0 to 1
    // Swoop up from 550Hz to 1650Hz, then quick drop
    const sweep = Math.sin(cycleT * Math.PI); // bell curve / swoop
    const freq = 550 + Math.pow(sweep, 1.4) * 1100;
    const freq2 = freq * 1.015; // subtle detuned oscillator for sci-fi phasing

    phase1 += (2 * Math.PI * freq) / SAMPLE_RATE;
    phase2 += (2 * Math.PI * freq2) / SAMPLE_RATE;

    const wave1 = Math.sin(phase1);
    const wave2 = (phase2 % (2 * Math.PI)) / Math.PI - 1; // subtle sawtooth component
    const wave = wave1 * 0.7 + wave2 * 0.3;

    // Amplitude pulse
    const amp = 0.5 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 4 * t));
    samples[i] = wave * amp * 0.6;
  }

  return samples;
}

const outDir = path.resolve('public/sounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'music_box_lullaby.wav'), createWavBuffer(generateMusicBoxLullaby()));
fs.writeFileSync(path.join(outDir, 'digital_alarm_beep.wav'), createWavBuffer(generateDigitalAlarmBeep()));
fs.writeFileSync(path.join(outDir, 'scifi_siren.wav'), createWavBuffer(generateSciFiSiren()));

console.log('Successfully generated alarm sound WAV files in public/sounds/');
