import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Note } from '../features/segments';

type Props = {
  notes: Note[];
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
};

function preview(note: Note): string {
  const first = note.segments.map((segment) => segment.text.trim()).find((text) => text !== '');
  return first ?? '(empty note)';
}

/** Homepage (feature branch): the list of notes the app opens on. */
export default function HomeScreen({ notes, onOpenNote, onNewNote }: Props) {
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Notes</Text>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>No notes yet — start one below.</Text>
      ) : (
        sorted.map((note) => (
          <Pressable key={note.id} style={styles.row} onPress={() => onOpenNote(note.id)}>
            <Text style={styles.rowText} numberOfLines={1}>
              {preview(note)}
            </Text>
            <Text style={styles.rowMeta}>
              {note.segments.length} {note.segments.length === 1 ? 'block' : 'blocks'} ·{' '}
              {new Date(note.updatedAt).toLocaleDateString()}
            </Text>
          </Pressable>
        ))
      )}
      <Pressable style={styles.newButton} onPress={onNewNote}>
        <Text style={styles.newButtonText}>+ New note</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 18,
    paddingTop: 64,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  empty: {
    color: '#888',
    fontSize: 15,
    marginBottom: 16,
  },
  row: {
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowText: {
    color: '#e8e8e8',
    fontSize: 16,
  },
  rowMeta: {
    color: '#777',
    fontSize: 12,
    marginTop: 4,
  },
  newButton: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  newButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
