---
doc: spec
status: approved
---
<!-- Written by 4-spec from the technical interview. `devpost/spec.html` is the visual companion; this file is canonical.
     Every component cites the prd.md heading it implements. -->

# VoiceNote — Technical Spec

## How This Works, In Plain Language

You open the app and see **one dark note screen**. You tap the round red button and talk; the button pulses while it hears you. When you tap again, a grey bubble appears with animated dots — while those dots run, the app is **sending your finished recording to a free Whisper model on Groq**, which sends back the words *with the time each word was spoken*. The words land in the bubble and stay there. In view mode you read the note like normal text; when you long-press any word in a voice bubble, the phone vibrates and the recording starts **from that exact word**, with a little ring animating in the top-left corner until you lift your finger. The app's own memory is a single JSON file on the phone: which segments exist, their text, their order, where each audio file lives, and the word timestamps. Force-quit the app and everything comes back. That's the whole machine — one screen, one file of text, one round-trip to the cloud for text.

## Stack

| Layer | Choice | Why (and what it replaces) |
|---|---|---|
| App framework | React Native + **Expo** (latest stable SDK at build time) | POC-sized setup; `npx expo start` runs it |
| Language | **TypeScript** (Expo default) | The segments/words data shapes benefit from checking; flip to JS if preferred — one flag at scaffold time |
| UI | Single screen, no navigation library | PRD is one screen; React Navigation from DESIGN.md 2.2 is unnecessary here |
| Audio record + playback | **`expo-audio`** | Replaces DESIGN.md's `expo-av` (deprecated, removal in SDK 55); record, play, seek |
| Media + note storage | **`expo-file-system`** | Audio files *and* the note's JSON file both live on the phone |
| Speech-to-text | **Groq free tier** (Whisper `whisper-large-v3-turbo`) — revised from Hugging Face Inference API (see checklist Revisions) | Replaces DESIGN.md 2.2's `expo-speech-recognition`: PRD decided transcription happens **after** stop, from the finished file, with word timestamps; the on-device recognizer can't do file-based transcription with word timings. Groq chosen for the no-card free limits. |
| Persistence model | **One `note.json`** — learner decision | Replaces DESIGN.md 3.1's SQLite schema (which goes to the upgrade path); one note does not need tables |
| Vibration | React Native built-in `Vibration.vibrate()` | No package, works in Expo Go |
| Haptics/permissions | Expo runtime permissions (mic) | No custom native module → **Expo Go compatible** (see *Where It Runs*) |

Develops: prd.md *Product Decisions* (post-stop transcription), scope *The POC Boundary* (Android, local build cost).

## Components

### 1. `App.tsx` — shell and state owner

- Loads the note from disk on launch; holds the current note in React state; saves it back after every change (debounced or on change — simple is fine).
- Owns the two pieces of global UI state: **mode** (`view` | `edit`) and **playback state** (which word is playing, or none).
- Implements prd.md > *States & Edge Cases* ("App restarted / force-quit → restored exactly").

### 2. `NoteScreen.tsx` — the one screen

- Layout, top to bottom: **progress ring** (top-left, only during playback) → **mode toggle** (top-right) → **segment list** (middle, scrolls) → **record button** (bottom-right, fixed).
- Renders empty state: plain black note with a blinking cursor (edit mode default).
- Implements prd.md > *The Core Journey*, *Look and Feel* (black background).

### 3. `SegmentBubble.tsx` — typed segments and voice bubbles

- **Typed segment:** plain note text.
- **Voice segment:** grey, rounded, matte/translucent bubble (PRD *Look and Feel*) containing the transcript words.
- **View mode:** renders words as individually pressable spans; a long-press on a word starts playback of that segment **from that word's timestamp** (PRD *Replay in place*). A plain tap does nothing.
- **Edit mode:** the segment's text becomes an editable field (tap to fix a mistranscription, PRD *Modes*). Editing text never touches the audio.
- While transcribing: shows the animated 1-2-3 dots instead of text (PRD *Transcription*).
- Handles the failed-transcription state: "transcription unavailable", audio kept (PRD *States & Edge Cases*, approved assumption).

### 4. `RecordButton.tsx` — capture control

- Round red button, bottom right; tap to start, tap to stop (PRD *Capture*).
- Pulses while the mic is hearing sound; holds still during silence.
- **Implementation note (fallback recorded):** pulsing uses the recorder's level/metering reading when the platform exposes one. If metering is unavailable, the button pulses continuously while recording (mic-health indicator degrades; the *silent-recording notice* below is unaffected — it is driven by an empty transcription result rather than an audio analysis, which produces the same user outcome: no segment + "no audio recorded").

### 5. `ProgressRing.tsx` — playback indicator

