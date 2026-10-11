import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import NoteScreen from './src/screens/NoteScreen';
import type { NoteMode } from './src/components/ModeToggle';
import { getMetering, meteringToLive, startRecording, stopRecording } from './src/features/recorder';
import { transcribe } from './src/features/transcription/transcri';
import type { VoiceSegment } from './src/features/segments';
import { startSeek, stop as stopPlayer } from './src/features/player';
import { loadNotes, saveNotes, deleteNoteAudio } from './src/features/noteStore';
import {
  addTypedSegment,
  addVoiceSegment,
  editSegmentText,
  emptyNote,
  newNoteId,
  newSegmentId,
  removeSegment,
  setNoteDraft,
  setNoteTitle,
  setVoiceTranscript,
  type Note,
} from './src/features/segments';

const NOTICE_MS = 3500;

/** Root (homepage branch): owns the notes list and which note is open; the
 *  home page is first, "+ New note" starts a fresh editor. Slice 2 owns the
 *  record → transcribe flow (prd.md > Capture, Transcription). */
export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  // PRD: the app opens in edit mode so an empty note shows its blinking cursor.
  const [mode, setMode] = useState<NoteMode>('edit');
  const [recording, setRecording] = useState(false);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingId = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Slice 4: saves stay off until the disk load has settled (see the load effect).
  const readyToSave = useRef(false);
  const [page, setPage] = useState<'home' | 'editor'>('home');

  const openNote = (id: string) => {
    stopReplay();
    setRecording(false);
    setLive(false);
    setCurrentNoteId(id);
    setMode('edit');
    setPage('editor');
  };

  const createNote = () => {
    const fresh = emptyNote(newNoteId());
    stopReplay();
    setRecording(false);
    setLive(false);
    setNotes((current) => [...current, fresh]);
    setCurrentNoteId(fresh.id);
    setMode('edit');
    setPage('editor');
  };

  const goHome = () => {
    stopReplay();
    setRecording(false);
    setLive(false);
    // A half-typed line must become a real block before we leave, otherwise
    // the tile previews as "(empty note)". addTypedSegment also clears the draft.
    if (currentNoteId) {
      patchNote(currentNoteId, (current) => addTypedSegment(current, current.draft ?? ''));
    }
    setCurrentNoteId(null);
    setPage('home');
  };

  // Delete a note from the home list: drop it from state (the save effect
  // rewrites notes.json) and remove its recorded audio from disk first.
  const deleteNote = (id: string) => {
    const note = notes.find((candidate) => candidate.id === id);
    if (!note) return;
    stopReplay();
    setRecording(false);
    setLive(false);
    deleteNoteAudio(note);
    setNotes((current) => current.filter((candidate) => candidate.id !== id));
    if (currentNoteId === id) {
      setCurrentNoteId(null);
      setPage('home');
    }
  };

  // Multi-note restore on launch (homepage branch): notes.json, with the old
  // single-note file promoted on first launch. The guard keeps it from
  // clobbering anything the user does before it lands.
  useEffect(() => {
    let cancelled = false;
    void loadNotes().then((stored) => {
      if (cancelled) return;
      if (stored) setNotes(stored);
      readyToSave.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Every change is written back to notes.json (spec > Data Flow 6, "simple is fine").
  useEffect(() => {
    if (!readyToSave.current) return;
    saveNotes(notes);
  }, [notes]);

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

  const patchNote = (noteId: string, patch: (note: Note) => Note) =>
    setNotes((current) => current.map((note) => (note.id === noteId ? patch(note) : note)));

  const runTranscription = async (noteId: string, segmentId: string, audioUri: string) => {
    try {
      const { words } = await transcribe(audioUri);
      if (words.length === 0) {
        // Silent take: no segment, short notice (prd.md > Transcription).
        patchNote(noteId, (current) => removeSegment(current, segmentId));
        showNotice('no audio recorded');
      } else {
        const text = words.map((word) => word.text).join(' ');
        patchNote(noteId, (current) => setVoiceTranscript(current, segmentId, text, words));
      }
    } catch (err) {
      // Delay ~700 ms so the 1-2-3 dots animation renders once before the message appears.
      await new Promise((resolve) => setTimeout(resolve, 700));
      const reason =
        err instanceof Error ? err.message : 'transcription unavailable';
      patchNote(noteId, (current) =>
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
    const { cleanup, durationMs } = startSeek(segment.audioUri, wordMs, (ms) => {
      // Ignore stray position ticks after a stop/replay switch.
      if (replayCleanup.current) setPlayheadMs(ms);
    }, () => {
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
    const cleanup = replayCleanup.current;
    replayCleanup.current = null;
    setPlayback(null);
    setPlayheadMs(0);
    cleanup?.();
  };

  const handleRecordPress = async () => {
    if (!currentNoteId) return;
    const noteId = currentNoteId;
    if (recording) {
      setRecording(false);
      setLive(false);
      try {
        const { uri, durationMs } = await stopRecording();
        const segmentId = pendingId.current ?? newSegmentId();
        pendingId.current = null;
        patchNote(noteId, (current) =>
          addVoiceSegment(current, { id: segmentId, audioUri: uri, durationMs }),
        );
        void runTranscription(noteId, segmentId, uri);
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

  const currentNote = notes.find((note) => note.id === currentNoteId) ?? null;

  // Phone back button: inside a note → home page. On home → default behavior
  // (exit). An open keyboard consumes the back press natively first, so this
  // only fires once the keyboard is already dismissed.
  useEffect(() => {
    if (page !== 'editor') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goHome();
      return true;
    });
    return () => subscription.remove();
  }, [page]);

  return (
    <>
      <StatusBar style="light" />
      {page === 'home' || !currentNote ? (
        <HomeScreen
          notes={notes}
          onOpenNote={openNote}
          onNewNote={createNote}
          onDeleteNote={deleteNote}
          onRenameNote={(id, title) =>
            patchNote(id, (current) => setNoteTitle(current, title))
          }
        />
      ) : (
        <NoteScreen
          note={currentNote}
          mode={mode}
          onModeChange={setMode}
          onHome={goHome}
          onAddTypedSegment={(text) =>
            patchNote(currentNote.id, (current) => addTypedSegment(current, text))
          }
          draft={currentNote.draft ?? ''}
          onDraftChange={(text) =>
            patchNote(currentNote.id, (current) => setNoteDraft(current, text))
          }
          onEditText={(id, text) =>
            patchNote(currentNote.id, (current) => editSegmentText(current, id, text))
          }
          onRecordPress={handleRecordPress}
          recording={recording}
          live={recording && live}
          notice={notice}
          playback={playback}
          playheadMs={playheadMs}
          onStartReplay={startReplay}
          onStopReplay={stopReplay}
        />
      )}
    </>
  );
}

