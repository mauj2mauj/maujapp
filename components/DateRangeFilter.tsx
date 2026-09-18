import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  formatMonthLabel,
  RANGE_PRESETS,
  type RangePresetKey,
} from '../utils/dateRange';

interface Props {
  preset: RangePresetKey;
  onChangePreset: (preset: RangePresetKey) => void;
  // Only used when preset === 'custom'.
  fromMonth: string;
  toMonth: string;
  onChangeCustom: (fromMonth: string, toMonth: string) => void;
  monthOptions: string[];
  // Human-readable description of the range actually being measured.
  rangeLabel: string;
}

// Month dropdowns are a modal list rather than a picker component: the core
// Picker was removed from React Native, and native date pickers don't work
// in the browser. A list works identically everywhere with no dependency.
function MonthSelect({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (monthKey: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.selectWrapper}>
      <Text style={styles.selectLabel}>{label}</Text>
      <TouchableOpacity style={styles.select} onPress={() => setOpen(true)}>
        <Text style={styles.selectValue}>{formatMonthLabel(value)}</Text>
        <Text style={styles.selectCaret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              style={styles.optionList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item === value && styles.optionTextSelected]}>
                    {formatMonthLabel(item)}
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

export default function DateRangeFilter({
  preset,
  onChangePreset,
  fromMonth,
  toMonth,
  onChangeCustom,
  monthOptions,
  rangeLabel,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {RANGE_PRESETS.map((option) => {
          const selected = option.key === preset;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChangePreset(option.key)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {preset === 'custom' ? (
        <View style={styles.customRow}>
          <MonthSelect
            label="From"
            value={fromMonth}
            options={monthOptions}
            onSelect={(month) => onChangeCustom(month, toMonth)}
          />
          <MonthSelect
            label="To"
            value={toMonth}
            options={monthOptions}
            onSelect={(month) => onChangeCustom(fromMonth, month)}
          />
        </View>
      ) : null}

      <Text style={styles.rangeLabel}>{rangeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 13,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { fontSize: 13, color: '#444' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  customRow: { flexDirection: 'row', marginTop: 4 },
  selectWrapper: { flex: 1, marginRight: 10 },
  selectLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  select: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  selectCaret: { fontSize: 12, color: '#666' },
  rangeLabel: { fontSize: 12, color: '#888', marginTop: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: 360 },
  modalTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  optionList: { flexGrow: 0 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  optionText: { fontSize: 15, color: '#333' },
  optionTextSelected: { color: '#4f46e5', fontWeight: '700' },
});
