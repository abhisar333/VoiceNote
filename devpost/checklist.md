---
doc: checklist
status: approved
---
<!-- Written by 5-build from the approved spec. Progress state for the build loop:
     tick boxes as slices complete; resume reads this file. Markdown only, always. -->

# Build Checklist

Build mode: learn

## Slices

- [x] **1. The app runs, and typing a line puts it in your note**
  Becomes usable: A running VoiceNote on your phone — black note screen, red round record button (visible, not working yet), top-right view/edit toggle, blinking cursor; in edit mode tapping empty space and typing creates a typed segment that renders as note text.
  Why now: Bootstrapping lives inside slice one per the plan, and a visible screen you can type into gives every later slice somewhere to land. The kernel needs the screen first.
  PRD ref: `prd.md > The Core Journey` (steps 1, 7-typing), `prd.md > Modes`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > File Structure`, `spec.md > Components` (App, NoteScreen, ModeToggle, RecordButton shell)
  Build: Scaffold Expo + TypeScript per the file structure, install expo-audio and expo-file-system, build the NoteScreen layout and typed-segment creation (state only, no save yet).
  Verify (mechanical): `npx tsc --noEmit` passes; `npx expo start` boots Metro with no errors; app loads on device/emulator.
  Learner check: Open the app, tap empty space, type a line — it appears in the note; looks black/red/grey as specified.
  Commit: `Scaffold note screen with typed segments`

- [x] **2. Talk, stop, and your words fill a grey bubble (the kernel)**
  Becomes usable: Tap the red button → it pulses while it hears you → tap again → grey bubble with 1-2-3 dots → transcript lands in the bubble. A silent take adds nothing and shows "no audio recorded"; a failed transcription keeps the audio with the "transcription unavailable" message.
  Why now: This is scope's Unique Kernel — record, auto-transcribe, replay-ready segment — proven second, early, before any polish. Also the top external dependency (Hugging Face), so failures surface while cheap to fix.
  PRD ref: `prd.md > The Core Journey` (steps 2-5), `prd.md > Capture`, `prd.md > Transcription`, `prd.md > States & Edge Cases`
  Spec ref: `spec.md > Components` (recorder, transcription/, RecordButton, SegmentBubble), `spec.md > Data Flow` (steps 1-5), `spec.md > External Services`
  Build: recorder.ts (start/stop, permanent file), transcri.ts facade + huggingFace.ts (word timestamps, token from .env), voice-bubble states (dots/text/empty/failed), pulse with metering-or-fallback.
  Verify (mechanical): `npx tsc --noEmit`; a direct transcription call from the machine returns `Word[]` with real timestamps; recording file exists at documents/recordings/; no-silent-take path exercised.
  Learner check: Record a 5-second sentence and watch the text appear; record 3 seconds of silence and see the notice instead of a segment.
  Commit: `Add voice capture with Hugging Face transcription`

- [x] **3. Long-press a word and the audio starts at that word**
  Becomes usable: In view mode, long-press any word in a voice bubble → vibration → playback begins from that word with the ring animating top-left → release stops. Plain taps do nothing; the toggle genuinely switches view/edit.
  Why now: Word-precise replay is the PRD's hardest promise (spec risk #1) — prove it on a real device before polishing anything else. View mode exists here because replay needs it.
  PRD ref: `prd.md > Replay in place`, `prd.md > The Core Journey` (step 6), `prd.md > Modes` (view side)
  Spec ref: `spec.md > Components` (player, SegmentBubble, ProgressRing, ModeToggle), `spec.md > Risks & Early Verifications` (#1)
  Build: player.ts (load, seekTo(word.startMs), vibrate, release-stop, position ticks), per-word spans in SegmentBubble, ProgressRing, full toggle semantics.
  Verify (mechanical): `npx tsc --noEmit`; on device, seek accuracy checked by starting from a word late in the transcript (if audio starts clearly before/after that word, repair and re-verify); release stops within a perceptible instant.
  Learner check: Long-press a word in the middle of a voice bubble — does it vibrate, start at that word, show the ring, and stop when you lift your finger?
  Commit: `Add word-precise replay with progress ring`

- [x] **4. Fix a mistranscription, and everything survives a force-quit**
  Becomes usable: In edit mode tapping a bubble's text edits it (audio untouched); every change — typed segments, voice transcripts, order — saves to note.json, and a force-quit restores the full note including replayable audio.
  Why now: Persistence is where the data model gets its first real test; editing is the PRD's core "retrieve and correct" half. Doing it once, after both segment types exist, covers the whole model instead of half of it twice.
  PRD ref: `prd.md > Modes` (edit side), `prd.md > States & Edge Cases` (restart row, edit rows), `prd.md > The Core Journey` (steps 7-8)
  Spec ref: `spec.md > Data Model`, `spec.md > Components` (noteStore, segments), `spec.md > Data Flow` (steps 7-8)
  Build: noteStore load/save on every change, segments.ts edit helpers, wire bubble editing in edit mode, load-on-launch path.
  Verify (mechanical): `npx tsc --noEmit`; note.json exists and contains both segment kinds after edits; simulated relaunch (reload) restores state from disk, not memory.
  Learner check: Record something, fix a wrong word, force-quit the app, reopen — is the note (text, order, audio) exactly as you left it?
  Commit: `Persist note and allow transcript editing`

- [x] **5. The full demo run, edge cases included**
  Becomes usable: The complete PRD journey works in one uninterrupted flow on a real Android phone — the seven checkable steps, in order, from cold open to replay after restart.
  Why now: The demo is the POC's proof; walking it end to end is the last thing before final review, once every piece exists.
  PRD ref: `prd.md > What "Working" Looks Like`, `prd.md > States & Edge Cases` (full table)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It` (Demo)
  Build: Fix whatever the walk-through surfaces; no new features.
  Verify (mechanical): `npx tsc --noEmit` clean; each of the 7 PRD steps observed working on device in one session; silent-take and restart rows re-checked.
  Learner check: Do the whole journey yourself as if showing it: open → record → text → replay from a word → edit → restart → replay. Note anything off.
  Commit: `Complete POC demo journey`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2 (the kernel: record → text) since feedback there shapes replay and editing
