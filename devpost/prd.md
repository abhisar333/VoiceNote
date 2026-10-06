---
doc: prd
status: approved
---
<!-- Written by 3-prd from the product interview. `devpost/prd.html` is the visual companion; this file is canonical.
     Requirement blocks cite the scope headings they develop. -->

# VoiceNote — PRD

One line: a single-note screen where talking becomes a grey, replayable bubble of text — read to find your piece, long-press any word to hear that exact spot, and flip to edit mode to fix or extend the note.

Develops: scope *The Unique Kernel*, *The Core Loop*, *What "Working" Looks Like*, *The POC Boundary*.

## The Core Journey (POC)

The POC is one screen: **the note**. (No home screen, no note list — those are Later.)

1. **Open the app.** One note is open, dark screen, edit mode active by default: an empty note with a blinking cursor. A round red record button sits at the bottom right.
2. **Capture.** Tap the red button — recording starts; the button pulses *only while the mic hears sound* (silent input = no pulse, doubling as the "is the mic alive" indicator).
3. **Stop.** Tap the same button again — recording stops.
4. **Transcribe.** A grey rounded bubble appears at the end of the note showing an animated 1-2-3 dot while the finished recording is converted to text.
5. **Read.** The transcript lands in the bubble. In view mode, the note reads top-to-bottom as text.
6. **Replay in place.** In view mode, long-press any word in a voice bubble: a vibration marks the start, audio plays from **that word**, and a circular progress ring animates at the top left of the screen. Release to stop.
7. **Edit.** Flip to edit mode with the top-right toggle. Tap a bubble's text to fix a mistranscription; tap empty space and type to add a typed segment in the flow.
8. **Survive.** Force-quit and reopen — note, text, segment order, and audio all persist.

## Behavior

### Capture (scope: The Core Loop)

- One record button, round, red, bottom right. Tap to start, tap to stop. No separate stop control.
- While recording, the button pulses **only when it is hearing sound**. Silence → no pulse. (Learner decision: both of the proposed silence behaviors are in — live pulse-as-mic-health, and the no-audio safety net below.)

### Transcription (scope: The Unique Kernel)

- Transcription runs **after** the user stops, on the finished recording — not live while talking. (Learner decision; removes the concurrent-microphone risk from scope *Risks to Prove* §7.1 as the primary path.)
- While converting, the new bubble shows an animated 1-2-3 dot; the user can keep using the app.
- **Silent recording:** if the capture produced no audible audio, no segment is added and a short "no audio recorded" notice appears instead.

### Replay in place (scope: The Unique Kernel)

- **View mode only** — in edit mode, long-press is not used for playback.
- Long-press any word in a voice bubble → haptic vibration → audio starts **at that word** (word-precise start, not segment start — learner decision).
- A circular progress ring animates at the top-left of the screen for the duration of playback.
- **Releasing the finger stops playback immediately.**
- When audio reaches its end it stops on its own.

### Modes: view and edit (scope: The POC Boundary "per-segment text that can be edited, skipped, or added after the fact")

- The note has exactly two modes, toggled by a button at the **top right** (position fixed for the POC; user-movable is Later).
- **View mode:** read; long-press a voice-bubble word to replay. Nothing else.
- **Edit mode (the default on open, so an empty note shows its blinking cursor):**
  - Tap any segment's text to edit it in place (keyboard). Saving an edit is permanent.
  - Tap empty space → blinking cursor appears → type → a new **typed segment** is created in the note's flow at that position.
- A voice bubble's text is editable, but its audio is never changed by edits.

## States & Edge Cases

| Situation | What the user sees / gets |
|---|---|
| Brand-new / empty note | Plain note, dark background, blinking cursor (edit mode by default), red round record button bottom right |
| Recording, mic hears sound | Record button pulses |
| Recording, silence | Record button does not pulse |
| Stopped a silent recording | No segment added; "no audio recorded" notice |
| Stopped, conversion in progress | Grey bubble with animated 1-2-3 dot |
| Conversion succeeds | Transcript text fills the bubble; bubble keeps its voice-bubble styling |
| Conversion fails (audio present, no usable text) | **Assumption — unconfirmed:** bubble stays with a "transcription unavailable" message, the audio is kept, replay still works. Confirm at review. |
| Long-press mid-playback on another word | **Assumption — unconfirmed:** playback stops; nothing new starts until a fresh long-press. Confirm at review. |
| View mode, tap (not long-press) a bubble | Nothing — view mode is read-only |
| Edit mode, long-press a word | No playback — long-press belongs to view mode only |
| App restarted / force-quit | Note, all segments, text, order, and audio restored exactly |

## Look and Feel (scope: Inspiration & Identity — now filled)

- **Dark theme**, black background.
- **Record button:** round, red.
- **Voice bubbles:** grey, rounded edges, an "almost transparent but not quite" look — a matte, slightly translucent grey card, visually distinct from typed segments (which are plain note text).
- Mood from scope: quiet, private, offline, single-player.

## What "Working" Looks Like — Checkable

Develops: scope *What "Working" Looks Like*, *Risks to Prove* (word-precise start is now the top risk to prove on a real Android device).

On a real Android phone, in under a minute:

1. Open the app → one note, blinking cursor, red round button visible.
2. Tap it, talk → button pulses while you speak.
3. Tap again → grey bubble with the 1-2-3 dot appears.
4. Transcript text fills the bubble.
5. Flip to view mode; long-press a word mid-sentence → vibration; audio begins at that word; top-left ring animates; release stops it.
6. Flip to edit mode; tap the bubble, fix a word; tap empty space and type a new line.
7. Force-quit, reopen → everything (text, order, audio) is back and replayable.

## Product Decisions (learner's, from this interview)

- Text appears **after** stopping, not live while speaking.
- Silence handling: pulsing mic as live feedback **and** no-audio → no-segment notice. Both.
- Replay: word-precise start, release-to-stop, circular progress ring top-left, vibration at start.
- Editing is a global **view/edit mode** (Word-style), not a per-bubble edit button.
- Typed segments are added by tapping empty space in edit mode.
- Empty note defaults to edit mode (blinking cursor).
- Mode toggle top-right, fixed position for the POC.
- Look: black background, red round button, grey near-transparent rounded voice bubbles.

## Now vs. Deferred

**Now (this POC):** everything above — one note, one screen, voice + typed segments, post-stop transcription, word-precise replay, view/edit modes, persistence, dark look.

**Deferred (Later, all from the learner's vision — not dropped):**

- Home screen with all previous notes + two round capture buttons (type / voice).
- Formatting in edit mode: highlight, color, underline, bold, font size.
- User-movable mode toggle.
- Movable/multi-note capture flow and everything the home screen implies.
- (Carried from scope *Later*: iOS, sign segments, segment deletion, search, waveform/duration indicators, cloud sync.)

## Open Assumptions (resolve before approval)

1. Transcription-failed bubble: message + kept audio + replay still works. (See States table.)
2. Long-pressing during an active playback: stops, no new start. (See States table.)
3. App opens in edit mode by default so the empty note shows its cursor. (Recorded in Behavior; confirm.)