import { File, UploadType } from 'expo-file-system';

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

/** Upload the finished file and map the word-level response into Word[].
 *  Uses expo-file-system's native multipart upload: Expo SDK 57's fetch rejects
 *  React Native's { uri } FormData parts ("uri is not supported for React Native's
 *  FormData"), so the file must be sent through the native upload path. */
export async function transcribe(audioUri: string): Promise<Transcript> {
  const token = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!token) throw new Error('EXPO_PUBLIC_GROQ_API_KEY is missing from .env');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await new File(audioUri).upload(ENDPOINT, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/m4a',
      headers: { Authorization: `Bearer ${token}` },
      parameters: {
        model: MODEL,
        response_format: 'verbose_json',
        // Word-level timestamps — the PRD's replay-in-place promise (spec.md > Risks #1).
        'timestamp_granularities[]': 'word',
      },
      signal: controller.signal,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`transcription request failed (${result.status})`);
    }

    const payload: GroqResult = JSON.parse(result.body);
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
