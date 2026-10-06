---
doc: scope
status: approved
---
<!-- Approved by the learner. Canonical plan of record for VoiceNote's proof of concept.
     `devpost/scope.html` is the visual companion; this file stays canonical. -->
<!-- Rewritten by the 2-scope interview, from the learner's own decisions and words. -->

# VoiceNote

One line: a notes app you fill by talking - the recording stays in the note and plays back in place, and the text is what you actually read to find the piece you want.

## The Unique Kernel

A note is an **ordered list of segments, and a segment can be a recording**. The recording stays attached to its position and replays in place, later, forever - with text as the skimmable companion rather than a replacement for it.

Delete that and VoiceNote is just another dictation app. (DESIGN.md 1.1, 3.2)

## Who It's For

**The learner themselves** - someone who gets an idea or remembers a task *mid-flow*, and will not stop what they are doing to type it out. Today they have two bad options: type it (slow, and it interrupts the thought they were having), or voice-record it (fast in, painful out - a rambling memo they must re-listen to every time, or transcribe by hand).

They do not sign, so sign language is not the user's need. (See Later.)

## The Core Loop

You are mid-thought. You open the app, hold the mic, talk, close it - the text fills in on its own from your speech. Later, you open the note and **read** it to spot the piece you want; long-press that segment and the original audio plays back in place. You come back because getting back to the idea is read-fast, not listen-slow.

## Inspiration & Identity

Not volunteered. DESIGN.md implies the mood: quiet, private, offline, single-player, nothing leaves the phone. `3-prd` fills the visual gap in a question or two.

## Why This Matters to the Learner

In their own words: *"I was thinking about something else and I got the app idea. If I want to note it in a normal notes app I'd have to type it - that takes time and it interrupts my thought about what I was doing. If I use voice record I'd have to sift through long rambling to get different portions of the idea every time I need to review it, or type out a transcript."*

The stake is a pair of frictions: **capture without interrupting the thought**, and **retrieve without re-listening**. Typing fails the first; a raw voice memo fails the second.

## What "Working" Looks Like

On a real **Android** phone: open the app, hold the mic, talk - and the transcript appears as a segment on its own. Later, the note reads as text; tapping a segment's words edits them, long-press replays the original audio in place. Force-quit and reopen - the note, its text, its order, and its audio all survive. Demonstrable in well under a minute, which is what the demo video needs.

## The POC Boundary

**In:**

- One note; segments in order; typed segments.
- Voice segments that record, **auto-transcribe to text**, keep the audio file, and replay in place.
- Per-segment text that can be edited, skipped, or added after the fact.
- Everything surviving an app restart.
- The **custom dev client** that auto-transcription requires - accepted because auto-text is the point. On Android this can be a *local* build (`npx expo run:android` compiles, installs, and starts the dev server, no EAS cloud queue), so it costs less than the original cloud-build plan.
- **Android only** - built, run, and verified on Android. DESIGN.md said "iOS & Android"; for the POC that narrows to Android (see Later).

## Risks to Prove

- **Concurrent microphone access** (DESIGN.md 7.1): `expo-av` recording and `expo-speech-recognition` listening at once on the same mic. Unverifiable in Jest; must be checked on a real device. Now an **Android-only** verification, since that is the POC platform. Fallback: record first, transcribe from the finished file (worse, still functional).
- **Build cost:** the dev client is still the heaviest item in a 2-4 hour POC, but Android-only softens it: `npx expo run:android` builds locally (Android SDK), with no cloud build or EAS account needed. Rebuilds are only required when native config changes - pure JS changes just need `npx expo start`.

## Later

- **iOS support** - DESIGN.md targeted "iOS & Android", but the POC is Android-only, so iOS moves here: **unbuilt and untested, not assumed working.** Reinstating it later is mostly a build concern, not a redesign.
- **Sign segments** (video record + in-place playback) - kept as a stretch, not cut: it is the same mechanism with a different recorder, and DESIGN.md says it "exactly mirrors how voice segments work." Out of the POC because the user does not sign, and it drags in `expo-camera`, a second recorder screen, camera permissions, and preview/retake.
- From DESIGN.md 9: segment deletion, search, waveform/duration indicators, versioned migrations, cloud sync.

## Explicitly Cut

- **Automatic sign-language-to-text** - no production-grade model exists for continuous signing; shipping one would misrepresent its accuracy. (The *recording* is kept; only auto-transcription is deferred.)
- **Multi-device sync / cloud backup; accounts, auth, collaboration; rich text, folders/tags, sharing/export** - DESIGN.md 1.3 non-goals; none needed to prove the kernel.
- **Testing breadth and CI** - a proof of concept, not a release.