import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import NoteScreen from './src/screens/NoteScreen';
import type { NoteMode } from './src/components/ModeToggle';
import { addTypedSegment, emptyNote, type Note } from './src/features/segments';

/** Root: owns the note and the mode; saves to disk from slice 4 on.
 *  Implements prd.md > States & Edge Cases (restart row, later slices). */
export default function App() {
  const [note, setNote] = useState<Note>(emptyNote);
  // PRD: the app opens in edit mode so an empty note shows its blinking cursor.
  const [mode, setMode] = useState<NoteMode>('edit');

  return (
    <>
      <StatusBar style="light" />
      <NoteScreen
        note={note}
        mode={mode}
        onModeChange={setMode}
        onAddTypedSegment={(text) => setNote((current) => addTypedSegment(current, text))}
        onRecordPress={() => {
          /* slice 2: recording */
        }}
      />
    </>
  );
}

