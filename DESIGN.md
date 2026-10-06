# VoiceNote — Software Design Document

**Version:** 1.0
**Status:** In development (pre-release)
**Platform:** iOS & Android (React Native / Expo)

---

## 1. Overview

VoiceNote is a mobile note-taking app that lets a user compose a single note
using three input modes — typed text, spoken voice, and recorded sign
language — and mix them freely within the same note. Any voice or
sign-language portion of a note retains its original recording, which can
be replayed later by interacting with that portion of the note.

### 1.1 Problem statement

Conventional note-taking apps support either typing or (at best) a single
voice-to-text dictation mode, and once dictation completes, the original
audio is typically discarded — only the transcript survives. This loses
information: tone, emphasis, and (for sign language) the entire message
itself, since no reliable text transcription of sign language exists.
VoiceNote treats the recording itself as a first-class, permanently
retrievable part of the note, with text as a searchable/skimmable
companion to it rather than a full replacement.

### 1.2 Goals

- Let a user compose one note using any mix of typed, spoken, or
  sign-language input.
- Automatically transcribe spoken input to text using on-device speech
  recognition.
- Preserve and allow replay of the original audio/video for any
  voice/sign portion of a note, at any time.
- Allow captions to be added, skipped, or edited independently of when
  the recording was made.
- Work fully offline, with no backend, for v1.

### 1.3 Non-goals (v1)

- Automatic sign-language-to-text recognition. No production-grade model
  exists for this; see §7.2 for the explicit design decision and
  rationale.
- Multi-device sync / cloud backup.
- User accounts, authentication, or multi-user collaboration.
- Rich text formatting, note folders/tags, or note sharing/export.

---

## 2. System Architecture

### 2.1 High-level architecture

VoiceNote is a single-tenant, offline-first, client-only mobile
application. There is no backend service in v1 — all data and media live
entirely on the device.

```
┌─────────────────────────────────────────────────────────┐
│                      React Native App                    │
│                                                           │
│  ┌───────────────┐   ┌────────────────┐   ┌────────────┐ │
│  │ NotesListScreen│──▶│NoteEditorScreen│──▶│SignRecorder│ │
│  └───────────────┘   └────────┬───────┘   │   Screen   │ │
│                                │            └─────┬──────┘ │
│                    ┌───────────┼──────────────────┘        │
│                    ▼           ▼                            │
│         ┌──────────────┐ ┌──────────────┐  ┌─────────────┐ │
│         │useAudioRecorder│useSpeechToText│  │useVideoRecorder│
│         └───────┬──────┘ └──────┬───────┘  └──────┬──────┘ │
│                 │               │                  │        │
│         ┌───────▼───────────────▼──────────────────▼──────┐│
│         │        Native modules (expo-av, expo-speech-     ││
│         │  recognition, expo-camera, expo-file-system)     ││
│         └───────────────────────┬───────────────────────────┘│
│                                  │                             │
│                    ┌─────────────▼─────────────┐              │
│                    │   src/db/database.js       │              │
│                    │   (expo-sqlite, local)     │              │
│                    └─────────────┬─────────────┘              │
│                                  │                             │
│                    ┌─────────────▼─────────────┐              │
│                    │   Device local storage      │              │
│                    │  (SQLite file + audio/video  │              │
│                    │   files in app sandbox)      │              │
│                    └───────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Technology stack

| Layer | Choice | Rationale |
|---|---|---|
| App framework | React Native + Expo (SDK 52) | Single codebase for iOS + Android; managed tooling reduces native build complexity for a solo/beginner developer |
| Navigation | React Navigation (native-stack) | De facto standard for Expo apps; supports modal presentation for the camera screen |
| Local database | expo-sqlite (async API) | Structured, relational data (notes → segments) fits SQL better than a flat key-value store; no backend needed for v1 |
| Audio I/O | expo-av | Mature, stable recording + playback API |
| Speech-to-text | expo-speech-recognition | Wraps the OS's built-in on-device speech recognizer (same engine behind Siri dictation / Android voice typing); free, no network call, no API key |
| Camera / video | expo-camera | Standard Expo camera module, supports video capture mode |
| File persistence | expo-file-system | Moves temporary recordings into the app's permanent document directory |
| Testing | Jest (via jest-expo preset) + @testing-library/react-native | Standard RN testing stack; jest-expo auto-mocks native modules for tests that don't need a real device |
| CI | GitHub Actions | Free for public repos, minimal config, industry-standard |

### 2.3 Why no backend (v1)

A backend was deliberately deferred. The core value proposition (mixed
typed/voice/sign notes with playback) is fully realizable on-device, and
adding a backend would introduce auth, sync conflict resolution, and
hosting costs before the core UX was validated. The data layer
(`src/db/database.js`) is isolated behind plain async functions
(`getNotes`, `addSegment`, etc.), so a future sync layer could be added
without changing calling code in the screens.

---

## 3. Data Model

### 3.1 Schema

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,   -- unix ms
  updated_at INTEGER NOT NULL    -- unix ms
);

CREATE TABLE segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('typed', 'voice', 'sign')),
  text TEXT NOT NULL DEFAULT '',
  audio_uri TEXT,                -- set only when type = 'voice'
  video_uri TEXT,                -- set only when type = 'sign'
  position INTEGER NOT NULL,     -- order within the note
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
);
```

