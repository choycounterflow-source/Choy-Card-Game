// Synthesized Web Audio FX + Ambient VIP Lounge Music Engine
// Supports independent Music and Sound Effects (SFX) toggles and volume levels (0.0 – 1.0)

let ctx: AudioContext | null = null;
let sfxGainNode: GainNode | null = null;
let musicGainNode: GainNode | null = null;

let sfxEnabled = true;
let sfxVolume = 0.8; // 0..1
let musicEnabled = true;
let musicVolume = 0.35; // 0..1

let musicTimerId: number | null = null;
let musicStepIndex = 0;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();

    sfxGainNode = ctx.createGain();
    sfxGainNode.gain.value = sfxEnabled ? sfxVolume : 0;
    sfxGainNode.connect(ctx.destination);

    musicGainNode = ctx.createGain();
    musicGainNode.gain.value = musicEnabled ? musicVolume * 0.28 : 0;
    musicGainNode.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function getSfxBus(): { c: AudioContext; out: AudioNode } | null {
  if (!sfxEnabled || sfxVolume <= 0) return null;
  const c = ensureAudioContext();
  if (!c || !sfxGainNode) return null;
  return { c, out: sfxGainNode };
}

function syncGains(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (sfxGainNode) {
    sfxGainNode.gain.cancelScheduledValues(now);
    sfxGainNode.gain.setTargetAtTime(sfxEnabled ? sfxVolume : 0, now, 0.02);
  }
  if (musicGainNode) {
    musicGainNode.gain.cancelScheduledValues(now);
    // Scale music gain gently so it sits comfortably beneath card & win SFX
    musicGainNode.gain.setTargetAtTime(musicEnabled ? musicVolume * 0.28 : 0, now, 0.06);
  }
}

// Warm emerald lounge chord progression (Cmaj9 -> Am9 -> Dm9 -> G13)
const LOUNGE_CHORDS: Array<{ bass: number; notes: number[] }> = [
  { bass: 130.81, notes: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
  { bass: 110.0, notes: [220.0, 261.63, 329.63, 392.0] },   // Am7
  { bass: 146.83, notes: [293.66, 349.23, 440.0, 523.25] }, // Dm7
  { bass: 196.0, notes: [246.94, 349.23, 392.0, 440.0] },   // G9
];

function scheduleLoungeBar(): void {
  if (!musicEnabled || musicVolume <= 0) return;
  if (!ctx || !musicGainNode || ctx.state !== 'running') return;

  const chord = LOUNGE_CHORDS[musicStepIndex % LOUNGE_CHORDS.length];
  musicStepIndex = (musicStepIndex + 1) % LOUNGE_CHORDS.length;

  const now = ctx.currentTime;
  const barDur = 2.6;

  // Soft low-pass filter for warm Rhodes lounge pad tone
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(950, now);
  filter.connect(musicGainNode);

  // Warm bass pulse
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bassOsc.type = 'sine';
  bassOsc.frequency.setValueAtTime(chord.bass, now);
  bassGain.gain.setValueAtTime(0.001, now);
  bassGain.gain.linearRampToValueAtTime(0.24, now + 0.14);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + barDur - 0.08);
  bassOsc.connect(bassGain);
  bassGain.connect(filter);
  bassOsc.start(now);
  bassOsc.stop(now + barDur);

  // Staggered lounge electric-piano pad notes
  chord.notes.forEach((freq, idx) => {
    const start = now + idx * 0.09;
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(0.085, start + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, start + barDur - 0.15);
    osc.connect(g);
    g.connect(filter);
    osc.start(start);
    osc.stop(start + barDur);
  });
}

function updateMusicLoopState(): void {
  if (typeof window === 'undefined') return;
  const shouldPlay = musicEnabled && musicVolume > 0;

  if (!shouldPlay) {
    if (musicTimerId !== null) {
      window.clearInterval(musicTimerId);
      musicTimerId = null;
    }
    return;
  }

  if (ctx && ctx.state === 'running' && musicTimerId === null) {
    scheduleLoungeBar();
    musicTimerId = window.setInterval(scheduleLoungeBar, 2600);
  }
}

/**
 * Call inside any user gesture (pointerdown / click / keydown) to unlock the Web Audio API
 * and begin ambient background music if enabled.
 */
export function unlockAudioEngine(): void {
  const c = ensureAudioContext();
  if (!c) return;
  syncGains();
  if (c.state === 'suspended') {
    c.resume()
      .then(() => {
        syncGains();
        updateMusicLoopState();
      })
      .catch(() => {});
  } else {
    updateMusicLoopState();
  }
}

export function setSfxSettings(enabled: boolean, volume01: number): void {
  sfxEnabled = enabled;
  sfxVolume = Math.max(0, Math.min(1, Number.isFinite(volume01) ? volume01 : 0.8));
  syncGains();
}

export function setMusicSettings(enabled: boolean, volume01: number): void {
  musicEnabled = enabled;
  musicVolume = Math.max(0, Math.min(1, Number.isFinite(volume01) ? volume01 : 0.35));
  if (musicEnabled && musicVolume > 0 && ctx) {
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        syncGains();
        updateMusicLoopState();
      }).catch(() => {});
    } else {
      syncGains();
      updateMusicLoopState();
    }
  } else {
    syncGains();
    updateMusicLoopState();
  }
}

export function getAudioEngineState(): {
  sfxEnabled: boolean;
  sfxVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
} {
  return { sfxEnabled, sfxVolume, musicEnabled, musicVolume };
}

// Backwards-compatible helpers
export function setAudioMuted(next: boolean): void {
  sfxEnabled = !next;
  musicEnabled = !next;
  syncGains();
  updateMusicLoopState();
}

export function isAudioMuted(): boolean {
  return !sfxEnabled && !musicEnabled;
}

