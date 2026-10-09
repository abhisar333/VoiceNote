import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';

import NoteScreen from './src/screens/NoteScreen';
import type { NoteMode } from './src/components/ModeToggle';
import { getMetering, meteringToLive, startRecording, stopRecording } from './src/features/recorder';
import { transcribe } from './src/features/transcription/transcri';
import type { VoiceSegment } from './src/features/segments';
import { startSeek } from './src/features/player';
import { loadNote, saveNote } from './src/features/noteStore';
import {
  addTypedSegment,
  addVoiceSegment,
  editSegmentText,
  emptyNote,
  newSegmentId,
  removeSegment,
  setVoiceTranscript,
  type Note,
} from './src/features/segments';

const NOTICE_MS = 3500;

/** Root: owns the note and the mode; saves to disk from slice 4 on.
 *  Slice 2 owns the record → transcribe flow (prd.md > Capture, Transcription). */
export default function App() {
  const [note, setNote] = useState<Note>(emptyNote);
  // PRD: the app opens in edit mode so an empty note shows its blinking cursor.
  const [mode, setMode] = useState<NoteMode>('edit');
  const [recording, setRecording] = useState(false);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingId = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Slice 4: saves stay off until the disk load has settled (see the load effect).
  const readyToSave = useRef(false);

  // Slice 4: restore the note from documents/note.json on launch (spec > Data Flow 7).
  // The local read resolves in milliseconds; the guard keeps it from clobbering
  // anything the user does before it lands.
  useEffect(() => {
    let cancelled = false;
    void loadNote().then((stored) => {
      if (cancelled) return;
      if (stored) setNote(stored);
      readyToSave.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Slice 4: every change is written back to note.json (spec > Data Flow 6, "simple is fine").
  useEffect(() => {
    if (!readyToSave.current) return;
    saveNote(note);
  }, [note]);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  // ~10 polls/sec while the mic is open, for the pulse (prd.md > Capture).
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setLive(meteringToLive(getMetering())), 100);
    return () => clearInterval(timer);
  }, [recording]);

  const runTranscription = async (segmentId: string, audioUri: string) => {
    try {
      const { words } = await transcribe(audioUri);
      if (words.length === 0) {
        // Silent take: no segment, short notice (prd.md > Transcription).
        setNote((current) => removeSegment(current, segmentId));
        showNotice('no audio recorded');
      } else {
        const text = words.map((word) => word.text).join(' ');
        setNote((current) => setVoiceTranscript(current, segmentId, text, words));
      }
    } catch (err) {
      // Delay ~700 ms so the 1-2-3 dots animation renders once before the message appears.
      await new Promise((resolve) => setTimeout(resolve, 700));
      const reason =
        err instanceof Error ? err.message : 'transcription unavailable';
      setNote((current) =>
        setVoiceTranscript(current, segmentId, reason, null),
      );
    }
  };

  // Slice 3: which word is playing, its duration, and the playback head position.
  const [playback, setPlayback] = useState<{ id: string; wordMs: number; durationMs: number } | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const replayCleanup = useRef<(() => void) | null>(null);

  // Slice 3: start word-precise playback from a voice segment's word timestamp.
  const startReplay = (segment: VoiceSegment, wordMs: number) => {
    if (replayCleanup.current) replayCleanup.current();
    const { cleanup, durationMs } = startSeek(segment.audioUri, wordMs, setPlayheadMs, () => {
      // Natural end: audio ran out on its own → clear the ring; the player is
      // already released by stop() inside startSeek's poll.
      replayCleanup.current = null;
      setPlayback(null);
      setPlayheadMs(0);
    });
    replayCleanup.current = cleanup;
    setPlayback({ id: segment.id, wordMs, durationMs });
  };

  const stopReplay = () => {
    replayCleanup.current?.();
    replayCleanup.current = null;
    setPlayback(null);
    setPlayheadMs(0);
  };

  const handleRecordPress = async () => {
    if (recording) {
      setRecording(false);
      setLive(false);
      try {
        const { uri, durationMs } = await stopRecording();
        const segmentId = pendingId.current ?? newSegmentId();
        pendingId.current = null;
        setNote((current) => addVoiceSegment(current, { id: segmentId, audioUri: uri, durationMs }));
        void runTranscription(segmentId, uri);
      } catch {
        showNotice('no audio recorded');
      }
      return;
    }

    const segmentId = newSegmentId();
    pendingId.current = segmentId;
    try {
      await startRecording(segmentId);
      setRecording(true);
    } catch (error) {
      pendingId.current = null;
      showNotice(error instanceof Error ? error.message : 'could not start recording');
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <NoteScreen
        note={note}
        mode={mode}
        onModeChange={setMode}
        onAddTypedSegment={(text) => setNote((current) => addTypedSegment(current, text))}
        onEditText={(id, text) => setNote((current) => editSegmentText(current, id, text))}
        onRecordPress={handleRecordPress}
        recording={recording}
        live={recording && live}
        notice={notice}
        playback={playback}
        playheadMs={playheadMs}
        onStartReplay={startReplay}
        onStopReplay={stopReplay}
      />
    </>
  );
}

