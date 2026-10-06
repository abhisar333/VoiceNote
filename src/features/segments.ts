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

export type Note = { segments: Segment[]; updatedAt: number };

let idCounter = 0;

/** Stable-enough id for a single-note POC: time + counter, no collisions in one process. */
export function newSegmentId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}`;
}

export function emptyNote(): Note {
  return { segments: [], updatedAt: Date.now() };
}

export function addTypedSegment(note: Note, text: string): Note {
  const trimmed = text.trim();
  if (trimmed === '') return note;
  const segment: TypedSegment = { id: newSegmentId(), kind: 'typed', text: trimmed };
  return { segments: [...note.segments, segment], updatedAt: Date.now() };
}
