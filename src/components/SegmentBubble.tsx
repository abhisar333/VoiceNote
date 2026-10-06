import { StyleSheet, Text, View } from 'react-native';

import type { Segment } from '../features/segments';
import type { NoteMode } from './ModeToggle';

type Props = {
  segment: Segment;
  mode: NoteMode;
  /** Voice-only handlers arrive with slice 3 (replay) / slice 4 (edit). */
};

/** Renders one segment: typed text as plain note text; voice as the grey bubble (prd.md > Look and Feel). */
export default function SegmentBubble({ segment }: Props) {
  if (segment.kind === 'typed') {
    return <Text style={styles.typed}>{segment.text}</Text>;
  }
  return (
    <View style={styles.voice}>
      <Text style={styles.voiceText}>{segment.text}</Text>
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
  voiceText: {
    color: '#d8d8d8',
    fontSize: 17,
    lineHeight: 26,
  },
});
