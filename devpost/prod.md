---
doc: prod
status: draft
---
<!-- Recorded at the learner's request: the four production gaps called out in
     the build loop, each expanded. Companion to production-notes.md (which
     holds the SQLite schema sketch and the item-4 detail). Markdown only. -->

# Production Readiness — The Four Gaps

Ordered by architectural weight, not difficulty. 1 and 2 are "how data lives";
3 and 4 are "how the app behaves in the real world." This POC's facades
(`noteStore.ts`, `transcription/transcri.ts`) were built so every item below is
a contained expansion, not a rewrite.

## 1. Audio storage — the real architectural item

**The gap.** Every recording is a `.m4a` in app-private storage
(`documents/recordings/<segmentId>.m4a`; only the path is stored in the note).
Audio dwarfs the DB — a minute of m4a is hundreds of KB against a `notes.json`
measured in KB — and app-private storage **vanishes on uninstall** (and on
"clear data"). The database question (#2) is downstream of this one: a perfect
database holding paths to deleted files helps nobody.

**Why it matters as UX, not just storage.** Delete the app once and every
recording the user ever made is gone silently — typed text may be exported or
backed up, but the voice notes are simply unrecoverable. That's the failure a
store review remembers.

### Production directions (pick by product shape)

- **Cloud upload + cache eviction (recommended for a synced product).**
  On stop-recording: upload the `.m4a` to object storage (S3/R2/Supabase
  Storage) keyed by user + segment id; keep a local copy while the note is
  recent, evict LRU when the cache budget is hit; playback streams with a
  local-cache fallback so replay works offline. Store a stable storage key in
  the DB (not just a local path) so a cache miss resolves to cloud.
  Lifecycle hooks already exist in the code: `deleteNoteAudio` and
  `deleteSegmentAudio` become "delete local cache + cloud object" instead of
  just FS deletes.
- **Scoped storage / user-export (minimum viable production).** If no cloud:
  write recordings to app-scoped external storage that survives longer, and —
  more importantly — give the user an **explicit export** (all notes as JSON +
  an `audio/` folder, e.g. via `expo-file-system` + share sheet). Export also
  covers the GDPR-ish "give me my data" requirement for free.
- **What must change in the data model either way:** `VoiceSegment.audioUri`
  becomes "local cache path, may be absent" + a durable remote key; playback
  gains a resolve step (local → download → fail with a clear message).
  `noteStore` already drops segments whose audio is gone
  (`segmentExists`) — with cloud that check becomes "local OR remote known."

**Interop with #2:** the audio table/column stores the remote key; cache
eviction decisions need the DB to know what's uploaded (a `synced_at` column),
so design #1 and #2 together, not sequentially.

**Cost note:** storage is cheap, *egress is the bill*. Voice apps that stream
playback from cloud on every replay get surprised; cache-first playback is a
cost control, not just an optimization.
## 2. Crash-safe structured storage (SQLite + schema versioning)

**The gap.** `notes.json` is rewritten whole on every state change. Three
consequences production can't accept: (a) a crash mid-write corrupts the file —
our current recovery is *start fresh*, which for real users is silent data
loss; (b) every keystroke-save is O(whole notebook); (c) no concurrent-writer
story for sync/background tasks.

**The target.** `expo-sqlite` (ships with SDK 57 — no native rebuild to trial
it), behind the existing `noteStore.ts` facade. Full schema + migration
sequence is sketched in `production-notes.md §1`; the essentials:

- **Tables:** `notes (id, title, updated_at, draft)` and
  `segments (id, note_id → cascade, position, kind, text, audio_uri,
  duration_ms, words_json)` — audio bytes stay in files (#1), the DB holds
  paths/keys only, exactly like today.
- **Contract stays:** `loadNotes`/`saveNotes`/`deleteSegmentAudio` keep their
  signatures; only internals move to SQL. App/screens/components untouched.

### Schema version + migration story (the part people skip)

- **`PRAGMA user_version`** as the schema version, incremented per migration;
  a fresh install and an upgrade path are then distinguishable in code.
- **First-launch import of `notes.json`:** if version = 0 and the legacy file
  exists → validate (reuse `restoreNote`'s checks), insert notes + segments in
  **one transaction**, bump version, then rename `notes.json` →
  `notes.json.migrated`. Order matters: commit-before-rename means a crash at
  any point either retries cleanly (file still there) or doesn't duplicate
  (file renamed only after success). Keep the migrated file for one release —
  never delete user data on the same day you move it.
- **Corrupt legacy JSON:** today → silent fresh start. Production → fresh
  start **plus** a telemetry event (#4c), and (nice-to-have) keep the corrupt
  file on disk for support forensics instead of overwriting it.
- **Forward migrations:** every schema change ships as a numbered migration
  function run in order inside a transaction; never `ALTER`-in-place ad hoc.
  Beta users generate the messy mid-state — versioning exists for *them*.
- **Backup:** on Android, `allowBackup`/auto-backup excludes app DBs by default
  in many setups; decide explicitly whether the DB goes into cloud backup (and
  then remember audio doesn't — #1 again).

**Interlock:** #2 stores the audio's remote key and sync state; #1's eviction
needs #2's queries; the offline queue of #4b is a table that only makes sense
once writes are transactional.

## 3. API keys / auth — the Groq key in the bundle

**The gap.** `EXPO_PUBLIC_GROQ_API_KEY` is compiled **into the JS bundle**.
Anything shipped client-side is extractable — `EXPO_PUBLIC_` obscures nothing;
anyone can pull the key out of the app and spend the quota (or run up a bill,
if the plan ever changes). This is the single most urgent production item
because the fix is cheap *now* and embarrassing later.

**The target architecture:**

```
App (user session) ──► your backend / edge function ──► Groq
   no secret             holds GROQ_API_KEY (env var)
                         authenticates the user
                         rate-limits + meters usage
                         logs outcomes (#4c)
```

- **Move the secret server-side.** The key lives in a server env var / secret
  manager. The app never holds any transcription secret.
- **Decide the auth model with it**, because the proxy must know *who* is
  asking: simplest is anonymous device ids + per-device quotas; real accounts
  (Auth0/Firebase/Supabase Auth) when sync or paid tiers arrive. Auth is also
  the prerequisite for per-user billing and support ("whose client is burning
  quota?").
- **Proxy contract matters for the app's existing states:** the backend
  normalizes Groq errors into the app's known classes (see #4a) instead of
  leaking raw provider statuses. Keep the request shape the app already sends
  (multipart audio → words response) so `transcription/transcri.ts` changes
  only its base URL — the facade absorbs this too.
- **Don't forget the other secrets:** nothing else sensitive ships today, but
  the pattern holds — future Sentry DSN (fine, public) vs. future payment keys
  (server-only). Rule of thumb: if losing the value costs money, it's server-side.

## 4. Rate limits, offline behavior, error telemetry

The runtime triad: today a failed call is a test observation; in production
it's a user staring at a stuck grey bubble. (Detailed version also lives in
`production-notes.md §2` — this is the full standalone pass.)

### 4a. Rate limits & quota

- **Why it bites here:** transcription is the app's only outbound API call and
  the free Groq Developer plan has generous-but-finite audio-seconds per day.
  One power user batch-processing hour-long recordings can exhaust a shared key
  for everyone — and with the key in the bundle (#3), strangers can exhaust it
  *for* you.
- **Fixes, in order:**
  1. Key server-side (#3) — without this, rate limiting is meaningless because
     the abuser holds your key.
  2. **Per-user / per-device quotas** at the proxy (e.g. N transcription-minutes
     per day), metered against authed identity, with a visible remaining-budget
     if you want generous UX ("3 free hours left today").
  3. **429 handling in the app** — today a rate-limit response surfaces as the
     generic `transcription unavailable` message. Production distinguishes:
     `429` → "busy right now" + **automatic retry with exponential backoff**;
     `5xx`/timeout → retry 1–2× then fail; `401/billing` → user sees generic
     failure, *you* get paged.
  4. **Silent retries inside the dots window.** The PRD's states are
     dots → text or dots → failure; transient errors should be absorbed inside
     the dots before any failure message renders. Terminal failures stay
     recoverable because audio is always kept and the ↻ Re-transcribe button
     re-submits it — the UI already has the retry path, production just adds
     automatic first attempts.
- **Load shape to plan for:** record-then-transcribe is bursty (user stops
  recording → immediate request). If batch features arrive (transcribe all
  pending), quota planning shifts from requests/min to audio-seconds/day and
  the queue in 4b becomes the throttle.

### 4b. Offline behavior

- **What already works (don't regress):** capture, playback, typing, editing,
  search, delete, long-press replay — all offline. Recording writes a local
  `.m4a` regardless of network. The architecture is already "capture offline-
  first, intelligence async"; production makes the async part durable.
- **What's broken offline today:** the transcription call fails *after the
  30-second timeout* and shows an error — no distinction between "no network"
  and "server said no," and nothing retries.
- **Production design:**
  1. **Detect offline in milliseconds** with `NetInfo` instead of waiting out
     the timeout. Stop-while-offline → immediate honest state: *"Saved — will
     transcribe when you're back online."*
  2. **A persistent pending-transcription queue.** The segment already exists
     with `audioUri`; mark it pending (explicit state, not the ambiguous
     `words: null` + error text we use now), survive force-quit via #2, and
     drain on next launch / background task through the same
     `setVoiceTranscript` path — no duplicate segments, idempotent by
     construction.
  3. **Offline UX honesty:** failed-vs-pending must look different — pending
     shows a calm waiting indicator (the dots or a "queued" chip), failure with
     audio kept shows ↻ Re-transcribe. Never show an error for what is really
     a queue.
  4. **Sync (if it comes)** rides the same queue: local-first writes,
     last-write-wins or per-note CRDT — a larger topic, but the infra overlaps.

### 4c. Error telemetry

- **Why it's first-class, not garnish:** in dev you see redboxes; in the store
  you hear nothing unless the app tells you. And this codebase's most important
  failures are *silent by design* — failed save → ignore, failed audio delete
  → ignore, corrupt JSON → start fresh. Each is a correct resilience choice
  that also makes an incident invisible. Production rule: **swallow only after
  logging.**
- **Crash reporting:** Sentry RN (or Bugsnag/Crashlytics) for JS + native
  crashes + unhandled promise rejections, with release tagging and
  source-mapped stacks.
- **Instrument the transcription pipeline first (#1 watch):** events for
  started / succeeded / failed(reason, status) / latency / empty-transcript
  rate / punctuation-only rate. This is exactly where the POC's real bugs
  would have surfaced as data instead of device sessions:
  - Whisper's `.`-on-silence quirk → punctuation-only-transcript rate
  - the `expected Map, got a string` crash → JS exception with stack
  - Groq 401/429/timeout spikes → status-code timeseries
- **Breadcrumbs before dashboards:** structured events with ids, counts,
  durations, reasons — start with the event stream, build charts where a
  question repeats. **PII line: never log note text or audio** (user speech is
  the sensitive asset); log `segment_id`, `language`, `status`, `ms`.
- **Close the loop with alerting:** a failure-rate spike should page you, not
  wait for a review. Same lesson as the checklist's machine-vs-device
  verification rule — you only know what you actively measure on the real
  runtime.

### Interlock of all four

Audio (#1) is the biggest architectural item because uninstall wipes it and
the DB can't help; the DB (#2) makes writes crash-safe and gives #4b a table
to queue in; the key (#3) must move server-side before #4a's quotas mean
anything; and that server becomes the natural place for #4c's observability —
every hop through the proxy is a hop you can measure. Failures flow back into
the dots → retry → ↻ Re-transcribe states the UI already has. In order:
**3 → 2 → 1 → 4** is the practical sequence (cheapest risk retired first),
but design the four as one system.