### 3.2 Design rationale: segments, not a single text blob

The central design decision in this app is that a **note is an ordered
list of segments**, not a single string. Each segment independently
carries its own type and (optionally) its own media file. This is what
makes it possible to:

- Mix typed, voice, and sign input freely within one note, in any order.
- Attach playback to only the parts of a note that have a recording,
  rather than the note as a whole.
- Let each segment's caption be edited or added independently, without
  affecting the rest of the note.

The alternative (one text field per note, with a separate flat list of
"attachments") was considered and rejected, because it decouples *where*
in the note a recording belongs from *what* the recording is — segments
keep position, type, text, and media reference together as one atomic
unit.

### 3.3 Media storage

Audio and video files are not stored in SQLite (BLOBs would bloat the
database file and complicate backups). Instead:

- Recordings are captured to a temporary OS location by the native
  recording APIs.
- `useAudioRecorder` / `useVideoRecorder` move the finished file into a
  permanent, app-private directory (`.../documents/recordings/` and
  `.../documents/videos/` respectively) via `expo-file-system`.
- Only the resulting file URI (a plain string) is stored in the
  `segments` table.

This keeps the database small and fast, while media files live in normal
device storage, addressable by path.

### 3.4 Migration strategy

Given the app has no backend and is still pre-release, schema changes so
far have used a lightweight approach: `CREATE TABLE IF NOT EXISTS` for
new tables, plus a defensive `ALTER TABLE ... ADD COLUMN` wrapped in
try/catch for columns added after initial release (e.g. `video_uri`).
This is acceptable for a pre-release, single-developer, local-only app;
a real migration framework (versioned migrations) would be needed before
any public release with real user data at stake.

---

## 4. Module / Component Breakdown

```
App.js                              Navigation root; initializes the DB before rendering
src/db/database.js                  All SQL and data-access functions
src/hooks/useAudioRecorder.js       Records/plays voice clips (wraps expo-av)
src/hooks/useSpeechToText.js        Runs speech recognition in parallel with recording
src/hooks/useVideoRecorder.js       Persists finished video clips to permanent storage
src/utils/segmentHelpers.js         Pure functions: icons, placeholders, text fallback logic
src/components/SegmentBubble.js     Renders one segment; handles tap-to-edit and long-press playback
src/components/VideoPlayerModal.js  Full-screen video playback for sign segments
src/screens/NotesListScreen.js      Note list (create, open, delete)
src/screens/NoteEditorScreen.js     Composes a note: typed/voice/sign input, segment list
src/screens/SignRecorderScreen.js   Camera UI: record, preview, retake, confirm
```

### 4.1 Separation of concerns

A deliberate line is drawn between **pure logic** and **native-touching
code**:

- `segmentHelpers.js` contains zero React, zero native module calls —
  just plain functions operating on plain data. This is what makes it
  unit-testable without a device or emulator.
- Hooks (`useAudioRecorder`, `useSpeechToText`, `useVideoRecorder`) are
  thin wrappers around native modules. They are *not* unit tested (see
  §6), because doing so would require mocking away the exact behavior
  under test.
- Screens compose hooks + pure helpers + components, and hold UI state
  (what's currently being recorded, what's pending, etc.).

This split is the main mechanism by which the app stays testable despite
being heavy on native device APIs.

---

## 5. Key User Flows

### 5.1 Adding a typed segment

1. User types in the text input at the bottom of `NoteEditorScreen`.
2. Taps **Add**.
3. `addSegment(noteId, { type: 'typed', text })` is called; the segment
   list reloads from the DB.

### 5.2 Adding a voice segment (with auto-transcription)

1. User presses and holds the mic button (`onPressIn`).
2. Two things start concurrently:
   - `useAudioRecorder.startRecording()` — begins capturing raw audio.
   - `useSpeechToText.startListening()` — begins live speech recognition
     on the same mic input (see §7.1 for the concurrency risk this
     introduces).
