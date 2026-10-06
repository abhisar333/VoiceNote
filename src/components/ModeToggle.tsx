import { Pressable, StyleSheet, Text } from 'react-native';

export type NoteMode = 'view' | 'edit';

type Props = { mode: NoteMode; onChange: (mode: NoteMode) => void };

/** Top-right view/edit switch. Fixed position for the POC (prd.md > Modes). */
export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`Mode: ${mode}. Tap to switch.`}
      onPress={() => onChange(mode === 'view' ? 'edit' : 'view')}
      style={styles.track}
    >
      <Text style={[styles.label, mode === 'view' && styles.active]}>View</Text>
      <Text style={[styles.label, mode === 'edit' && styles.active]}>Edit</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#333',
    padding: 3,
    gap: 2,
  },
  label: {
    color: '#777',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  active: {
    color: '#fff',
    backgroundColor: '#333',
  },
});