- Circular ring, top-left, animates from 0→100% across the playing audio (PRD *Replay in place*).
- Driven by playback position polled ~10×/sec while playing.

### 6. `ModeToggle.tsx` — view / edit switch

- Top-right button, fixed position for the POC (PRD *Modes*).
- Edit mode is the default on open; toggling to view disables editing and enables long-press replay.

### 7. `src/features/recorder.ts` — record and stop

- Starts/stops recording via `expo-audio`; on stop, moves the finished file from the temp location to a permanent app directory (`documents/recordings/`) via `expo-file-system` (adapted from DESIGN.md 3.3).
- Exposes the mic level (for `RecordButton`) while recording, when the platform provides it.
- Implements prd.md > *Capture*, *Transcription* (produces the file the transcriber consumes).

### 8. `src/features/transcription/` — the transcriber

- `types.ts`: the contract — `transcribe(audioUri) → { words: Word[] }` where each word has `text`, `startMs`, `endMs` (timestamps relative to the recording's start).
- `groq.ts`: the only implementation. Reads the file, POSTs it to the Groq speech-to-text endpoint with `EXPO_PUBLIC_GROQ_API_KEY` (from `.env`, never committed; the `EXPO_PUBLIC_` prefix is required — Expo only exposes prefixed vars to the app), requests word-level timestamps (`timestamp_granularities[]=word`), maps the response into `Word[]`. (Provider was Hugging Face at spec time; HF's free tier began returning 402 — see checklist Revisions.)
- `transcri.ts`: thin facade so swapping in Google later is this folder only (learner decision).
- **Empty result → PRD's "no audio recorded" notice** (segment not added). **Error/timeout → PRD's "transcription unavailable" bubble** (audio kept, replay works).
- Cold-start note: the first call to a free endpoint can take ~15–30 s; the PRD's 1-2-3 dots state is the cover, and a visible failure beats a hang — timeouts are bounded.

### 9. `src/features/player.ts` — in-place replay

- Loads a segment's audio file, `seekTo(word.startMs)`, plays; stops on finger-release or when audio ends (PRD *Replay in place*).
- Fires `Vibration.vibrate()` once at start.
- Reports playback position for `ProgressRing`.
- Word-precise start is the **top build risk** (PRD *What "Working" Looks Like*): it depends on Whisper's word timestamps lining up with the audio clock. Verify on device early.

### 10. `src/features/noteStore.ts` — persistence

- `loadNote()` / `saveNote(note)` reading and writing `documents/note.json` (plain UTF-8 JSON).
- Owns the audio-directory paths and, on save, keeps `audioUri`s pointing at files that still exist.
- Implements prd.md > *States & Edge Cases* ("App restarted / force-quit → everything restored").

### 11. `src/features/segments.ts` — pure logic (unit-testable)

- Types (`TypedSegment`, `VoiceSegment`, `Word`, `Note`) plus pure helpers: create a segment, insert at a tapped position, edit a segment's text, map a word to its playback start time.
- No React, no native APIs here — this is the file Jest can test cheaply (DESIGN.md 4.1's separation of concerns, kept).

## Data Model

```ts
// src/features/segments.ts
type Word    = { text: string; startMs: number; endMs: number };

type Segment =
  | { id: string; kind: "typed"; text: string }
  | { id: string; kind: "voice"; text: string;
      audioUri: string;          // permanent path, e.g. documents/recordings/<id>.m4a
      durationMs: number;
      words: Word[] | null };    // null = transcription not finished (transcribing / failed)

type Note = { segments: Segment[]; updatedAt: number };  // the whole document
```

- `note.json` on disk is a serialization of `Note` — no tables, no IDs table (DESIGN.md 3.1 is the upgrade path, not this POC).
- Audio files live beside it in `documents/recordings/`; only the path is stored (DESIGN.md 3.3, unchanged — still the right call).
- `words: null` covers both "still transcribing" (dots) and "failed" (message); an empty transcript from the engine means the recording was silent → segment is never persisted.

## Data Flow — voice segment, start to finish

1. User taps `RecordButton` → `recorder.start()` → mic captures.
2. Tap again → `recorder.stop()` → file moved to `documents/recordings/`.
3. A `voice` segment (`words: null`) is appended to the note in state → bubble shows the 1-2-3 dots → `noteStore.saveNote()` persists it.
4. `transcription/groq.transcribe(audioUri)` → `Word[]` → segment gets `text` + `words` → save again.
5. View mode: long-press a word → `player.play(segment.audioUri, word.startMs)` + vibrate → `ProgressRing` animates → release → stop.
6. Edit mode: tap text → edit → `segments.editText()` → save.
7. Restart → `noteStore.loadNote()` → same note, same order, same audio paths.

## Where It Runs and How Someone Tries It

**Primary path — Expo Go (zero build):**

1. On your machine: Node installed, `npm install` in the project root.
2. Put your Groq key in `.env` as `EXPO_PUBLIC_GROQ_API_KEY=gsk_...` (gitignored; `.env.example` lists the name).
3. `npx expo start` → on the phone (same Wi-Fi), open **Expo Go** (Android) → scan the QR code.
4. First record tap prompts for microphone permission — allow it.
5. Internet needed only for the transcription round-trip; everything else is local.

**Fallback — local dev client (from scope *The POC Boundary*, if Expo Go blocks anything):**
`npx expo run:android` — needs the Android SDK locally; compiles, installs, starts the dev server. No EAS account, no cloud queue. Pure JS changes after that only need `npx expo start`.

**Demo (PRD *What "Working" Looks Like*):** the same flow, screen-recorded, under a minute.

## External Services & Dependencies

| Thing | Link | Notes |
|---|---|---|
| Expo docs | https://docs.expo.dev/ | `npx expo start`, SDK management |
| `expo-audio` | https://docs.expo.dev/versions/latest/sdk/audio/ | record / play / seek |
| `expo-file-system` | https://docs.expo.dev/versions/latest/sdk/filesystem/ | permanent audio + `note.json` |
| Groq speech-to-text | https://console.groq.com/docs/speech-to-text | free developer key (no card); upload + word timestamps — payload confirmed against this during build |
| React Native `Vibration` | https://reactnative.dev/docs/vibration | replay start marker |
| Expo environment vars | https://docs.expo.dev/guides/environment-variables/ | `EXPO_PUBLIC_` prefix |

## Risks & Early Verifications (build order matters)

1. **Word-precise start** (PRD's hardest promise): whisper word timestamps vs. audio seek accuracy — prove on device in the first playback spike, before UI polish.
2. **Free HF endpoint availability/latency**: cold starts and rate limits are real; bounded timeouts + the dots state cover it, and the transcriber's seam keeps Google as a one-folder swap.
3. **Mic metering for the pulse**: if the platform doesn't expose a live level, the documented fallback is continuous pulse during recording.
4. **Expo Go compatibility**: the chosen stack uses only Expo-bundled modules — if a surprise requires native code, fall back to `npx expo run:android` (already approved in scope).
5. **DESIGN.md drift**: this spec supersedes DESIGN.md §2.2 (`expo-av`, `expo-speech-recognition`), §3.1 (SQLite), §5 (multi-screen flows) for the POC. DESIGN.md remains the vision doc for Later — do not build to it verbatim in `5-build`.

## File Structure (complete, annotated)

```
Noteapp/
├── App.tsx                    # loads the note, owns mode + playback state, saves on change
├── app.json                   # Expo config: name, Android package, mic permission string
├── package.json               # dependencies below; npm is the package manager
├── tsconfig.json              # TypeScript config (Expo default)
├── babel.config.js            # Expo/Babel preset
├── .env.example               # EXPO_PUBLIC_HF_TOKEN=hf_...  (real .env is gitignored)
├── .gitignore                 # existing rules + .env, node_modules, android/ build output
│
├── assets/                    # icon/splash images (Expo defaults fine for the POC)
│
├── src/
│   ├── screens/
│   │   └── NoteScreen.tsx     # the one screen: ring, toggle, segments, record button
│   ├── components/
│   │   ├── SegmentBubble.tsx  # typed text / voice bubble / dots / edit / long-press word
│   │   ├── RecordButton.tsx   # red round button, tap start/stop, pulse behavior
│   │   ├── ProgressRing.tsx   # top-left playback ring
│   │   └── ModeToggle.tsx     # top-right view/edit switch
│   └── features/
│       ├── segments.ts        # types + pure logic (the only Jest-tested file in the POC)
│       ├── recorder.ts        # start/stop recording, move file to permanent storage, mic level
│       ├── player.ts          # load, seekTo(word.startMs), play/stop on release, position ticks
│       ├── noteStore.ts       # load/save documents/note.json, audio paths
│       └── transcription/
│           ├── transcri.ts    # the swappable facade (interface + default export)
│           ├── groq.ts # Groq upload, word-timestamp response mapping
│           └── types.ts       # Word/Transcript shapes
│
├── __tests__/                 # segments.ts tests (jest-expo preset) — optional in the POC
│
├── devpost/                   # planning docs (scope, prd, spec, html companions)
└── DESIGN.md                  # vision doc; superseded sections noted in this spec
```

**Dependencies to add:** `expo`, `expo-audio`, `expo-file-system`, plus dev: `typescript`, `@types/react` (all `npx expo install`-managed so versions match the SDK). Nothing else — no navigation, no database, no state library.

**On device at runtime:**

```
documents/
├── note.json                  # the Note document
└── recordings/
    └── <segmentId>.m4a        # one file per voice segment, permanent
```

