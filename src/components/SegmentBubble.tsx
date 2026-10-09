import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Segment, VoiceSegment, Word } from '../features/segments';
import type { NoteMode } from './ModeToggle';

type Props = {
  segment: Segment;
  mode: NoteMode;
  /** Called when the user long-presses a voice word (view mode only). */
  onReplayWord?: (segment: VoiceSegment, startMs: number) => void;
  /** Called when the finger that started a replay lifts (view mode only). */
  onReplayEnd?: () => void;
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
}: Props) {
  if (segment.kind === 'typed') {
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

  return (
    <View style={styles.voice}>
      {transcribing ? (
        <TranscribingDots />
      ) : (
        <Text style={[styles.voiceText, failed && styles.failedText]}>{segment.text}</Text>
      )}
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
  failedText: {
    color: '#8a8a8a',
    fontStyle: 'italic',
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