3. User releases the button (`onPressOut`).
4. Both are stopped in parallel via `Promise.all`:
   - `stopRecording()` resolves with the final audio file URI.
   - `stopListening()` resolves with the final transcript string, once
     the recognizer's `end` event fires.
5. The transcript auto-fills the text input; the audio URI is held as
   "pending."
6. User reviews/edits the transcript, then either:
   - Taps **Add** → `addSegment(noteId, { type: 'voice', text, audioUri })`
   - Taps **Skip** → same call, with `text: ''`
7. Segment list reloads; the new segment renders with a mic icon and
   (if uncaptioned) placeholder text "Tap to add a caption."

### 5.3 Adding a sign-language segment

1. User taps the 🤟 button, which navigates to `SignRecorderScreen`
   (presented as a full-screen modal) with an `onRecorded` callback.
2. User records via `CameraView.recordAsync()` / `stopRecording()`.
3. A preview plays automatically (looping); user chooses **Retake**
   (discard, re-record) or **Use this recording**.
4. On confirm, the clip is moved to permanent storage
   (`saveVideoPermanently`), the callback fires with the final URI, and
   the app navigates back to `NoteEditorScreen`.
5. From here, the flow matches voice (§5.2 steps 5–7), except there is
   no automatic caption — the user always types (or skips) it manually,
   since automatic sign recognition is out of scope (§1.3, §7.2).

### 5.4 Editing a segment's text later

1. User taps (not long-presses) any segment in the list.
2. `SegmentBubble` enters an inline edit state, showing a `TextInput`
   pre-filled with the current text, plus Save/Cancel controls.
3. **Save** calls `onSaveText(segment.id, newText)`, which the screen
   wires to `updateSegmentText()` in the DB layer, then reloads.
4. **Cancel** discards the draft and returns to read-only display.

This flow is identical regardless of segment type (typed/voice/sign),
which is why the caption can always be added after the fact even if it
was skipped at capture time.

### 5.5 Playing back a recording

- Long-pressing a **voice** segment calls `useAudioRecorder.playRecording(audioUri)`,
  which plays inline via `expo-av`'s `Sound` API — no separate UI, audio
  just plays.
- Long-pressing a **sign** segment opens `VideoPlayerModal`, a full-screen
  modal showing the video with native playback controls, since video
  (unlike audio) needs a visible surface to render into.

---

## 6. Testing Strategy

### 6.1 What is and isn't automatically tested

| Testable without a device | Requires a real device |
|---|---|
| `segmentHelpers.js` pure functions | Actual audio recording quality |
| `SegmentBubble` render + interaction logic (edit flow, placeholder text, callback wiring) | Actual camera capture |
| — | Speech recognition accuracy |
| — | Whether `expo-av` and `expo-speech-recognition` can both hold the mic concurrently (see §7.1) |
| — | SQLite read/write correctness in the actual native SQLite engine |

This split is intentional, not a gap to be "fixed" — mobile apps with
significant native-API surface area cannot be fully verified by
JS-only unit tests. The design goal is to maximize the *proportion* of
logic that lives in the pure/testable layer (§4.1), and rely on manual
testing plus (in future) on-device automated testing for the rest.

### 6.2 Automated tests (current)

- **`src/utils/__tests__/segmentHelpers.test.js`** — unit tests for
  `resolveSegmentText`, `segmentIcon`, `segmentPlaceholder`,
  `isMediaSegment`.
- **`src/components/__tests__/SegmentBubble.test.js`** — component tests
  via `@testing-library/react-native`, covering: render of typed text,
  placeholder rendering for uncaptioned segments, long-press triggering
  playback with the correct URI, and the full tap → edit → save/cancel
  flow.

Run via `npm test` (once) or `npm run test:watch` (on file change).

### 6.3 Manual testing (current, required)

Because native behavior can't be captured by Jest, a manual test pass on
a real device is required before/after any change touching recording,
camera, or speech recognition. At minimum this should cover:

1. Press-and-hold mic → confirm both the audio file is saved *and* the
   transcript auto-fills (this is the highest-risk flow — see §7.1).
2. Long-press a voice segment → confirm the correct audio plays.
3. Record a sign clip → confirm preview, retake, and "use recording"
   all behave correctly.
4. Long-press a sign segment → confirm the correct video opens.
5. Tap a segment, edit its text, Save → confirm it persists after
   navigating away and back.
6. Tap Skip on a pending recording → confirm it saves with the
   placeholder text and can be captioned later.
