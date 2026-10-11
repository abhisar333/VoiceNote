import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import type { Note } from '../features/segments';

type Props = {
  notes: Note[];
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
  onDeleteNote: (id: string) => void;
  /** Rename from the tile: tap the title text, type, blur/return to commit. */
  onRenameNote: (id: string, title: string) => void;
};

function preview(note: Note): string {
  const first = note.segments.map((segment) => segment.text.trim()).find((text) => text !== '');
  return first ?? '(empty note)';
}

function titleOf(note: Note): string {
  const title = note.title?.trim();
  return title ? title : 'No title';
}

/** Homepage: square tiles, newest first. The title line is tappable for an
 *  inline rename; the rest of the tile opens the note. A search box filters
 *  by title AND content; a toggle sorts by date or alphabetically. */
export default function HomeScreen({
  notes,
  onOpenNote,
  onNewNote,
  onDeleteNote,
  onRenameNote,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'alpha'>('date');

  const confirmDelete = (note: Note) => {
    Alert.alert('Delete note?', `${titleOf(note)} — ${preview(note)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteNote(note.id) },
    ]);
  };

  const startRename = (note: Note) => {
    setEditingId(note.id);
    setDraftTitle(note.title ?? '');
  };

  const commitRename = (id: string) => {
    onRenameNote(id, draftTitle);
    setEditingId(null);
    setDraftTitle('');
  };

  // Search matches the title or ANY block's text (case-insensitive);
  // then sort by date (newest first) or alphabetically by title.
  const q = query.trim().toLowerCase();
  const visible = notes
    .filter((note) => {
      if (q === '') return true;
      if (titleOf(note).toLowerCase().includes(q)) return true;
      return note.segments.some((segment) => segment.text.toLowerCase().includes(q));
    })
    .sort((a, b) =>
      sortBy === 'date'
        ? b.updatedAt - a.updatedAt
        : titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' }),
    );
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Notes</Text>

        <View style={styles.controls}>
          <TextInput
            style={styles.search}
            placeholder="Search title or content…"
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          <View style={styles.sortGroup}>
            <Pressable
              style={[styles.sortButton, sortBy === 'date' && styles.sortButtonActive]}
              onPress={() => setSortBy('date')}
            >
              <Text style={[styles.sortText, sortBy === 'date' && styles.sortTextActive]}>
                Date
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sortButton, sortBy === 'alpha' && styles.sortButtonActive]}
              onPress={() => setSortBy('alpha')}
            >
              <Text style={[styles.sortText, sortBy === 'alpha' && styles.sortTextActive]}>
                A–Z
              </Text>
            </Pressable>
          </View>
        </View>

        {visible.length === 0 ? (
          <Text style={styles.empty}>
            {notes.length === 0 ? 'No notes yet — start one below.' : 'No notes match.'}
          </Text>
        ) : null}

        <View style={styles.grid}>
          {visible.map((note) => {
            const editing = editingId === note.id;
            return (
              <View key={note.id} style={styles.tile}>
                {editing ? (
                  <TextInput
                    style={styles.tileTitleInput}
                    placeholder="Title"
                    placeholderTextColor="#555"
                    value={draftTitle}
                    autoFocus
                    onChangeText={setDraftTitle}
                    onBlur={() => commitRename(note.id)}
                    onSubmitEditing={() => commitRename(note.id)}
                    returnKeyType="done"
                  />
                ) : (
                  // Tapping the title renames instead of opening the note.
                  <Pressable hitSlop={4} onPress={() => startRename(note)}>
                    <Text style={styles.tileTitle} numberOfLines={1}>
                      {titleOf(note)}
                    </Text>
                  </Pressable>
                )}

                <Pressable style={styles.tileBody} onPress={() => onOpenNote(note.id)}>
                  <Text style={styles.tileText} numberOfLines={4}>
                    {preview(note)}
                  </Text>
                  <Text style={styles.tileMeta}>
                    {note.segments.length} {note.segments.length === 1 ? 'block' : 'blocks'} ·{' '}
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  hitSlop={6}
                  onPress={() => confirmDelete(note)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Red round "+" FAB, bottom-right — mirrors the round record button. */}
      <Pressable style={styles.fab} onPress={onNewNote} accessibilityLabel="New note">
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 64,
    paddingBottom: 130,
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
  controls: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  search: {
    flex: 1,
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#e8e8e8',
    fontSize: 14,
    backgroundColor: '#0d0d0d',
  },
  sortGroup: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  sortButton: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: '#0d0d0d',
  },
  sortButtonActive: {
    backgroundColor: '#262626',
  },
  sortText: {
    color: '#777',
    fontSize: 13,
    fontWeight: '600',
  },
  sortTextActive: {
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    // Two squares per row: (screen − padding − gap) / 2, kept square by aspectRatio.
    width: '47.5%',
    aspectRatio: 1,
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#0d0d0d',
    padding: 12,
    justifyContent: 'space-between',
  },
  tileTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  tileTitleInput: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    borderBottomColor: '#e07070',
    borderBottomWidth: 1,
    padding: 0,
  },
  tileBody: {
    flex: 1,
    justifyContent: 'center',
  },
  tileText: {
    color: '#b9b9b9',
    fontSize: 13,
    lineHeight: 19,
  },
  tileMeta: {
    color: '#777',
    fontSize: 11,
    marginTop: 6,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4a2a2a',
    backgroundColor: '#1c1010',
  },
  deleteText: {
    color: '#e07070',
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 36,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e03535',
    alignItems: 'center',
    justifyContent: 'center',
    // Same soft glow family as the round record button on the editor screen.
    shadowColor: '#e03535',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  fabPlus: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 36,
  },
});
