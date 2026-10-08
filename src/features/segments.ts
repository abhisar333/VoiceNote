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

/** Append a voice segment straight after stop, while it still shows the 1-2-3 dots. */
export function addVoiceSegment(
  note: Note,
  segment: { id: string; audioUri: string; durationMs: number },
): Note {
  const voice: VoiceSegment = { ...segment, kind: 'voice', text: '', words: null };
  return { segments: [...note.segments, voice], updatedAt: Date.now() };
}

/** Dots → transcript (words set), or dots → failure message (words stays null). */
export function setVoiceTranscript(note: Note, id: string, text: string, words: Word[] | null): Note {
  return {
    segments: note.segments.map((segment) =>
      segment.id === id && segment.kind === 'voice' ? { ...segment, text, words } : segment,
    ),
    updatedAt: Date.now(),
  };
}

/** A silent take leaves no segment at all (prd.md > Transcription). */
export function removeSegment(note: Note, id: string): Note {
  return {
    segments: note.segments.filter((segment) => segment.id !== id),
    updatedAt: Date.now(),
  };
}
