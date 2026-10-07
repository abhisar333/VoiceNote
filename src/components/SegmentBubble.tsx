import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Segment, VoiceSegment } from '../features/segments';
import type { NoteMode } from './ModeToggle';

type Props = {
  segment: Segment;
  mode: NoteMode;
  /** Called when the user long-presses a voice word (view mode only). */
  onReplayWord?: (segment: VoiceSegment, startMs: number) => void;
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

/** Renders one segment: typed text as plain note text; voice as the grey bubble (prd.md > Look and Feel).
 *  Voice states: dots while transcribing, transcript when done, message when the engine failed
 *  (spec.md > Components #3, prd.md > States & Edge Cases). */
export default function SegmentBubble({ segment, mode, onReplayWord }: Props) {
  if (segment.kind === 'typed') {
    return <Text style={styles.typed}>{segment.text}</Text>;
  }

  const failed = segment.words === null && segment.text !== '';
  const transcribing = segment.words === null && segment.text === '';

  // View mode only: a plain tap does nothing; long-press a word starts that spot.
  if (mode === 'view' && segment.kind === 'voice' && segment.words) {
    return (
      <View style={styles.voice}>
        {segment.words.map((word, index) => (
          <Pressable
            key={`${segment.id}-${index}`}
            onPress={() => {}}
            onLongPress={() => onReplayWord?.(segment, word.startMs)}
          >
            <Text style={styles.word}>{word.text} </Text>
          </Pressable>
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
    color: '#d8d8d8',
    fontSize: 17,
    lineHeight: 26,
    paddingVertical: 4,
    marginRight: 6,
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
