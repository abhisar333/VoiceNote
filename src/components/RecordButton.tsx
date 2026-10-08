import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

type Props = {
  onPress: () => void;
  /** True while the mic is recording — shows the stop square. */
  recording?: boolean;
  /** True only while the mic hears sound; silent recording holds still (prd.md > Capture). */
  live?: boolean;
};

/** Round red capture button, bottom right. Tap to start, tap to stop. */
export default function RecordButton({ onPress, recording = false, live = false }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!live) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 380, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: pulse }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Record'}
        onPress={onPress}
        style={[styles.button, live && styles.live]}
      >
        {recording ? <Animated.View style={styles.stop} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e33',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e33',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  live: {
    shadowRadius: 14,
    shadowOpacity: 0.8,
    elevation: 10,
  },
  stop: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});
