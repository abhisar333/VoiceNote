export type Word = { text: string; startMs: number; endMs: number };

export type TypedSegment = { id: string; kind: 'typed'; text: string };

export type VoiceSegment = {
  id: string;
  kind: 'voice';
  text: string;
  audioUri: string;
  durationMs: number;
  /** null = transcription not finished yet (dots) or failed (message) */
  words: Word[] | null;
};

export type Segment = TypedSegment | VoiceSegment;

export type Note = { id: string; segments: Segment[]; updatedAt: number; /** Live composer text, saved with the note so typing survives force-quit. */ draft?: string };

let idCounter = 0;
let noteCounter = 0;

/** Stable-enough id for a single-note POC: time + counter, no collisions in one process. */
export function newSegmentId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}`;
}

/** Unique id for a note in the multi-note list (homepage feature). */
export function newNoteId(): string {
  noteCounter += 1;
  return `n-${Date.now().toString(36)}-${noteCounter}`;
}

export function emptyNote(id: string = newNoteId()): Note {
  return { id, segments: [], updatedAt: Date.now() };
}

export function addTypedSegment(note: Note, text: string): Note {
  const trimmed = text.trim();
  if (trimmed === '') {
    // Nothing to add — but the draft still needs clearing on commit.
    return note.draft ? { ...note, draft: undefined } : note;
  }
  const segment: TypedSegment = { id: newSegmentId(), kind: 'typed', text: trimmed };
  return { ...note, segments: [...note.segments, segment], draft: undefined, updatedAt: Date.now() };
}

/** Mirror the composer into the note on every keystroke (autosave parity with
 *  audio, which is written the moment recording stops). Does not bump
 *  updatedAt: a draft alone doesn't reorder the home list. */
export function setNoteDraft(note: Note, text: string): Note {
  return { ...note, draft: text };
}

/** Append a voice segment straight after stop, while it still shows the 1-2-3 dots. */
export function addVoiceSegment(
  note: Note,
  segment: { id: string; audioUri: string; durationMs: number },
): Note {
  const voice: VoiceSegment = { ...segment, kind: 'voice', text: '', words: null };
  return { ...note, segments: [...note.segments, voice], updatedAt: Date.now() };
}

/** Dots → transcript (words set), or dots → failure message (words stays null). */
export function setVoiceTranscript(note: Note, id: string, text: string, words: Word[] | null): Note {
  return {
    ...note,
    segments: note.segments.map((segment) =>
      segment.id === id && segment.kind === 'voice' ? { ...segment, text, words } : segment,
    ),
    updatedAt: Date.now(),
  };
}

/** A silent take leaves no segment at all (prd.md > Transcription). */
export function removeSegment(note: Note, id: string): Note {
  return {
    ...note,
    segments: note.segments.filter((segment) => segment.id !== id),
    updatedAt: Date.now(),
  };
}

/** Edit a segment's text in place (prd.md > Modes: "Saving an edit is permanent").
 *  Voice audio is never touched by an edit. Word timings are remapped onto the new
 *  words so replay still works after a fix: same word count keeps exact timings
 *  (the PRD's typo-fix case); a different count spreads them across the original span. */
export function editSegmentText(note: Note, id: string, text: string): Note {
  const trimmed = text.trim();
  if (trimmed === '') return note; // an empty edit keeps what was there
  return {
    ...note,
    segments: note.segments.map((segment) => {
      if (segment.id !== id) return segment;
      if (segment.kind === 'typed') return { ...segment, text: trimmed };
      return { ...segment, text: trimmed, words: remapWords(segment.words, trimmed) };
    }),
    updatedAt: Date.now(),
  };
}

/** Fit the transcription's word timings to newly edited text (see editSegmentText). */
function remapWords(words: Word[] | null, text: string): Word[] | null {
  if (!words || words.length === 0) return words;
  const parts = text.split(/\s+/).filter((part) => part !== '');
  if (parts.length === 0) return words;
  if (parts.length === words.length) {
    return parts.map((part, index) => ({
      text: part,
      startMs: words[index].startMs,
      endMs: words[index].endMs,
    }));
  }
  // Word count changed: spread evenly across the segment's original span.
  const spanStart = words[0].startMs;
  const span = Math.max(1, words[words.length - 1].endMs - spanStart);
  const each = span / parts.length;
  return parts.map((part, index) => ({
    text: part,
    startMs: Math.round(spanStart + index * each),
    endMs: Math.round(spanStart + (index + 1) * each),
  }));
}
