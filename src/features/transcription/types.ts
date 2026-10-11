import type { Word } from '../segments';

/** The transcriber contract (spec.md > Components #8).
 *  Word lives in segments.ts — the note's own data model — so there is one definition of it. */
export type { Word };

export type Transcript = { words: Word[] };

/** language = Whisper code ('en', 'hi', …); undefined → provider autodetects
 *  (exactly the first-try behavior — never passed on the initial run). */
export type Transcriber = (audioUri: string, language?: string) => Promise<Transcript>;
