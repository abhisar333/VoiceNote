import { File, Paths } from 'expo-file-system';

import type { Note, Segment } from './segments';

/** Persistence for the whole note (spec.md > Components #10): one documents/note.json,
 *  plain UTF-8 JSON. Audio stays beside it in documents/recordings/ — only the path is
 *  stored (spec.md > Data Model). Implements prd.md > States & Edge Cases:
 *  "App restarted / force-quit → everything restored". */

const NOTE_FILE = 'note.json';

function noteFile(): File {
  return new File(Paths.document, NOTE_FILE);
}

/** Restore the note from disk, or null when there is nothing (or nothing usable) to restore. */
export async function loadNote(): Promise<Note | null> {
  try {
    const file = noteFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(await file.text()) as Partial<Note>;
    if (!parsed || !Array.isArray(parsed.segments)) return null;
    // Only restore voice segments whose audio file still exists on disk.
    const segments = parsed.segments.filter((segment) => segmentExists(segment));
    return {
      segments: segments as Segment[],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null; // Unreadable/corrupt file → start fresh rather than crash (POC call).
  }
}

/** Write the note to disk. Voice segments whose audio is gone are dropped, so the
 *  saved document never points at a file that no longer exists (spec > Components #10). */
export function saveNote(note: Note): void {
  try {
    const file = noteFile();
    if (!file.exists) file.create();
    const segments = note.segments.filter((segment) => segmentExists(segment));
    file.write(JSON.stringify({ segments, updatedAt: note.updatedAt }, null, 2));
  } catch {
    // A failed save never breaks the running app; the in-memory note stays source of truth.
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
