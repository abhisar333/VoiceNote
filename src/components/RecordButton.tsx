import { Pressable, StyleSheet } from 'react-native';

type Props = {
  onPress: () => void;
  /** Pulses only while the mic hears sound (prd.md > Capture) — slice 2 wires this. */
  live?: boolean;
};

/** Round red capture button, bottom right. Tap to start, tap to stop. */
export default function RecordButton({ onPress, live = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Record"
      onPress={onPress}
      style={[styles.button, live && styles.live]}
    >
      {live ? <Pressable style={styles.stop} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