// ==================== TABLE & UI SOUND EFFECTS ====================

export function playCardSelect(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(640, now);
  osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.05);
}

export function playCardDrop(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;

  // Low tactile felt thump + crisp paper snap
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.13);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.14);

  // Brief noise burst for crisp card slap
  const bufferSize = Math.floor(c.sampleRate * 0.05);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400;
  const nGain = c.createGain();
  nGain.gain.setValueAtTime(0.24, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(out);
  noise.start(now);
}

export function playCardDraw(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(580, now + 0.08);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.09);
}

export function playCardDealBurst(): void {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => playCardDraw(), i * 55);
  }
}

export function playMeldChime(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const now = c.currentTime + i * 0.065;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.23);
  });
}

export function playChipClink(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2200, now);
  osc.frequency.exponentialRampToValueAtTime(1450, now + 0.07);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.08);
}

export function playDiceRoll(): void {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const bus = getSfxBus();
      if (!bus) return;
      const { c, out } = bus;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180 + Math.random() * 240, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.045);
    }, i * 70);
  }
}

export function playWinFanfare(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const chord = [523.25, 659.25, 783.99, 1046.5];
  chord.forEach((freq, idx) => {
    const now = c.currentTime + idx * 0.08;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.38);
  });
}

// ==================== SUPER ACE 6×5 SLOT MACHINE FX ====================

export function playSlotSpinStart(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  for (let i = 0; i < 6; i++) {
    const t = now + i * 0.032;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + i * 55, t);
    osc.frequency.exponentialRampToValueAtTime(160 + i * 40, t + 0.028);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.032);
  }
}

export function playReelStop(colIndex: number): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  const baseFreq = 190 + colIndex * 22;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(75, now + 0.075);
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.085);
}

export function playCardBreak(comboStep: number): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  const root = scale[Math.min(comboStep, scale.length - 1)];

  // Crisp glass/card shatter sparkle + harmonic chime
  [root, root * 1.25, root * 1.5].forEach((freq, idx) => {
    const t = now + idx * 0.04;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.24);
  });
}

export function playGoldenTransform(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const notes = [880, 1108.73, 1318.5, 1760];
  notes.forEach((freq, idx) => {
    const t = now + idx * 0.045;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

export function playScatterDrop(scatterNumber: number): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const pitch = scatterNumber === 1 ? 587.33 : scatterNumber === 2 ? 739.99 : 987.77;

  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc2.type = 'sine';
  osc.frequency.setValueAtTime(pitch, now);
  osc2.frequency.setValueAtTime(pitch * 1.5, now);
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.45);
  osc2.stop(now + 0.45);
}

export type SlotCelebrationAudioTier =
  | 'big'
  | 'super'
  | 'excellent'
  | 'scatter'
  | 'bonus_complete';

export function playBigWinFanfare(): void {
  playSlotCelebrationFanfare('big');
}

export function playSlotCelebrationFanfare(tier: SlotCelebrationAudioTier): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const start = c.currentTime;

  const scheduleTone = (
    freq: number,
    offset: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'triangle',
  ) => {
    const t = start + offset;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  };

  if (tier === 'big') {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      scheduleTone(freq, idx * 0.07, 0.44, 0.22, 'triangle');
      scheduleTone(freq * 2, idx * 0.07 + 0.02, 0.2, 0.06, 'sine');
    });
    return;
  }

  if (tier === 'super') {
    const arpeggio = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98, 2093.0];
    arpeggio.forEach((freq, idx) => {
      scheduleTone(freq, idx * 0.065, 0.5, 0.22, 'triangle');
      scheduleTone(freq * 1.5, idx * 0.065 + 0.03, 0.28, 0.09, 'sine');
    });
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      scheduleTone(freq, 0.52, 0.75, 0.14, 'sawtooth');
    });
    return;
  }

  if (tier === 'excellent') {
    scheduleTone(130.81, 0, 0.55, 0.28, 'sine');
    scheduleTone(196.0, 0.36, 0.55, 0.25, 'sine');
    const fanfare = [
      { f: 523.25, t: 0.0 },
      { f: 659.25, t: 0.07 },
      { f: 783.99, t: 0.14 },
      { f: 1046.5, t: 0.22 },
      { f: 987.77, t: 0.34 },
      { f: 1174.66, t: 0.42 },
      { f: 1318.51, t: 0.5 },
      { f: 1567.98, t: 0.6 },
      { f: 2093.0, t: 0.72 },
    ];
    fanfare.forEach(({ f, t }) => {
      scheduleTone(f, t, 0.56, 0.23, 'triangle');
      scheduleTone(f * 2, t + 0.02, 0.24, 0.08, 'sine');
    });
    [523.25, 659.25, 783.99, 1046.5, 1174.66, 1567.98].forEach((freq) => {
      scheduleTone(freq, 0.82, 0.95, 0.13, 'triangle');
    });
    [2349.32, 2637.02, 3135.96].forEach((freq, i) => {
      scheduleTone(freq, 0.92 + i * 0.09, 0.26, 0.09, 'sine');
    });
    return;
  }

  if (tier === 'scatter') {
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    notes.forEach((freq, idx) => {
      scheduleTone(freq, idx * 0.075, 0.42, 0.21, 'triangle');
      scheduleTone(freq * 1.5, idx * 0.075 + 0.02, 0.22, 0.07, 'sine');
    });
    return;
  }

  // bonus_complete
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  notes.forEach((freq, idx) => {
    scheduleTone(freq, idx * 0.08, 0.48, 0.2, 'triangle');
  });
}

export function playOdometerTick(): void {
  const bus = getSfxBus();
  if (!bus) return;
  const { c, out } = bus;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400 + Math.random() * 300, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.015);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.02);
}
