import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ChoiceOption {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  value: string;
  options: ChoiceOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

export default function ChoiceSelect({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select',
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.select} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>{label ?? placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>Nothing to choose yet.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onSelect(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionTextSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 },
  select: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { fontSize: 16, color: '#111', flex: 1, marginRight: 8 },
  placeholder: { fontSize: 16, color: '#999', flex: 1, marginRight: 8 },
  caret: { fontSize: 14, color: '#666' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  list: { flexGrow: 0 },
  empty: { color: '#999', paddingVertical: 12 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  optionText: { fontSize: 16, color: '#333' },
  optionTextSelected: { color: '#4f46e5', fontWeight: '700' },
});
