import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { DEFAULT_HABIT_COLOR, HABIT_COLORS, type Task, type TaskType } from '../../../types/database';

const DEFAULT_NEW_HABIT_COLOR =
  HABIT_COLORS.find((option) => option.label === 'Secondary')?.value ?? DEFAULT_HABIT_COLOR;

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  const selected = HABIT_COLORS.find((option) => option.value === value);

  return (
    <View style={styles.colorSection}>
      <Text style={styles.colorLabel}>Colour{selected ? `: ${selected.label}` : ''}</Text>
      <View style={styles.colorRow}>
        {HABIT_COLORS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.colorSwatch,
              { backgroundColor: option.value },
              value === option.value && styles.colorSwatchSelected,
            ]}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

export default function HabitManagementTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('boolean');
  // Defaults to "Secondary" so a new habit isn't accidentally marked crucial.
  const [color, setColor] = useState(DEFAULT_NEW_HABIT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<TaskType>('boolean');
  const [editColor, setEditColor] = useState(DEFAULT_HABIT_COLOR);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (!fetchError && data) setTasks(data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAddTask = async () => {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Enter a habit title.');
      return;
    }
    setSubmitting(true);
    const { error: insertError } = await supabase.from('tasks').insert({
      title: trimmed,
      type,
      color,
      // New habits land at the bottom of the list.
      sort_order: tasks.reduce((max, task) => Math.max(max, task.sort_order), -1) + 1,
      is_active: true,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle('');
    loadTasks();
  };

  // "Removing" a habit sets is_active = false rather than deleting the row.
  // Deleting would cascade-delete every daily_logs entry that references it
  // (we set `on delete cascade`), wiping historical data. Soft-deleting
  // keeps history intact while hiding it from students' daily log screen.
  const toggleActive = async (task: Task) => {
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ is_active: !task.is_active })
      .eq('id', task.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    loadTasks();
  };

  // Writes the new position of every habit whose index changed. The list is
  // short, so renumbering the whole thing is simpler — and more robust
  // against duplicate sort_order values — than juggling two rows.
  const persistOrder = async (ordered: Task[]) => {
    const moved = ordered
      .map((task, index) => ({ task, index }))
      .filter(({ task, index }) => task.sort_order !== index);
    if (moved.length === 0) return;

    const results = await Promise.all(
      moved.map(({ task, index }) =>
        supabase.from('tasks').update({ sort_order: index }).eq('id', task.id)
      )
    );
    const failure = results.find((result) => result.error);
    if (failure?.error) {
      setError(failure.error.message);
      loadTasks();
    }
  };

  const moveTask = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tasks.length) return;

    setError(null);
    const reordered = [...tasks];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    // Update the UI immediately, then renumber in the background.
    setTasks(reordered.map((task, position) => ({ ...task, sort_order: position })));
    persistOrder(reordered);
  };

  const openEdit = (task: Task) => {
    setError(null);
    setEditError(null);
    setEditTitle(task.title);
    setEditType(task.type);
    setEditColor(task.color);
    setEditing(task);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError(null);

    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditError('Enter a habit title.');
      return;
    }

    setEditSaving(true);
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ title: trimmed, type: editType, color: editColor })
      .eq('id', editing.id);
    setEditSaving(false);

    if (updateError) {
      setEditError(updateError.message);
      return;
    }
    setEditing(null);
    loadTasks();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setError(null);
    setDeleting(true);
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', pendingDelete.id);
    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setPendingDelete(null);
    loadTasks();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Habit title (e.g. Drink water)"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeButton, type === 'boolean' && styles.typeButtonActive]}
            onPress={() => setType('boolean')}
          >
            <Text style={[styles.typeButtonText, type === 'boolean' && styles.typeButtonTextActive]}>
              Yes / No
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === 'duration' && styles.typeButtonActive]}
            onPress={() => setType('duration')}
          >
            <Text style={[styles.typeButtonText, type === 'duration' && styles.typeButtonTextActive]}>
              Duration
            </Text>
          </TouchableOpacity>
        </View>
        <ColorPicker value={color} onChange={setColor} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>Add Habit</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No habits yet.</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.rowInfo}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: item.color },
                    // A removed habit reads as greyed-out rather than coloured.
                    !item.is_active && styles.rowTitleInactive,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.type === 'boolean' ? 'Yes / No' : 'Duration'}
                  {item.is_active ? '' : ' · hidden from students'}
                </Text>
              </View>
              <View style={styles.reorder}>
                <TouchableOpacity
                  style={[styles.arrowButton, index === 0 && styles.arrowButtonDisabled]}
                  disabled={index === 0}
                  onPress={() => moveTask(index, -1)}
                >
                  <Text style={styles.arrowText}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.arrowButton,
                    index === tasks.length - 1 && styles.arrowButtonDisabled,
                  ]}
                  disabled={index === tasks.length - 1}
                  onPress={() => moveTask(index, 1)}
                >
                  <Text style={styles.arrowText}>↓</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rowActions}>
              <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}>
                <Text style={styles.editAction}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleActive(item)} hitSlop={8}>
                <Text style={styles.hideAction}>{item.is_active ? 'Remove' : 'Restore'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  setPendingDelete(item);
                }}
                hitSlop={8}
              >
                <Text style={styles.deleteAction}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit habit</Text>
            <TextInput
              style={styles.input}
              placeholder="Habit title"
              placeholderTextColor="#999"
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeButton, editType === 'boolean' && styles.typeButtonActive]}
                onPress={() => setEditType('boolean')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    editType === 'boolean' && styles.typeButtonTextActive,
                  ]}
                >
                  Yes / No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, editType === 'duration' && styles.typeButtonActive]}
                onPress={() => setEditType('duration')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    editType === 'duration' && styles.typeButtonTextActive,
                  ]}
                >
                  Duration
                </Text>
              </TouchableOpacity>
            </View>
            <ColorPicker value={editColor} onChange={setEditColor} />
            {editError ? <Text style={styles.error}>{editError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setEditing(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSave]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete habit permanently?</Text>
            <Text style={styles.modalBody}>
              {pendingDelete?.title} and every student&apos;s logged history for it will be erased.
              This cannot be undone — use Remove instead if you only want to hide it from students.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setPendingDelete(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDelete]}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  typeToggle: {
    flexDirection: 'row',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  typeButton: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#fff' },
  typeButtonActive: { backgroundColor: '#4f46e5' },
  typeButtonText: { color: '#4f46e5', fontWeight: '600' },
  typeButtonTextActive: { color: '#fff' },
  colorSection: { marginBottom: 10 },
  colorLabel: { fontSize: 13, color: '#666', marginBottom: 6 },
  colorRow: { flexDirection: 'row' },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: { borderColor: '#111' },
  error: { color: '#dc2626', marginBottom: 8 },
  addButton: { backgroundColor: '#4f46e5', borderRadius: 8, padding: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600' },
  listContent: { paddingBottom: 24 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
    marginBottom: 4,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowInfo: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowTitleInactive: { color: '#999', textDecorationLine: 'line-through' },
  rowMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  reorder: { flexDirection: 'row' },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  arrowButtonDisabled: { opacity: 0.35 },
  arrowText: { fontSize: 16, color: '#444', fontWeight: '700', lineHeight: 18 },
  rowActions: { flexDirection: 'row', marginTop: 10 },
  editAction: { fontSize: 13, fontWeight: '600', color: '#4f46e5', marginRight: 18 },
  hideAction: { fontSize: 13, fontWeight: '600', color: '#b45309', marginRight: 18 },
  deleteAction: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalBody: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginLeft: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  modalCancel: { backgroundColor: '#f3f4f6' },
  modalCancelText: { color: '#444', fontWeight: '600' },
  modalSave: { backgroundColor: '#4f46e5' },
  modalDelete: { backgroundColor: '#dc2626' },
  modalPrimaryText: { color: '#fff', fontWeight: '600' },
});