7. Force-quit and reopen the app → confirm notes, segments, and media
   references all survive (SQLite + file system persistence).

### 6.4 Future: on-device automated testing

Tools like Maestro or Detox can drive the real compiled app (not a JS
mock) and would meaningfully raise confidence on flows like §6.3.
Deferred for now due to setup cost relative to the app's current stage
(see roadmap, §9).

---

## 7. Key Risks & Design Decisions

### 7.1 Risk: concurrent microphone access (voice + speech recognition)

`handleMicPressIn` starts **both** `expo-av` recording and
`expo-speech-recognition` listening at the same time, against the same
physical microphone. Whether the OS/these libraries permit two
concurrent captures cleanly is not guaranteed by documentation and is
platform/version-dependent. Possible outcomes if this doesn't work
cleanly:

- Both function correctly (best case).
- One silently produces empty/incorrect output while the other works.
- A runtime error is thrown on mic press.

**Mitigation plan:** this must be manually verified on a real device
before relying on it (§6.3, item 1). If concurrent capture proves
unreliable, the fallback plan is to make recording and transcription
**sequential** instead of parallel — e.g., transcribe from the finished
audio file after recording stops, if the library supports file-based
transcription, or accept a "record, then briefly re-listen" UX as a
worse but functional alternative.

### 7.2 Decision: no automatic sign-language recognition

Considered and explicitly rejected for v1. Unlike speech, there is no
mature, reliable, production-grade model for continuous sign-language
recognition "in the wild" — current research handles isolated signs or
small fixed vocabularies under controlled conditions, not natural
signing. Shipping an unreliable auto-transcription feature would
misrepresent its accuracy to users relying on it for real notes.

**Decision:** sign segments always require a manually-typed (or
explicitly skipped) caption, exactly mirroring how voice segments work
before speech-to-text was added. The original recording is preserved in
full regardless, so no information is lost — only the *automatic
transcription convenience* is deferred until a trustworthy model exists.
This keeps a clean seam (the segment's `text` field) where automatic
sign recognition could be plugged in later without any schema or UX
change.

### 7.3 Decision: Expo Go → custom dev client

Adding `expo-speech-recognition` (a native module) made the app
incompatible with Expo Go, which only bundles a fixed set of
Expo-maintained native modules. This was a deliberate tradeoff: Expo Go
was valuable for the earliest iterations (zero build step, instant
testing), but any nontrivial native functionality eventually requires a
custom dev client (`expo-dev-client` + EAS Build). This is a common
lifecycle stage for real Expo apps, not specific to this project.

---

## 8. Non-Functional Considerations

- **Storage growth:** every voice/sign segment stores a full media file
  on-device. There is currently no cleanup, compression, or storage-limit
  handling. For a v1 personal-use app this is acceptable; a production
  release would need file size limits, compression, and/or a "delete old
  recordings" mechanism.
- **Privacy:** all data (text, audio, video) stays entirely on-device;
  nothing is transmitted anywhere, since there is no backend and
  `expo-speech-recognition` runs the OS's on-device recognizer rather
  than a cloud API. This should be stated explicitly in-app if the app
  is ever distributed, since users may assume voice notes are processed
  in the cloud.
- **Permissions:** microphone, camera, and speech-recognition permissions
  are each requested at first use of the relevant feature, not all
  upfront, to keep the permission prompts contextual.
- **Offline support:** the entire app functions with no network
  connection, by design (v1 has no backend).

---

## 9. Roadmap (post-v1)

In rough priority order:

1. Verify the mic-concurrency risk (§7.1) on a real device; adjust the
   recording/transcription flow if needed.
2. Build and install a custom dev client; complete the manual test
   checklist (§6.3) end-to-end.
3. Ship an installable build (TestFlight / shareable APK).
4. Add segment deletion (currently only add/edit exist).
5. Add search across note titles and segment text.
6. Add a waveform or duration indicator on voice segments.
7. Introduce versioned database migrations if the schema will keep
   evolving post-release.
8. Evaluate cloud sync/backup, if multi-device use becomes a real need.
9. Revisit automatic sign-language recognition if/when a reliable model
   becomes available (§7.2).

---

## 10. Glossary

| Term | Meaning |
|---|---|
| Segment | One ordered unit within a note: typed text, or a voice/sign recording plus its caption |
| Pending recording | A voice/sign clip that has been recorded but not yet added as a segment (caption still editable) |
| Dev client | A custom-built version of the Expo Go app, containing this project's specific native modules, required once the app depends on modules Expo Go doesn't ship with |
