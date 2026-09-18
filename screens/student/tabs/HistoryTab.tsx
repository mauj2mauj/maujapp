import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { type LogWithTask } from '../../../utils/stats';
import { getRelevantTasks } from '../../../utils/matrix';
import type { Task } from '../../../types/database';
import { todayHabitProgress } from '../../../utils/studentMotivation';
import HabitMatrix from '../../../components/HabitMatrix';

export default function HistoryTab() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<LogWithTask[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!profile) return;
    setError(null);

    const [logsResult, tasksResult] = await Promise.all([
      // RLS already scopes this to student_id = auth.uid(), so there's no
      // need to add an .eq('student_id', ...) filter — a student physically
      // cannot fetch anyone else's rows here even if they tried.
      supabase
        .from('daily_logs')
        .select('*, task:tasks(id, title, type, color)')
        .order('date', { ascending: false }),
      supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (logsResult.error) {
      setError(logsResult.error.message);
    } else if (logsResult.data) {
      setLogs(logsResult.data as unknown as LogWithTask[]);
    }
    if (tasksResult.data) setActiveTasks(tasksResult.data as Task[]);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const relevantTasks = getRelevantTasks(activeTasks, logs);
  const todayProgress = profile
    ? todayHabitProgress(activeTasks, logs, profile.created_at)
    : { done: 0, total: 0 };
  const remaining = Math.max(todayProgress.total - todayProgress.done, 0);
  const todayPercent =
    todayProgress.total > 0 ? Math.round((todayProgress.done / todayProgress.total) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadHistory();
          }}
        />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.todayCard}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.todayValue}>
          {todayProgress.done} of {todayProgress.total} habits done
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${todayPercent}%` },
            ]}
          />
        </View>
        <Text style={styles.todayHint}>
          {todayProgress.total === 0
            ? 'No habits assigned yet.'
            : remaining === 0
              ? 'All habits done — ਵਧਾਈਆਂ!'
              : `${remaining} left. Finish them to complete today’s Mauj.`}
        </Text>
      </View>

      {relevantTasks.length === 0 ? (
        <Text style={styles.emptyText}>
          No history yet. Log some habits on the Today tab to see them here.
        </Text>
      ) : (
        <HabitMatrix tasks={relevantTasks} logs={logs} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#dc2626', textAlign: 'center', marginBottom: 8 },
  todayCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  todayLabel: { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 1 },
  todayValue: { fontSize: 22, fontWeight: '800', color: '#4f46e5', marginTop: 6 },
  progressTrack: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: '#4f46e5', borderRadius: 4 },
  todayHint: { fontSize: 13, color: '#666', marginTop: 10, lineHeight: 18 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 24 },
});
