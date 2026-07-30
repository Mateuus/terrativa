export type GameSound = "step" | "dice" | "ui" | "success" | "credits" | "event" | "error";

const STORAGE_KEY = "terrativa.sound.enabled";
let audioContext: AudioContext | null = null;
let enabled = readPreference();

export function isGameSoundEnabled(): boolean {
  return enabled;
}

export function setGameSoundEnabled(next: boolean): void {
  enabled = next;
  window.localStorage.setItem(STORAGE_KEY, String(next));
  if (next) playGameSound("ui");
}

export function playGameSound(sound: GameSound): void {
  if (!enabled || typeof window === "undefined") return;
  const context = getContext();
  if (context.state === "suspended") void context.resume();
  const now = context.currentTime;

  switch (sound) {
    case "step":
      noise(context, now, 0.045, 0.035, 180);
      tone(context, now, 92, 72, 0.055, 0.025, "sine");
      break;
    case "dice":
      noise(context, now, 0.32, 0.11, 1_600);
      [0, 0.075, 0.16].forEach((delay, index) => {
        tone(context, now + delay, 210 + index * 55, 125, 0.08, 0.045, "triangle");
      });
      break;
    case "ui":
      tone(context, now, 520, 660, 0.055, 0.035, "sine");
      break;
    case "success":
      [392, 523, 659].forEach((frequency, index) => {
        tone(context, now + index * 0.08, frequency, frequency * 1.02, 0.22, 0.045, "sine");
      });
      break;
    case "credits":
      [880, 1_175].forEach((frequency, index) => {
        tone(context, now + index * 0.06, frequency, frequency * 0.92, 0.13, 0.03, "triangle");
      });
      break;
    case "event":
      tone(context, now, 310, 465, 0.24, 0.04, "triangle");
      tone(context, now + 0.08, 620, 540, 0.2, 0.025, "sine");
      break;
    case "error":
      tone(context, now, 180, 105, 0.23, 0.05, "sawtooth");
      break;
  }
}

function getContext(): AudioContext {
  audioContext ??= new AudioContext({ latencyHint: "interactive" });
  return audioContext;
}

function tone(
  context: AudioContext,
  start: number,
  from: number,
  to: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(
  context: AudioContext,
  start: number,
  duration: number,
  volume: number,
  cutoff: number,
): void {
  const length = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
}

function readPreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "false";
}
