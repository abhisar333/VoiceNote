import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Segment, VoiceSegment, Word } from '../features/segments';
import type { NoteMode } from './ModeToggle';
import LanguagePicker from './LanguagePicker';

type Props = {
  segment: Segment;
  mode: NoteMode;
  /** Called when the user long-presses a voice word (view mode only). */
  onReplayWord?: (segment: VoiceSegment, startMs: number) => void;
  /** Called when the finger that started a replay lifts (view mode only). */
  onReplayEnd?: () => void;
  /** Slice 4: called on blur when the text was changed in place (edit mode only). */
  onEditText?: (id: string, text: string) => void;
  /** Re-transcribe the segment's original audio (edit mode only).
   *  undefined language = Auto-detect — the same param-free path as the first try. */
  onRetranscribe?: (segment: VoiceSegment, language: string | undefined) => void;
};

/** The 1-2-3 dots while the finished recording is with the transcriber (prd.md > Transcription). */
function TranscribingDots() {
  const dots = [useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current];

  useEffect(() => {
    const loops = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 220),
          Animated.timing(value, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.25, duration: 220, useNativeDriver: true }),
          Animated.delay((2 - index) * 220),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.dotsRow} accessibilityLabel="Transcribing">
      {['1', '2', '3'].map((label, index) => (
        <Animated.Text key={label} style={[styles.dot, { opacity: dots[index] }]}>
          {label}
        </Animated.Text>
      ))}
    </View>
  );
}

/** One word of a voice bubble: long-press starts the replay, lifting that same finger
 *  stops it (prd.md > Replay in place: "Releasing the finger stops playback
 *  immediately"). The flag keeps a plain tap a true no-op — it must not stop playback
 *  that a different word started. */
function VoiceWord({
  segment,
  word,
  onReplayWord,
  onReplayEnd,
}: {
  segment: VoiceSegment;
  word: Word;
  onReplayWord?: (segment: VoiceSegment, startMs: number) => void;
  onReplayEnd?: () => void;
}) {
  const playingHere = useRef(false);
  return (
    <Pressable
      onPress={() => {}}
      onLongPress={() => {
        playingHere.current = true;
        onReplayWord?.(segment, word.startMs);
      }}
      onPressOut={() => {
        if (playingHere.current) {
          playingHere.current = false;
          onReplayEnd?.();
        }
      }}
      style={styles.word}
    >
      <Text style={styles.wordText}>{word.text}</Text>
    </Pressable>
  );
}

/** Renders one segment: typed text as plain note text; voice as the grey bubble (prd.md > Look and Feel).
 *  Voice states: dots while transcribing, transcript when done, message when the engine failed
 *  (spec.md > Components #3, prd.md > States & Edge Cases). */
export default function SegmentBubble({
  segment,
  mode,
  onReplayWord,
  onReplayEnd,
  onEditText,
  onRetranscribe,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const prevMode = useRef(mode);

  const beginEdit = () => {
    setDraft(segment.text);
    setEditing(true);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed !== '' && trimmed !== segment.text) onEditText?.(segment.id, trimmed);
    setEditing(false);
  };

  // Leaving edit mode unmounts the input without firing blur (the slice-1 lesson),
  // so commit on the mode switch itself.
  useEffect(() => {
    if (prevMode.current === 'edit' && mode === 'view' && editing) commitEdit();
    prevMode.current = mode;
  }, [mode, editing]);

  // In-place editor (prd.md > Modes: "Tap any segment's text to edit it in place").
  if (editing) {
    const input = (
      <TextInput
        style={[segment.kind === 'typed' ? styles.typed : styles.voiceText, styles.editor]}
        value={draft}
        onChangeText={setDraft}
        autoFocus
        multiline
        onBlur={commitEdit}
        onEndEditing={commitEdit}
      />
    );
    return segment.kind === 'typed' ? input : <View style={styles.voice}>{input}</View>;
  }

  if (segment.kind === 'typed') {
    // Edit mode: tap the text to fix it. View mode stays read-only.
    if (mode === 'edit' && onEditText) {
      return (
        <Pressable onPress={beginEdit}>
          <Text style={styles.typed}>{segment.text}</Text>
        </Pressable>
      );
    }
    return <Text style={styles.typed}>{segment.text}</Text>;
  }

  const failed = segment.words === null && segment.text !== '';
  const transcribing = segment.words === null && segment.text === '';

  // View mode only: a plain tap does nothing; long-press a word starts that spot.
  if (mode === 'view' && segment.kind === 'voice' && segment.words) {
    return (
      <View style={[styles.voice, styles.voiceWords]}>
        {segment.words.map((word, index) => (
          <VoiceWord
            key={`${segment.id}-${index}`}
            segment={segment}
            word={word}
            onReplayWord={onReplayWord}
            onReplayEnd={onReplayEnd}
          />
        ))}
      </View>
    );
  }

  if (transcribing) {
    return (
      <View style={styles.voice}>
        <TranscribingDots />
      </View>
    );
  }

  // Voice bubble with text: tappable for editing in edit mode; audio untouched (prd.md > Modes).
  const body = (
    <Text style={[styles.voiceText, failed && styles.failedText]}>{segment.text}</Text>
  );
  // Re-transcribe: edit mode only, hidden while the transcriber is running.
  // Opens the searchable picker; a first transcription NEVER shows it.
  const retranscribeControl =
    mode === 'edit' && onRetranscribe && !transcribing ? (
      <Pressable
        style={styles.retryButton}
        hitSlop={6}
        onPress={() => setPickingLanguage(true)}
        accessibilityLabel="Re-transcribe"
      >
        <Text style={styles.retryText}>↻ Re-transcribe</Text>
      </Pressable>
    ) : null;
  return (
    <View style={styles.voice}>
      {mode === 'edit' && onEditText ? <Pressable onPress={beginEdit}>{body}</Pressable> : body}
      {retranscribeControl}
      <LanguagePicker
        visible={pickingLanguage}
        onClose={() => setPickingLanguage(false)}
        onSelect={(language) => onRetranscribe?.(segment, language)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  typed: {
    color: '#e8e8e8',
    fontSize: 17,
    lineHeight: 26,
    paddingVertical: 4,
  },
  voice: {
    backgroundColor: 'rgba(140,140,140,0.18)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 5,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  word: {
    marginRight: 6,
    paddingVertical: 4,
  },
  wordText: {
    color: '#d8d8d8',
    fontSize: 17,
    lineHeight: 26,
  },
  /** Words flow as normal wrapped text lines, not one block per word. */
  voiceWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  voiceText: {
    color: '#d8d8d8',
    fontSize: 17,
    lineHeight: 26,
  },
  /** In-place editor: same type style, no chrome (prd.md > Modes). */
  editor: {
    padding: 0,
    borderWidth: 0,
  },
  failedText: {
    color: '#8a8a8a',
    fontStyle: 'italic',
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  retryText: {
    color: '#9fd0ff',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  dot: {
    color: '#d8d8d8',
    fontSize: 17,
    fontWeight: '600',
  },
});