- [x] Final kick-the-tires exploration and feedback completed — learner restarted Expo, cold-reloaded, and walked all features: 5 slices + homepage, multi-note, titles/tiles, search/sort, FAB, back navigation, keyboard dismiss, draft autosave, voice-block delete, re-transcribe with language picker, chained backspace.

## Final Review

- **Slice 2 learner fixes (reported by the learner check):** on transcription failure the bubble delays the "transcription unavailable" message by ~700 ms, so the 1-2-3 dots animation renders once before the message appears.
- **Transcription provider: Hugging Face → Groq (decision + build discovery).** During the slice-2/slice-3 learner check, HF's Inference Providers began returning **402 Payment Required** ("Free monthly limit reached" per HF docs/forum) — their free users get no monthly credits now. Learner (no payment method) agreed to swap; the spec's transcription facade meant only `transcription/huggingFace.ts` → `transcription/groq.ts` changed, the app behavior (dots → word-timed transcript) is unchanged. `spec.md` Stack, External Services, Data Flow, and File Structure updated to match. Groq free developer plan: `whisper-large-v3-turbo` with word-level timestamps, no card, generous audio-seconds limits.
- **Pulse while speaking:** question asked, answer not yet received — decision deferred with the later note (raise threshold + treat near-silent as no-pulse) applied to the checklist for the next session.
- **Language decision (left as-is):** auto-detection returned correct English (`sky or heven`); forcing `language: "en"` declined by the learner for now. Revisit later if mis-transcription becomes an issue.

- [x] Final review complete — feedback resolved and learner confirms ready to ship — all features passed the cold-restart walkthrough; learner confirmation given.

## Code Tour and App Map

- [x] Learning activity complete — brief recap used (learner declined the walk; hands-on practice already covered by their cold-restart verification)
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Brief evidence-based recap, offered in place of the 2–3-stop static walk; learner chose to skip ("skip it"). Recap content: the PRD's silent-take acceptance criterion (`prd.md > Transcription`, "no audio recorded" notice, no segment) → the on-device mismatch (Whisper returned "." for silence) → the precise fix (punctuation-only words dropped, commit 1f0cb85). Connection to the learner's stated goal (explaining their side rigorously): a requirement phrased as an observable behavior made the mismatch catchable and the fix spec-able. Hands-on practice counted from the learner's own final walkthrough — recorded as recap, not as a fresh hands-on exercise.
Route and stops: Route in `devpost/app-map.html` labeled **reference route** (not walked interactively): App.tsx `handleRecordPress` → groq.ts `toWords` / player.ts `startSeek` → noteStore.ts `loadNotes`/`saveNotes`.
Edit outcome: Not applicable — no code edit was part of the wrap-up (learner skipped the optional exercise).
Reflection: [done — transfer question answered] Next time I'd start with written observable acceptance criteria for every feature before any code; the silent-take criterion proved it catches mismatches and makes fixes precise.
Activity mode: Focused alternative (plan-first learner; practice already completed during build — cited, not repeated).

