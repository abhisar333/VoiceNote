import { transcribe as groqTranscribe } from './groq';
import type { Transcriber } from './types';

/** Thin facade: the app calls this, never the provider directly, so swapping
 *  transcription providers is this folder only (learner decision, spec.md > Components #8).
 *  Provider history: Hugging Face → Groq (HF free tier began returning 402). */
const provider: Transcriber = groqTranscribe;

export async function transcribe(audioUri: string) {
  return provider(audioUri);
}

