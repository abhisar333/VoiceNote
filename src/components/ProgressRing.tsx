import { Animated, StyleSheet, View } from 'react-native';

type Props = {
  /** True while a word is being replayed. */
  playing: boolean;
  /** Playback head position, in milliseconds, for the progress arc. */
  positionMs: number;
  /** Full duration of the current take, in milliseconds. */
  durationMs: number;
};

/** Top-left circular ring (spec.md > Components #9): its arc is driven by playback position. */
export default function ProgressRing({ playing, positionMs, durationMs }: Props) {
  if (!playing) return null;

  const progress = Math.min(1, Math.max(0, positionMs / Math.max(1, durationMs)));

  return (
    <View style={styles.wrap}>
      <View style={[styles.bg, { borderColor: '#3a3a3a' }]} />
      <View style={[styles.arc, { transform: [{ rotate: `${-90 + progress * 360}deg` }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  bg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 3,
    borderRadius: 22,
    borderColor: '#3a3a3a',
  },
  arc: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 3,
    borderRadius: 22,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopColor: '#4ade80',
    borderRightColor: '#4ade80',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
});