App map: `devpost/app-map.html` generated from commit f3d6449; all paths/anchors verified against source (handleRecordPress, toWords, loadNotes/saveNotes, showNotice, LANGUAGES, commitDraft, startSeek — all found); PRD silent-take wording confirmed at prd.md lines 38/64; one attribution corrected during check (fix reference is git commit 1f0cb85, not a checklist entry). Browser rendering not machine-verified — checked as static HTML (no scripts/CDN, inline SVG, escaped code).

- **Slice 3 word-precise replay with progress ring (spec.md > Replay in place):** long-press a voice word in view mode starts playback from that word with a single haptic and the top-left ring; plain taps do nothing; releasing stops; leaving view stops playback. Leap-precise accuracy is the POC's top risk and is verified on-device before this slice is closed.
- **Slice 3 learner check completed on device:** long-press start + haptic + ring verified; release-to-stop, natural-end ring clear, and normal wrapped-text layout fixed after learner feedback (commits 7d01cf1, 88fa72d).

- **Slice 4 interpretation (PRD silent):** after a transcript edit, view mode must show the *edited* text *and* keep word-precise replay working. Decision: `editSegmentText` remaps the word timings onto the new text — same word count keeps each word's exact timing (the PRD's typo-fix case); a different count spreads the words evenly across the segment's original time span. Voice audio itself is never changed by an edit (prd.md > Modes).
- **Slice 4 learner check completed on device:** tap-to-edit works for typed and voice text (after a Metro restart cleared a stale bundle); force-quit restored text, order, and replayable audio exactly as left.
- **Typed-segment entry behavior** (slice 1, discovered in the learner check): the plan didn't say whether Enter ends a typed segment. First implementation made each Enter commit a single line; the learner rejected one-line-per-entry. Decided: Enter inserts a newline *inside* the block, and the block commits when the composer loses focus, when record is pressed, or when switching to view mode. `prd.md > Core Journey` step 7 ("tap empty space and type") and the `TypedSegment.text` shape in `spec.md > Data Model` are unchanged and still accurate. Also fixed: uncommitted draft text was destroyed by the edit→view toggle (the composer unmounts in view mode); the draft now lives in state and commits on mode switch.
- **Homepage lesson — a new state field must update every reader and every exit path:** after typed text became autosaved (`note.draft`, commit `a07e24b`), the homepage still previewed those notes as "(empty note)". Two gaps, not one: (1) `preview()` and homepage search only read `segments`, never the new `draft` field — the save path grew a field the read paths didn't know about; (2) commit was tied to *gestures* (blur, record press, mode switch), but `goHome` (the "<- Home" button and the later back-button handler) unmounted the composer without committing, and with the keyboard up the blur races the unmount, so text could stay a draft indefinitely. Fixed at all three layers in `29016dc`: `goHome` commits the draft into a block (via `addTypedSegment`, which also clears it), `preview()` falls back to `draft`, and search matches `draft` too. Rule for this codebase: when adding a piece of state, audit every reader (preview, search, sort display, exports) and every exit path (home, back button, force-quit) in the *same* change — writer-first, reader-later is exactly how this bug shipped.
- **Branch topology for the post-homepage additions (learner call — isolate risky changes):** every feature after the merged homepage work got its own branch so it can be merged, tested, or dropped independently. Current state: `master` = all merged work through the homepage lesson (`0814ea2`); `feature/homepage`, `feature/delete-note`, `feature/note-titles` = fully merged, kept as history; `feature/retranscribe` (`95e9b0f`) = re-transcribe + searchable language picker (Auto-detect default, first transcription never prompts — PRD flow unchanged), per-voice-block ✕ Delete with audio cleanup, erase-to-empty deletes a typed block, and chained backspace (emptying a typed block opens the editor on the typed block above with the caret at its end; a voice block above stops the chain). `fix/no-focus-autoscroll` (`7fd04e3`) = the Android `scrollsChildToFocus={false}` fix, deliberately rebased straight onto `master` (4-line diff) so merging or reverting it never drags the retranscribe feature with it. Rule: when a change is plausible-but-unproven (here: suppressing Android's focus-scroll may affect keyboard/reveal behavior elsewhere), park it on a branch whose only parent is `master`.



- **Verification lesson (from the Groq FormData bug):** a machine-side check that validates the API contract (endpoint, params, response shape) does **not** validate the runtime transport path. Node's `FormData` accepted the `{ uri }` part that Expo SDK 57's fetch rejects on device. Rule for this project from here: verify the *transport* (how the file/bytes actually travel) on the same runtime the app ships on — i.e. on the device through the app's real code path — not only from a Node script. Prefer the SDK's documented upload primitive (`File.upload`, `expo/fetch`) over generic web patterns when building against Expo.