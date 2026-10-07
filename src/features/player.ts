import AudioModule from 'expo-audio';
import { Vibration } from 'react-native';

// The AudioPlayer class is only modelled as a type in this SDK version, so it is read
// off the native module (the hooks do the same internally). Runtime value is a real
// class; the cast keeps the build clean.
const PlayerClass = (AudioModule as { AudioPlayer?: unknown }).AudioPlayer as new (
  source: unknown,
  updateInterval: number,
  keepAudioSessionActive: boolean,
  preferredForwardBufferDuration: number,
) => {
  play(): void;
  pause(): void;
  stop(): Promise<void>;
  seekTo(seconds: number, ...args: unknown[]): Promise<void>;
  getStatus(): unknown;
  duration: number;
  currentTime: number;
  paused: boolean;
  loop: boolean;
  volume: number;
  playbackRate: number;
};

let instance: InstanceType<typeof PlayerClass> | null = null;
let positionTimer: ReturnType<typeof setInterval> | null = null;
let onPosition: ((ms: number) => void) | null = null;

/**
 * Slice 3 — in-place replay (prd.md > Replay in place, spec.md > Components #9).
 *
 * Word timestamps come from the transcription (relative to the recording's start),
 * so the audio is loaded and seeked to that millisecond on finger contact. A single
 * haptic marks the start; the ring is driven by ~10 Hz position polling.
 *
 * startSeek stops any playback already in flight, begins the new seek, and returns
 * { durationMs, cleanup } so the caller can tear it down later.
 */
export function startSeek(
  audioUri: string,
  wordStartMs: number,
  onPosition: (ms: number) => void,
): { durationMs: number; cleanup: () => void } {
  stop();

  const player = new PlayerClass(audioUri, 1000, true, 0);
  const durationMs = Math.round(player.duration * 1000);

  player.play();
  player.seekTo(wordStartMs / 1000);

  // Spec: one haptic marks the replay start (spec.md > Components #9).
  Vibration.vibrate(1);

  onPosition = onPosition;
  positionTimer = setInterval(() => {
    if (instance) onPosition?.(instance.currentTime * 1000);
  }, 100);

  return { durationMs, cleanup: () => stop() };
}

/** Stop the current replay: halt playback, clear the position feed, release the player. */
export function stop() {
  if (positionTimer) {
    clearInterval(positionTimer);
    positionTimer = null;
  }
  onPosition = null;
  if (instance) {
    instance.stop().then(() => {});
    instance = null;
  }
}
