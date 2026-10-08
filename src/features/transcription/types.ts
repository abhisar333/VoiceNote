import type { Word } from '../segments';

/** The transcriber contract (spec.md > Components #8).
 *  Word lives in segments.ts — the note's own data model — so there is one definition of it. */
export type { Word };

export type Transcript = { words: Word[] };

export type Transcriber = (audioUri: string) => Promise<Transcript>;
