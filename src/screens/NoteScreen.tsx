import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Note } from '../features/segments';
import ModeToggle, { type NoteMode } from '../components/ModeToggle';
import RecordButton from '../components/RecordButton';
import SegmentBubble from '../components/SegmentBubble';

type Props = {
  note: Note;
  mode: NoteMode;
  onModeChange: (mode: NoteMode) => void;
  onAddTypedSegment: (text: string) => void;
  onRecordPress: () => void;
};

/** The one screen: ring slot (top-left) · toggle (top-right) · segments · record button (bottom-right).
 *  Implements prd.md > The Core Journey, Modes, Look and Feel. */
export default function NoteScreen({
  note,
  mode,
  onModeChange,
  onAddTypedSegment,
  onRecordPress,
}: Props) {
  const composerRef = useRef<TextInput>(null);
  // The draft lives in state, not only inside the TextInput: view mode unmounts the
  // composer, so anything still typed would otherwise vanish with it.
  const [draft, setDraft] = useState('');
  const isEdit = mode === 'edit';
  const isEmpty = note.segments.length === 0;

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed !== '') onAddTypedSegment(trimmed);
    setDraft('');
  };

  // Leaving edit mode commits the in-progress block instead of losing it.
  const handleModeChange = (next: NoteMode) => {
    if (mode === 'edit' && next === 'view') commitDraft();
    onModeChange(next);
  };

  // Record also closes the current block, so a voice segment lands after it.
  const handleRecordPress = () => {
    commitDraft();
    onRecordPress();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        {/* Progress ring slot — populated in slice 3 */}
        <View style={styles.ringSlot} />
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {note.segments.map((segment) => (
          <SegmentBubble key={segment.id} segment={segment} mode={mode} />
        ))}

        {isEdit ? (
          <Pressable
            style={styles.emptyArea}
            onPress={() => composerRef.current?.focus()}
          >
            <TextInput
              ref={composerRef}
              style={styles.composer}
              placeholder={isEmpty ? '' : 'Type…'}
              placeholderTextColor="#555"
              multiline
              autoFocus={isEmpty}
              value={draft}
              onChangeText={setDraft}
              // Enter inserts a newline inside the same block (learner decision);
              // the block commits on blur, on record press, and on mode switch.
              onEndEditing={commitDraft}
            />
            {isEmpty ? <Text style={styles.cursorHint} /> : null}
          </Pressable>
        ) : (
          <View style={styles.viewPad} />
        )}
      </ScrollView>

      <View style={styles.recordSlot}>
        <RecordButton onPress={handleRecordPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 10,
  },
  ringSlot: {
    width: 44,
    height: 44,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 140,
  },
  emptyArea: {
    minHeight: 220,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  composer: {
    color: '#e8e8e8',
    fontSize: 17,
    lineHeight: 26,
    padding: 0,
    minHeight: 26,
  },
  cursorHint: {
    height: 0,
  },
  viewPad: {
    height: 60,
  },
  recordSlot: {
    position: 'absolute',
    right: 24,
    bottom: 36,
  },
});
