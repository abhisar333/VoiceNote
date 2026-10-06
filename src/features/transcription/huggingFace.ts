import { File } from 'expo-file-system';

import type { Transcript, Word } from './types';

/** The only transcription implementation (spec.md > Components #8).
 *  Swapping in Google later means changing this folder only. */

// One free Whisper model on Hugging Face (spec.md > Stack).
// Endpoint discovered at build: the spec's legacy api-inference.huggingface.co host no
// longer exists in DNS; Inference Providers routes through router.huggingface.co.
const MODEL = 'openai/whisper-large-v3-turbo';
const ENDPOINT = `https://router.huggingface.co/hf-inference/models/${MODEL}`;
/** Free endpoints can be slow to answer; the PRD's 1-2-3 dots cover it and a visible
 *  failure beats a hang (spec.md > Components #8). */
const TIMEOUT_MS = 30_000;

type Chunk = { text: string; timestamp: [number | null, number | null] };
type AsrResult = { text?: string; chunks?: Chunk[] };

/** Upload the finished file and map the word-level response into Word[]. */
export async function transcribe(audioUri: string): Promise<Transcript> {
  const token = process.env.EXPO_PUBLIC_HF_TOKEN;
  if (!token) throw new Error('EXPO_PUBLIC_HF_TOKEN is missing from .env');

  const base64 = await new File(audioUri).base64();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: base64,
        parameters: { return_timestamps: 'word' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`transcription request failed (${response.status})`);
    }
    const payload: AsrResult | AsrResult[] = await response.json();
    return { words: toWords(Array.isArray(payload) ? payload[0] : payload) };
  } catch (error) {
    // Keep this log for one round only: it tells us the real failure status
    // (token, network, 401, 404...) instead of the generic fallback.
    console.warn('transcription failed:', error instanceof Error ? error.message : error);
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
 *  Chunks whose end time is still null (streaming tail) are skipped: leaving them in
 *  would paint an invalid [startMs, 0] word, e.g. the pattern we hit on a retry. */
function toWords(result: AsrResult | undefined): Word[] {
  const chunks = result?.chunks ?? [];
  const words: Word[] = [];
  for (const chunk of chunks) {
    const text = chunk.text.trim();
    if (text === '') continue;
    const start = chunk.timestamp[0];
    const end = chunk.timestamp[1];
    if (start == null || end == null || end <= start) continue; // incomplete trailing chunk
    words.push({
      text,
      startMs: Math.max(0, Math.round(start * 1000)),
      endMs: Math.max(0, Math.round(end * 1000)),
    });
  }
  return words;
}
