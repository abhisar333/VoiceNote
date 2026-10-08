import { File } from 'expo-file-system';

import type { Transcript, Word } from './types';

/** The only transcription implementation (spec.md > Components #8).
 *  Swapping providers later still means changing this folder only. */

// Groq's free Developer plan (no card): whisper-large-v3-turbo at word-level
// granularity. Replaces Hugging Face after their Inference Providers started
// returning 402 for free accounts (see checklist Revisions).
const MODEL = 'whisper-large-v3-turbo';
const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
/** Bound the request so the PRD's 1-2-3 dots state never hangs (spec.md > Components #8). */
const TIMEOUT_MS = 30_000;

type GroqWord = { word: string; start: number; end: number };
type GroqResult = { text?: string; words?: GroqWord[] };

/** Upload the finished file and map the word-level response into Word[]. */
export async function transcribe(audioUri: string): Promise<Transcript> {
  const token = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!token) throw new Error('EXPO_PUBLIC_GROQ_API_KEY is missing from .env');

  const form = new FormData();
  form.append('file', {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('model', MODEL);
  form.append('response_format', 'verbose_json');
  // Word-level timestamps — the PRD's replay-in-place promise (spec.md > Risks #1).
  form.append('timestamp_granularities[]', 'word');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`transcription request failed (${response.status})`);
    }
    const payload: GroqResult = await response.json();
    return { words: toWords(payload) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('transcription timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Word timestamps arrive in seconds; the note stores milliseconds (spec.md > Data Model).
 *  An empty array means the engine heard nothing → PRD's silent-take path.
 *  Incomplete trailing words (end <= start or missing) are skipped so the note never
 *  carries an invalid [startMs, 0] entry. */
function toWords(result: GroqResult | undefined): Word[] {
  const raw = result?.words ?? [];
  const words: Word[] = [];
  for (const entry of raw) {
    const text = entry.word.trim();
    if (text === '') continue;
    if (entry.start == null || entry.end == null || entry.end <= entry.start) continue;
    words.push({
      text,
      startMs: Math.max(0, Math.round(entry.start * 1000)),
      endMs: Math.max(0, Math.round(entry.end * 1000)),
    });
  }
  return words;
}
