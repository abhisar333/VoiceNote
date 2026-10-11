import { File, Paths } from 'expo-file-system';

import type { Note, Segment } from './segments';
import { newNoteId } from './segments';

/** Persistence for the notes list (homepage branch): one documents/notes.json,
 *  plain UTF-8 JSON. Audio stays beside it in documents/recordings/ — only the
 *  path is stored (spec.md > Data Model). Implements prd.md > States & Edge
 *  Cases: "App restarted / force-quit → everything restored". */

const NOTE_FILE = 'note.json';
const NOTES_FILE = 'notes.json';

function notesFile(): File {
  return new File(Paths.document, NOTES_FILE);
}

function legacyNoteFile(): File {
  return new File(Paths.document, NOTE_FILE);
}

/** Restore the notes list from disk, or null when there is nothing (or nothing
 *  usable) to restore. The pre-homepage single-note file is promoted on first
 *  launch so existing users keep their note. */
export async function loadNotes(): Promise<Note[] | null> {
  try {
    const file = notesFile();
    if (file.exists) {
      const parsed = JSON.parse(await file.text()) as Partial<{ notes: unknown }>;
      const list = Array.isArray(parsed?.notes) ? parsed.notes : [];
      const restored = list
        .map((candidate) => restoreNote(candidate))
        .filter((note): note is Note => note !== null);
      return restored;
    }
    // First launch after the homepage change: promote the old single note.
    const legacy = await loadLegacyNote();
    return legacy ? [legacy] : null;
  } catch {
    return null; // Unreadable/corrupt file → start fresh rather than crash (POC call).
  }
}

/** Write the notes list to disk. Voice segments whose audio is gone are
 *  dropped, so the saved document never points at a file that no longer
 *  exists (spec > Components #10). */
export function saveNotes(notes: Note[]): void {
  try {
    const file = notesFile();
    if (!file.exists) file.create();
    const cleaned = notes.map((note) => ({
      ...note,
      segments: note.segments.filter((segment) => segmentExists(segment)),
    }));
    file.write(JSON.stringify({ notes: cleaned }, null, 2));
  } catch {
    // A failed save never breaks the running app; the in-memory list stays source of truth.
  }
}

function restoreNote(candidate: unknown): Note | null {
  const note = candidate as Partial<Note> | null;
  if (!note || !Array.isArray(note.segments)) return null;
  // Only restore voice segments whose audio file still exists on disk.
  const segments = note.segments.filter((segment) => segmentExists(segment));
  return {
    id: typeof note.id === 'string' ? note.id : newNoteId(),
    segments: segments as Segment[],
    updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
    draft: typeof note.draft === 'string' ? note.draft : undefined,
    title: typeof note.title === 'string' && note.title.trim() !== '' ? note.title : undefined,
  };
}

/** The single-note layout that predates the homepage: { segments, updatedAt }. */
async function loadLegacyNote(): Promise<Note | null> {
  try {
    const file = legacyNoteFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(await file.text()) as Partial<Note>;
    if (!parsed || !Array.isArray(parsed.segments)) return null;
    const segments = parsed.segments.filter((segment) => segmentExists(segment));
    return {
      id: newNoteId(),
      segments: segments as Segment[],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Delete one segment's audio file (user removed a single bubble). Best-effort,
 *  like deleteNoteAudio: a file we can't remove never blocks the delete. */
export function deleteSegmentAudio(segment: Segment): void {
  if (segment.kind !== 'voice') return;
  try {
    const file = new File(segment.audioUri);
    if (file.exists) file.delete();
  } catch {
    // Stays on disk; harmless — saveNotes drops segments whose audio is gone.
  }
}

/** Delete every audio file a note's voice segments point at. Called when the
 *  note itself is deleted so the recordings folder never keeps orphaned
 *  takes (spec > Data Model: audio lives in documents/recordings/). Missing
 *  files are ignored — deletion is best-effort by design. */
export function deleteNoteAudio(note: Note): void {
  for (const segment of note.segments) {
    if (segment.kind !== 'voice') continue;
    try {
      const file = new File(segment.audioUri);
      if (file.exists) file.delete();
    } catch {
      // A file we can't remove just stays on disk; never block the delete.
    }
  }
}

function segmentExists(segment: unknown): boolean {
  const candidate = segment as Partial<Segment>;
  if (!candidate || typeof candidate.kind !== 'string') return false;
  if (candidate.kind !== 'voice') return true;
  try {
    return typeof candidate.audioUri === 'string' && new File(candidate.audioUri).exists;
  } catch {
    return false;
  }
}
