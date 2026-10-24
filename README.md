# VoiceNote

<!-- LEARNER — WRITE THIS PART (I am not authoring public copy).
     Put your own 1–3 sentences here. The words you already wrote and approved in
     devpost/scope.md ("Why This Matters to the Learner" + the one-liner) are the
     right source; paste and tighten them. Delete this comment before submitting. -->

**Status: proof of concept.** Built and verified on Android; iOS is unbuilt and untested.

A note is an **ordered list of segments, and a segment can be a recording**. The
recording stays attached to its position and replays in place — the text is what
you read to find the piece you want.

Tap the red button, talk, tap again: the take is transcribed automatically and
lands in the note as a grey bubble. Later, **long-press any word** and the
original audio plays back from that exact word.

<!-- LEARNER — optional: a short "Why I built it". Your paragraph in
     devpost/scope.md is the source. -->

## What it does

- **Home screen** — square tiles, newest first. Search across titles and note
  content, sort by date or alphabetically, rename a note inline, delete a note
  (with confirmation), or start a new one.
- **A note** — ordered segments of two kinds: **typed** text and **voice**
  (recorded, auto-transcribed, audio kept).
- **Capture** — one round red button, bottom right. Tap to start, tap to stop. It
  pulses only while the mic hears sound.
- **Transcribe** — runs on the **finished** recording, not live. The new bubble
  shows an animated 1-2-3 dot while converting. A silent take adds no segment and
  shows a "no audio recorded" notice instead.
- **Replay in place** — in view mode, long-press any word in a voice bubble: a
  vibration marks the start, playback begins **at that word**, and a progress ring
  animates at the top left. Release to stop.
- **Edit** — the top-right toggle switches view/edit. Tap a segment's text to fix
  it; tap empty space and type to add a typed segment in the flow. Editing a voice
  bubble's text remaps its word timings — the audio itself is never changed.
  Re-transcribe a voice segment in a chosen language, or delete it (audio included).
- **Persist** — force-quit and reopen: notes, text, titles, order and audio survive.

## Requirements

- **Node.js 22.13+, 24.3+, or 26+** (the engine range `react-native@0.88` declares)
- An **Android** phone with the [Expo Go](https://expo.dev/go) app, *or* the Android SDK
  locally for the dev-client fallback
- A free **Groq API key** — no card required: <https://console.groq.com/keys>

## Setup and run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file from the template:
   ```powershell
   Copy-Item .env.example .env        # macOS/Linux: cp .env.example .env
   ```
3. Put your key in `.env`:
   ```
   EXPO_PUBLIC_GROQ_API_KEY=gsk_...
   ```
   Only this variable is read by the code. `.env` is gitignored — never commit it.
4. Start the dev server:
   ```bash
   npx expo start
   ```
5. On the phone (same Wi-Fi network), open **Expo Go** and scan the QR code.
6. The first record tap asks for microphone permission — allow it.

Internet is needed only for the transcription round-trip; everything else is local.

**Fallback — local dev client** (only if Expo Go blocks something): `npx expo run:android`
needs the Android SDK locally; it compiles, installs and starts the dev server with no EAS
account and no cloud build queue. After that, pure JS changes need only `npx expo start`.

## The 60-second tour

1. Open the app — the note screen, edit mode, blinking cursor, red button bottom right.
2. Tap the red button, say a sentence, tap it again to stop.
3. A grey bubble shows an animated 1-2-3 dot, then your words appear in it.
4. Flip the top-right toggle to **view** mode.
5. **Long-press a word** — it vibrates, playback starts at that word, the ring animates. Release to stop.
6. Flip back to **edit**, tap a bubble's text, and fix a word.
7. Force-quit and reopen — the note, its text, its order and its audio are all still there.

## Project structure

```
App.tsx                            # root: navigation, mode + playback state
index.ts                           # entry point (registerRootComponent)
app.json                           # Expo config (name, slug, icons)
src/screens/HomeScreen.tsx         # tiles, search, sort, rename, delete
src/screens/NoteScreen.tsx         # the note: ring, toggle, segments, record button
src/components/                    # SegmentBubble, RecordButton, ProgressRing, ModeToggle, LanguagePicker
src/features/segments.ts           # segment types + pure logic
src/features/recorder.ts           # record start/stop, permanent audio file
src/features/player.ts             # word-precise replay (seekTo word start)
src/features/noteStore.ts          # load/save documents/notes.json
src/features/transcription/        # transcri.ts facade, groq.ts, types.ts
devpost/                           # planning docs (scope, prd, spec, checklist, app map)
DESIGN.md                          # original vision doc (superseded sections noted in spec.md)
```

## How it works

- **Storage** — one JSON document, `documents/notes.json`, with the audio beside it in
  `documents/recordings/`. No backend, no database.
- **Transcription** — Groq's Whisper endpoint with `timestamp_granularities[]=word`,
  uploaded through Expo's native file-upload path. The `transcription/` folder is a
  facade, so swapping providers touches that folder only.
- **Word-precise replay** — transcript word timestamps are relative to the recording's
  start, so replay loads the file and seeks straight to that word.
- **Word timings after an edit** — the same word count keeps each word's exact timing; a
  different count spreads the words evenly across the segment's original span, so replay
  keeps working on edited text.

## Known limitations

- **The Groq key ships inside the JS bundle.** `EXPO_PUBLIC_` variables are compiled into
  the client, so anyone can extract it. This is a POC shortcut, not a shipping pattern —
  the fix is a server-side proxy (noted in `devpost/prod.md`).
- **Android only.** iOS was never built or tested.
- **Sign-language segments are not implemented** — they were kept as a "Later" stretch and
  are explicitly out of the POC. The app records voice only.
- **Transcription needs internet** and depends on Groq's free tier, so rate limits apply.
- The `EXPO_PUBLIC_HF_TOKEN` line in `.env.example` is a leftover from the original
  Hugging Face provider and is no longer read by any code.

## Troubleshooting

- **Bubble says "transcription unavailable"** — missing or invalid `EXPO_PUBLIC_GROQ_API_KEY`,
  no internet, or the free-tier rate limit. The audio is kept and still replays. The key must
  be in place **before** `npx expo start`, because env vars are read at bundle time.
- **"no audio recorded"** — the take was silent, so no segment was added. That is by design.
- **Metro crashes with `Cannot read properties of undefined (reading 'transformFile')`** —
  hit once during development: an interrupted `npm install` left a truncated nested package
  inside `node_modules`, and Metro swallowed the real `MODULE_NOT_FOUND` error behind that
  misleading message. Fix: delete `node_modules` and re-run `npm install`. No `src/` file
  was involved.

## Checks

```bash
npx tsc --noEmit                      # TypeScript
npx expo export --platform android    # production bundle builds
```

## Planning docs

`devpost/` holds the working set: `scope.md`, `prd.md`, `spec.md`, `checklist.md` (the build
log, including learner decisions and revisions), `app-map.html` (code tour), and
`production-notes.md` (what comes after the POC).

## License

MIT — see [LICENSE](LICENSE).