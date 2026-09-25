"use client";

import { getPrefs } from "./prefs";

/**
 * Procedural sound (Web Audio, no asset files) and haptics. Both respect the
 * player's toggles. iOS Safari has no Vibration API, so haptics are a no-op there.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!getPrefs().sound || typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a user gesture so iOS allows audio later. */
export function unlockAudio() {
  audio();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { delay?: number; gain?: number; freq?: number; q?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = opts.freq ?? 2500;
  filter.Q.value = opts.q ?? 1.2;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.35;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  diceShake() {
    for (let i = 0; i < 7; i++) noise(0.05, { delay: i * 0.075, freq: 1800 + Math.random() * 1600, gain: 0.25 });
  },
  diceLand() {
    noise(0.07, { freq: 900, gain: 0.5 });
    noise(0.05, { delay: 0.09, freq: 1300, gain: 0.3 });
    tone(140, 0.12, { type: "triangle", gain: 0.25, slide: 0.6 });
  },
  tileFlip(delay = 0) {
    tone(210, 0.14, { type: "triangle", gain: 0.3, slide: 0.55, delay });
    noise(0.04, { delay, freq: 600, gain: 0.3 });
  },
  select() {
    tone(660, 0.06, { type: "sine", gain: 0.08 });
  },
  turn() {
    tone(660, 0.14, { gain: 0.15 });
    tone(990, 0.2, { gain: 0.14, delay: 0.12 });
  },
  blocked() {
    tone(330, 0.25, { type: "sawtooth", gain: 0.08 });
    tone(247, 0.4, { type: "sawtooth", gain: 0.08, delay: 0.22, slide: 0.8 });
  },
  shutTheBox() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: "triangle", gain: 0.16, delay: i * 0.09 }));
    for (let i = 0; i < 10; i++) tone(1800 + Math.random() * 1600, 0.08, { gain: 0.04, delay: 0.5 + i * 0.05 });
  },
  roundWin() {
    [392, 523, 659].forEach((f, i) => tone(f, 0.25, { type: "triangle", gain: 0.14, delay: i * 0.12 }));
  },
  countdown(final = false) {
    tone(final ? 880 : 440, final ? 0.35 : 0.12, { type: "square", gain: 0.06 });
  },
  /** Chalk scratching across the board (a new body part is drawn). */
  chalk() {
    for (let i = 0; i < 6; i++) noise(0.07, { delay: i * 0.07, freq: 3200 + i * 300, q: 3, gain: 0.12 });
  },
  chalkTap() {
    noise(0.03, { freq: 4000, q: 2, gain: 0.18 });
  },
  letterRight(count = 1) {
    for (let i = 0; i < Math.min(count, 4); i++) tone(740 + i * 120, 0.16, { type: "triangle", gain: 0.13, delay: i * 0.08 });
  },
  letterWrong() {
    tone(180, 0.22, { type: "sawtooth", gain: 0.06, slide: 0.7 });
  },
  hanged() {
    tone(196, 0.6, { type: "sine", gain: 0.16, slide: 0.5 });
    tone(147, 0.9, { type: "sine", gain: 0.12, delay: 0.35, slide: 0.6 });
  },
  saved() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: "triangle", gain: 0.14, delay: i * 0.1 }));
  },
  /** Guess Who answer stamp: bright for YES, low thud for NO. */
  stamp(yes: boolean) {
    noise(0.06, { freq: 500, gain: 0.45 });
    tone(yes ? 740 : 196, 0.18, { type: yes ? "triangle" : "sawtooth", gain: yes ? 0.14 : 0.07, delay: 0.04, slide: yes ? 1.2 : 0.7 });
  },
  /** Connect 4 disc landing: a plastic clack after it falls `rows` cells, then a small bounce. */
  discDrop(rows = 3) {
    const fall = 0.12 + rows * 0.045;
    noise(0.045, { delay: fall, freq: 1800, q: 1.2, gain: 0.5 });
    tone(320, 0.06, { type: "triangle", gain: 0.14, delay: fall, slide: 0.7 });
    noise(0.03, { delay: fall + 0.13, freq: 2400, q: 1.5, gain: 0.18 });
  },
  /** PopOut: the bottom disc slides out and the column drops. */
  discPop() {
    noise(0.08, { freq: 900, q: 0.8, gain: 0.35 });
    tone(220, 0.14, { type: "triangle", gain: 0.12, slide: 0.6, delay: 0.05 });
  },
  /** The slider opens and every disc rattles out of the board. */
  release(count = 20) {
    for (let i = 0; i < Math.min(count, 28); i++) noise(0.035, { delay: 0.05 + i * 0.035 + Math.random() * 0.03, freq: 1400 + Math.random() * 1600, q: 1.3, gain: 0.25 });
  },
  /** A card flipping down on the board. */
  cardFlip(delay = 0) {
    noise(0.05, { delay, freq: 2400, q: 1.5, gain: 0.22 });
  },
};

export const haptic = {
  pulse(pattern: number | number[]) {
    if (!getPrefs().haptics) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // unsupported
    }
  },
  roll: () => haptic.pulse([12, 40, 12, 40, 18]),
  select: () => haptic.pulse(8),
  close: () => haptic.pulse(22),
  yourTurn: () => haptic.pulse([30, 60, 30]),
  blocked: () => haptic.pulse([80, 60, 120]),
  roundWin: () => haptic.pulse([40, 50, 40, 50, 80]),
  shutTheBox: () => haptic.pulse([60, 40, 60, 40, 60, 40, 200]),
};
