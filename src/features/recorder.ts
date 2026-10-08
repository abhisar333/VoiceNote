import { AudioModule, RecordingPresets, type AudioRecorder } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

/** Voice capture: start/stop a recording and land the file in documents/recordings/<id>.m4a.
 *  Implements prd.md > Capture and the file half of Transcription (spec.md > Components #7). */

export type RecordingResult = { uri: string; durationMs: number };

let recorder: AudioRecorder | null = null;
let meterTimer: ReturnType<typeof setInterval> | null = null;
/** null = the platform never reported a level → documented continuous-pulse fallback. */
let metering: number | null = null;
/** The segment id this take belongs to, so the file and the segment share an id. */
let pendingSegmentId: string | null = null;

/** Ask for the mic once, on the first record tap (spec.md > Where It Runs, step 4). */
export async function startRecording(segmentId: string): Promise<void> {
  const permission = await AudioModule.requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error('microphone permission denied');
  }

  recorder = new AudioModule.AudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  await recorder.prepareToRecordAsync();
  metering = null;
  recorder.record();

  // ~10 polls/sec for the pulse (spec.md > Components #5 polls at ~10x/sec for playback).
  meterTimer = setInterval(() => {
    const state = recorder?.getStatus();
    if (state && typeof state.metering === 'number') metering = state.metering;
  }, 100);

  // segmentId is taken up-front so the file name and the segment id match.
  pendingSegmentId = segmentId;
}

/** Stop, move the finished file out of cache into permanent storage, return its facts. */
export async function stopRecording(): Promise<RecordingResult> {
  if (!recorder) throw new Error('not recording');
  if (meterTimer) clearInterval(meterTimer);
  meterTimer = null;

  const durationMs = Math.round(recorder.getStatus().durationMillis);
  await recorder.stop();
  const tempUri = recorder.uri;
  const segmentId = pendingSegmentId;
  recorder = null;
  pendingSegmentId = null;
  if (!tempUri || !segmentId) throw new Error('recording produced no file');

  const recordings = new Directory(Paths.document, 'recordings');
  if (!recordings.exists) recordings.create({ idempotent: true });

  const permanent = new File(recordings, `${segmentId}.m4a`);
  if (permanent.exists) permanent.delete();
  await new File(tempUri).move(permanent);

  return { uri: permanent.uri, durationMs };
}

/** Last level the mic reported, or null if the platform never exposes one. */
export function getMetering(): number | null {
  return metering;
}

/** PRD pulse rule: pulse only while the mic hears sound (prd.md > Capture).
 *  Fallback recorded in spec.md > Components #4: no metering → pulse continuously. */
export function meteringToLive(level: number | null): boolean {
  if (level === null) return true;
  // dBFS (always <= 0) vs a linear 0..1 scale, depending on platform.
  return level <= 0 ? level > -50 : level > 0.05;
}
