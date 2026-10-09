import { AudioModule } from 'expo-audio';
import { Vibration } from 'react-native';

// The AudioPlayer class is only re-exported as a type by this SDK version, so the
// native module object (AudioModule.AudioPlayer) is used directly — same access the
// hooks do internally. Do NOT default-import this package: it has no default export.
const PlayerClass = AudioModule.AudioPlayer;

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

  // The native constructor takes the resolved source Map — same as useAudioPlayer
  // does via resolveSource(): a bare string throws "expected Map, got a string".
  const player = new PlayerClass({ uri: audioUri }, 1000, true, 0);
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
    // AudioPlayer has no stop() in this SDK: pause, then release the shared object.
    instance.pause();
    instance.remove();
    instance = null;
  }
}
