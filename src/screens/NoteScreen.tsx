import { useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';

import type { Note, Segment, VoiceSegment } from '../features/segments';
import ModeToggle, { type NoteMode } from '../components/ModeToggle';
import RecordButton from '../components/RecordButton';
import SegmentBubble from '../components/SegmentBubble';
import ProgressRing from '../components/ProgressRing';

type Props = {
  note: Note;
  mode: NoteMode;
  onModeChange: (mode: NoteMode) => void;
  onAddTypedSegment: (text: string) => void;
  onHome: () => void;
  onRecordPress: () => void;
  /** True between the first tap and the second (stop). */
  recording: boolean;
  /** True only while the mic hears sound — drives the pulse. */
  live: boolean;
  /** Transient short notice, e.g. "no audio recorded" (prd.md > Transcription). */
  notice: string | null;
  /** Playback slice 3: the take currently being replayed, if any. */
  playback: { id: string; wordMs: number; durationMs: number } | null;
  /** Playback head position in milliseconds. */
  playheadMs: number;
  /** Slice 3: start a word-precise replay (spec.md > Replay in place). */
  onStartReplay: (segment: VoiceSegment, wordMs: number) => void;
  /** Slice 3: stop the current playback. */
  onStopReplay: () => void;
  /** Slice 4: permanent in-place edit of a segment's text (prd.md > Modes). */
  onEditText: (id: string, text: string) => void;
  /** Re-transcribe a voice segment's audio, optionally in a chosen language
   *  (edit mode only; undefined = Auto-detect, same as a first transcription). */
  onRetranscribe: (segment: VoiceSegment, language: string | undefined) => void;
  /** Delete a single segment (edit mode only), audio file included. */
  onRemoveSegment: (segment: Segment) => void;
  /** Autosaved composer text — lives on the note, not local state, so typing
   *  survives force-quit exactly like recorded audio does. */
  draft: string;
  onDraftChange: (text: string) => void;
};

/** The one screen: ring slot (top-left) · toggle (top-right) · segments · record button (bottom-right).
 *  Implements prd.md > The Core Journey, Modes, Look and Feel. */
export default function NoteScreen({
  note,
  mode,
  onModeChange,
  onAddTypedSegment,
  onHome,
  onRecordPress,
  recording,
  live,
  notice,
  playback,
  playheadMs,
  onStartReplay,
  onStopReplay,
  onEditText,
  onRetranscribe,
  onRemoveSegment,
  draft,
  onDraftChange,
}: Props) {
  const composerRef = useRef<TextInputInstance>(null);
  // Tap empty space: keyboard open → dismiss it; closed → start a new line.
  const [composerFocused, setComposerFocused] = useState(false);
  // Cross-block backspace: focus the block above after the current one empties.
  const [editRequest, setEditRequest] = useState<{ id: string; token: number } | null>(null);
  const requestToken = useRef(0);
  const isEdit = mode === 'edit';
  const isEmpty = note.segments.length === 0;

  // A typed block was backspaced to '' — delete it, then open the editor on
  // the typed block directly above (with the caret at its end) so holding
  // backspace keeps deleting through the note. A voice block above stops the
  // chain: its text is the recording's captions, not deletable prose.
  const handleEmptied = (id: string) => {
    onEditText(id, '');
    const index = note.segments.findIndex((segment) => segment.id === id);
    const above = index > 0 ? note.segments[index - 1] : undefined;
    if (above && above.kind === 'typed') {
      requestToken.current += 1;
      setEditRequest({ id: above.id, token: requestToken.current });
    }
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed !== '') onAddTypedSegment(trimmed);
    else onDraftChange('');
  };

  // Leaving edit mode commits the in-progress block instead of losing it.
  const handleModeChange = (next: NoteMode) => {
    if (mode === 'edit' && next === 'view') commitDraft();
    // Leaving view mode stops word-precise playback (spec > Replay in place).
    if (mode === 'view' && next === 'edit') onStopReplay();
    onModeChange(next);
  };

  // Record also closes the current block, so a voice segment lands after it.
  const handleRecordPress = () => {
    commitDraft();
    onRecordPress();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        {/* Progress ring slot — slice 3 */}
        <View style={styles.ringSlot}>
          {playback ? (
            <ProgressRing
              playing
              positionMs={playheadMs}
              durationMs={playback.durationMs}
            />
          ) : null}
        </View>
        <Pressable style={styles.homeButton} onPress={onHome}>
          <Text style={styles.homeText}>← Home</Text>
        </Pressable>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {note.segments.map((segment) => (
          <SegmentBubble
            key={segment.id}
            segment={segment}
            mode={mode}
            onReplayWord={(segment, wordMs) => onStartReplay(segment, wordMs)}
            onReplayEnd={onStopReplay}
            onEditText={onEditText}
            onRetranscribe={onRetranscribe}
            onRemove={onRemoveSegment}
            editRequest={editRequest}
            onEditRequestHandled={() => setEditRequest(null)}
            onEmptied={handleEmptied}
          />
        ))}

        {isEdit ? (
          <Pressable
            style={styles.emptyArea}
            onPress={() => {
              if (composerFocused || draft !== '') {
                composerRef.current?.blur();
                Keyboard.dismiss();
              } else {
                composerRef.current?.focus();
              }
            }}
          >
            <TextInput
              ref={composerRef}
              style={styles.composer}
              placeholder={isEmpty ? '' : 'Type…'}
              placeholderTextColor="#555"
              multiline
              autoFocus={isEmpty}
              value={draft}
              onChangeText={onDraftChange}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              // Enter inserts a newline inside the same block (learner decision);
              // the block commits on blur, on record press, and on mode switch.
              onEndEditing={commitDraft}
            />
            {isEmpty ? <Text style={styles.cursorHint} /> : null}
          </Pressable>
        ) : (
          <View style={styles.viewPad} />
        )}
      </ScrollView>

      <View style={styles.recordSlot}>
        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        <RecordButton onPress={handleRecordPress} recording={recording} live={live} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 10,
  },
  ringSlot: {
    width: 44,
    height: 44,
  },
  homeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1c1c1c',
  },
  homeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 140,
  },
  emptyArea: {
    minHeight: 220,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  composer: {
    color: '#e8e8e8',
    fontSize: 17,
    lineHeight: 26,
    padding: 0,
    minHeight: 26,
  },
  cursorHint: {
    height: 0,
  },
  viewPad: {
    height: 60,
  },
  recordSlot: {
    position: 'absolute',
    right: 24,
    bottom: 36,
    alignItems: 'flex-end',
    gap: 10,
  },
  notice: {
    backgroundColor: '#1f1f1f',
    borderColor: '#3a3a3a',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  noticeText: {
    color: '#cfcfcf',
    fontSize: 13,
  },
});
