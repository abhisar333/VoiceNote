import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

/** ISO codes Whisper accepts for the `language` param. undefined = Auto-detect
 *  (first-try default — the picker only ever appears on a manual retry). */
const LANGUAGES: { code?: string; label: string }[] = [
  { label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese (Mandarin)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'tr', label: 'Turkish' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'el', label: 'Greek' },
  { code: 'cs', label: 'Czech' },
  { code: 'ro', label: 'Romanian' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'he', label: 'Hebrew' },
  { code: 'fa', label: 'Persian' },
  { code: 'sw', label: 'Swahili' },
  { code: 'ms', label: 'Malay' },
  { code: 'tl', label: 'Filipino' },
  { code: 'sr', label: 'Serbian' },
];

type Props = {
  visible: boolean;
  /** undefined = Auto-detect was chosen. */
  onSelect: (code: string | undefined) => void;
  onClose: () => void;
};

/** Searchable dropdown for the re-transcribe retry (edit mode only).
 *  Auto-detect sits at the top and is the preselected default. */
export default function LanguagePicker({ visible, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return LANGUAGES;
    return LANGUAGES.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) || (entry.code ?? '').toLowerCase().startsWith(q),
    );
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop taps inside the sheet from closing the picker. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.heading}>Transcribe in…</Text>
          <TextInput
            style={styles.search}
            placeholder="Search language…"
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(entry) => entry.code ?? 'auto'}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onSelect(item.code);
                  onClose();
                }}
              >
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.code ? <Text style={styles.rowCode}>{item.code}</Text> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.noMatch}>No language matches.</Text>}
          />
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  sheet: {
    backgroundColor: '#151515',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    maxHeight: '75%',
  },
  heading: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  search: {
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#e8e8e8',
    fontSize: 14,
    backgroundColor: '#0d0d0d',
    marginBottom: 10,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#242424',
    borderBottomWidth: 1,
  },
  rowLabel: {
    color: '#e8e8e8',
    fontSize: 15,
  },
  rowCode: {
    color: '#777',
    fontSize: 13,
  },
  noMatch: {
    color: '#888',
    fontSize: 14,
    paddingVertical: 14,
    textAlign: 'center',
  },
  cancel: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#242424',
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});