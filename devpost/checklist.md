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

- [ ] **2. Talk, stop, and your words fill a grey bubble (the kernel)**
  Becomes usable: Tap the red button → it pulses while it hears you → tap again → grey bubble with 1-2-3 dots → transcript lands in the bubble. A silent take adds nothing and shows "no audio recorded"; a failed transcription keeps the audio with the "transcription unavailable" message.
  Why now: This is scope's Unique Kernel — record, auto-transcribe, replay-ready segment — proven second, early, before any polish. Also the top external dependency (Hugging Face), so failures surface while cheap to fix.
  PRD ref: `prd.md > The Core Journey` (steps 2-5), `prd.md > Capture`, `prd.md > Transcription`, `prd.md > States & Edge Cases`
  Spec ref: `spec.md > Components` (recorder, transcription/, RecordButton, SegmentBubble), `spec.md > Data Flow` (steps 1-5), `spec.md > External Services`
  Build: recorder.ts (start/stop, permanent file), transcri.ts facade + huggingFace.ts (word timestamps, token from .env), voice-bubble states (dots/text/empty/failed), pulse with metering-or-fallback.
  Verify (mechanical): `npx tsc --noEmit`; a direct transcription call from the machine returns `Word[]` with real timestamps; recording file exists at documents/recordings/; no-silent-take path exercised.
  Learner check: Record a 5-second sentence and watch the text appear; record 3 seconds of silence and see the notice instead of a segment.
  Commit: `Add voice capture with Hugging Face transcription`

- [ ] **3. Long-press a word and the audio starts at that word**
  Becomes usable: In view mode, long-press any word in a voice bubble → vibration → playback begins from that word with the ring animating top-left → release stops. Plain taps do nothing; the toggle genuinely switches view/edit.
  Why now: Word-precise replay is the PRD's hardest promise (spec risk #1) — prove it on a real device before polishing anything else. View mode exists here because replay needs it.
  PRD ref: `prd.md > Replay in place`, `prd.md > The Core Journey` (step 6), `prd.md > Modes` (view side)
  Spec ref: `spec.md > Components` (player, SegmentBubble, ProgressRing, ModeToggle), `spec.md > Risks & Early Verifications` (#1)
  Build: player.ts (load, seekTo(word.startMs), vibrate, release-stop, position ticks), per-word spans in SegmentBubble, ProgressRing, full toggle semantics.
  Verify (mechanical): `npx tsc --noEmit`; on device, seek accuracy checked by starting from a word late in the transcript (if audio starts clearly before/after that word, repair and re-verify); release stops within a perceptible instant.
  Learner check: Long-press a word in the middle of a voice bubble — does it vibrate, start at that word, show the ring, and stop when you lift your finger?
  Commit: `Add word-precise replay with progress ring`

- [ ] **4. Fix a mistranscription, and everything survives a force-quit**
  Becomes usable: In edit mode tapping a bubble's text edits it (audio untouched); every change — typed segments, voice transcripts, order — saves to note.json, and a force-quit restores the full note including replayable audio.
  Why now: Persistence is where the data model gets its first real test; editing is the PRD's core "retrieve and correct" half. Doing it once, after both segment types exist, covers the whole model instead of half of it twice.
  PRD ref: `prd.md > Modes` (edit side), `prd.md > States & Edge Cases` (restart row, edit rows), `prd.md > The Core Journey` (steps 7-8)
  Spec ref: `spec.md > Data Model`, `spec.md > Components` (noteStore, segments), `spec.md > Data Flow` (steps 7-8)
  Build: noteStore load/save on every change, segments.ts edit helpers, wire bubble editing in edit mode, load-on-launch path.
  Verify (mechanical): `npx tsc --noEmit`; note.json exists and contains both segment kinds after edits; simulated relaunch (reload) restores state from disk, not memory.
  Learner check: Record something, fix a wrong word, force-quit the app, reopen — is the note (text, order, audio) exactly as you left it?
  Commit: `Persist note and allow transcript editing`

- [ ] **5. The full demo run, edge cases included**
  Becomes usable: The complete PRD journey works in one uninterrupted flow on a real Android phone — the seven checkable steps, in order, from cold open to replay after restart.
  Why now: The demo is the POC's proof; walking it end to end is the last thing before final review, once every piece exists.
  PRD ref: `prd.md > What "Working" Looks Like`, `prd.md > States & Edge Cases` (full table)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It` (Demo)
  Build: Fix whatever the walk-through surfaces; no new features.
  Verify (mechanical): `npx tsc --noEmit` clean; each of the 7 PRD steps observed working on device in one session; silent-take and restart rows re-checked.
  Learner check: Do the whole journey yourself as if showing it: open → record → text → replay from a word → edit → restart → replay. Note anything off.
  Commit: `Complete POC demo journey`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2 (the kernel: record → text) since feedback there shapes replay and editing
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [pending]
Route and stops: [pending]
Edit outcome: [pending]
Reflection: [pending]
Activity mode: [pending]

## Revisions

- **Typed-segment entry behavior** (slice 1, discovered in the learner check): the plan didn't say whether Enter ends a typed segment. First implementation made each Enter commit a single line; the learner rejected one-line-per-entry. Decided: Enter inserts a newline *inside* the block, and the block commits when the composer loses focus, when record is pressed, or when switching to view mode. `prd.md > Core Journey` step 7 ("tap empty space and type") and the `TypedSegment.text` shape in `spec.md > Data Model` are unchanged and still accurate. Also fixed: uncommitted draft text was destroyed by the edit→view toggle (the composer unmounts in view mode); the draft now lives in state and commits on mode switch.