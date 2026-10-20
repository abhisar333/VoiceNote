---
doc: production-notes
status: draft
---
<!-- Recorded in the build loop at the learner's request: the production path
     for VoiceNote. Not part of the POC checklist — this is "what comes after".
     Markdown only, always. -->

# Production Notes

## 1. SQLite migration sketch (noteStore → expo-sqlite)

Decision recap: the POC runs on one JSON document + audio files by design
(spec.md: "No tables — one JSON document (learner decision). DESIGN.md's SQLite
schema is the upgrade path, not this POC"). The migration is contained because
all persistence goes through `src/features/noteStore.ts`.

### Schema (first version — v1)

```sql
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  title      TEXT,                -- NULL/absent = "No title"
  updated_at INTEGER NOT NULL,    -- epoch ms (same as today)
  draft      TEXT                 -- autosaved composer text
);
CREATE INDEX idx_notes_updated ON notes(updated_at);

CREATE TABLE segments (
  id          TEXT PRIMARY KEY,
  note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,   -- ordering inside the note (spec order)
  kind        TEXT NOT NULL CHECK (kind IN ('typed','voice')),
  text        TEXT NOT NULL DEFAULT '',
  audio_uri   TEXT,               -- voice only; NULL for typed
  duration_ms INTEGER,            -- voice only
  words_json  TEXT                -- Word[] as JSON text (see "when NOT to")
);
CREATE INDEX idx_segments_note ON segments(note_id, position);
```

### Module swap — the seam

```ts
// noteStore.ts keeps its PUBLIC contract; internals change only:
export async function loadNotes(): Promise<Note[] | null>;   // SELECT + hydrate
export function saveNotes(notes: Note[]): void;              // → upsert/tx
export function deleteNoteAudio(note: Note): void;           // unchanged (FS)
export function deleteSegmentAudio(segment: Segment): void;  // unchanged (FS)
// New (SQLite-era only):
export function migrateLegacyJsonIfPresent(): Promise<void>;
```

No component, screen, or feature code changes — App.tsx keeps calling the same
functions. Audio stays out of the DB entirely (paths only), same as today.

### Why this beats the current write path

Today every state change rewrites the whole `notes.json`. With rows, a keystroke
draft-save upserts one row; a segment transcript update touches one row; a note
delete is `DELETE FROM notes WHERE id = ?` (cascade). The 30-saves-per-minute
typing pattern stops being O(notebook).

### Migration (one-time, on launch, before loadNotes)

1. `PRAGMA user_version` = 0 → fresh DB, check `documents/notes.json` exists.
2. Parse it (existing `restoreNote` validation already exists — reuse it).
3. Insert notes + segments inside ONE transaction; on success write
   `PRAGMA user_version = 1`, then rename `notes.json` → `notes.json.migrated`
   (keep the original — a crash between commit and rename must not duplicate).
4. Corrupt JSON → same POC behavior as now: start fresh, but telemetry event
   (see §2c) instead of silence.

### Decisions recorded, not assumed (settle at migration time)

- **`words_json` vs a words table:** JSON-in-a-column is fine at this scale and
  keeps replay reads one query (note → segments with words). Move to a `words`
  table only if something needs to query *inside* transcripts (nothing does).
- **Async API only:** expo-sqlite's async API — sync calls block the JS thread
  that also drives the keyboard and the audio pipeline.
- **Expo Go:** `expo-sqlite` ships with SDK 57, so a trial swap needs no native
  rebuild in the current dev setup.

## 2. Runtime concerns — rate limits, offline, telemetry (item #4)

### 2a. Rate limits & quota

- **Move the Groq key server-side first.** `EXPO_PUBLIC_GROQ_API_KEY` ships
  inside the JS bundle — extractable by anyone. Production: client → your
  backend proxy (holds key, authenticates users) → Groq. Per-user daily
  audio-second quotas live at the proxy; the app never sees the key.
- **Distinguish failure classes in the UI:** 429 → "busy, retry shortly" with
  backoff; 5xx/timeout → retry then fail; 401/billing → admin alarm (user sees
  a generic failure, you get paged). Today all collapse into the single
  `transcription unavailable` message.
- **Silent retries inside the dots window:** transient errors retry 1–2× before
  any failure message renders. Audio is always kept and ↻ Re-transcribe exists,
  so any terminal failure stays recoverable by hand.

### 2b. Offline behavior

- **Capture is already offline-first; make the async part durable.** Recording
  writes a local `.m4a` regardless of network. Production adds a persistent
  pending-transcription queue: stop-while-offline marks the segment pending,
  shows *"Saved — transcribes when you're back online"*, and a worker (next
  launch / background task) drains it through the same `setVoiceTranscript`
  path — the segment already exists, so no duplicates.
- **Detect offline in milliseconds (`NetInfo`)** instead of today's worst case:
  30-second timeout → error message.
- **Persist "needs transcription" as state, not an error string.** Today a
  failed segment is `words: null` + error text — ambiguous. Production: an
  explicit pending flag survives force-quit; the queue is a DB concern, so it
  arrives naturally with §1.
- **Keep reads fully offline** — edit, replay, search, delete already work with
  no network. Don't regress this.

### 2c. Error telemetry

- **Crashes:** Sentry RN (or Bugsnag) for JS + native + unhandled rejections,
  source-mapped. Redboxes exist only in dev.
- **The swallowed catches are the priority.** `noteStore` save/delete failures
  and the corrupt-file → start-fresh path are deliberate resilience choices —
  production rule: **swallow only after logging.** Otherwise a user losing 50
  notes looks identical to a user with zero.
- **Transcription pipeline instrumentation (#1 watch):** started / succeeded /
  failed(status, reason) / latency / empty-transcript rate / punctuation-only
  rate. Where the POC's real bugs would have surfaced as data: the Whisper
  `.`-on-silence quirk (punctuation-only rate), the `expected Map, got a
  string` crash (JS exception + stack), Groq 401/429 spikes (timeseries).
- **Breadcrumbs before dashboards:** structured events with ids, counts,
  durations, reasons — never note text or audio (user speech = the privacy
  line). Examples: `transcription_finished{ms, status}`,
  `note_deleted{has_audio}`, `retranscribe{language}`.
- **Alert on failure-rate spikes.** You only know what you measure on the real
  runtime — same lesson as the checklist's machine-vs-device verification rule.

### The interlock

Key moves server-side (2a) → that server becomes the offline queue (2b) →
every hop through it is where telemetry sits (2c) — and every failure path
lands back in the dots → retry → ↻ Re-transcribe states the UI already has.
The POC's seams (facade in `noteStore`, facade in `transcription/`, audio kept
on failure) were built so this is a contained expansion, not a rewrite.

