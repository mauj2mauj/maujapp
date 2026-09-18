import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart } from 'react-native-gifted-charts';
import { supabase } from '../../../lib/supabase';
import type { AdminStudentsStackParamList } from '../../../navigation/AdminStudentsStack';
import type { Profile, Task } from '../../../types/database';
import type { LogWithTask } from '../../../utils/stats';
import { getRelevantTasks } from '../../../utils/matrix';
import { computeHabitStats, getHabitStartDate } from '../../../utils/habitStats';
import { getLocalDateString } from '../../../utils/date';
import {
  buildMonthOptions,
  formatDayLabel,
  formatRangeLabel,
  getCustomRange,
  getPresetRange,
  monthKeyOf,
  rangeIsEmpty,
  clampRange,
  eachDay,
  type RangePresetKey,
} from '../../../utils/dateRange';
import HabitMatrix from '../../../components/HabitMatrix';
import DateRangeFilter from '../../../components/DateRangeFilter';
import ChartInfo from '../../../components/ChartInfo';
import DoneMissedPie from '../../../components/DoneMissedPie';

const MISSED_COLOR = '#e5e7eb';

type Props = NativeStackScreenProps<AdminStudentsStackParamList, 'StudentDetail'>;

export default function StudentDetailScreen({ route, navigation }: Props) {
  const { studentId } = route.params;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = getLocalDateString();
  const [preset, setPreset] = useState<RangePresetKey>('this_month');
  const currentMonth = monthKeyOf(today);
  const [customFrom, setCustomFrom] = useState(currentMonth);
  const [customTo, setCustomTo] = useState(currentMonth);
  const [selectedHabitIndex, setSelectedHabitIndex] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    const [profileResult, tasksResult, logsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', studentId).single(),
      supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      // Embeds the related `tasks` row for each log via the task_id foreign
      // key, so we get the title/type in one round trip instead of a
      // second query + manual lookup.
      supabase
        .from('daily_logs')
        .select('*, task:tasks(id, title, type, color)')
        .eq('student_id', studentId)
        .order('date', { ascending: false }),
    ]);

    if (profileResult.error) {
      setError(profileResult.error.message);
      setLoading(false);
      return;
    }
    setProfile(profileResult.data as Profile);
    if (tasksResult.data) setActiveTasks(tasksResult.data as Task[]);
    if (logsResult.data) setLogs(logsResult.data as unknown as LogWithTask[]);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Student not found.'}</Text>
      </View>
    );
  }

  const relevantTasks = getRelevantTasks(activeTasks, logs);
  const todayLogs = logs.filter((log) => log.date === today);

  // The student's join date is the earliest point any of this data can
  // exist, so it bounds both "All time" and the custom month dropdowns.
  const studentStartDate = getLocalDateString(new Date(profile.created_at));
  const monthOptions = buildMonthOptions(studentStartDate);
  const requestedRange =
    preset === 'custom'
      ? getCustomRange(customFrom, customTo)
      : getPresetRange(preset, studentStartDate);
  const studentRange = clampRange(requestedRange, studentStartDate);
  const rangeEmpty = rangeIsEmpty(studentRange);

  // One entry per habit — done/total days within the selected range,
  // sorted so the most-completed habit is first, both in the ranked list
  // and (since gifted-charts renders stacks in data order) the chart.
  const habitComparisons = relevantTasks
    .map((task) => {
      const habitStartDate = getHabitStartDate(task.created_at, profile.created_at);
      const habitStats = computeHabitStats(
        logs,
        task.id,
        task.type,
        habitStartDate,
        requestedRange
      );
      return { task, habitStats };
    })
    .filter(({ habitStats }) => !habitStats.isEmpty)
    .sort((a, b) => b.habitStats.completedDays - a.habitStats.completedDays);

  const maxDaysInRange = habitComparisons.reduce(
    (max, { habitStats }) => Math.max(max, habitStats.totalDays),
    1
  );
  // Numeric labels (not habit titles) keep the x-axis short and
  // horizontal so nothing gets clipped or rotated into illegibility — the
  // numbered list rendered right below the chart is the "legend" mapping
  // each number back to a habit name.
  // Both the whole bar and each of its two segments select the habit, so a
  // tap anywhere on the column fills in the readout below the chart.
  const stackData = habitComparisons.map(({ task, habitStats }, index) => ({
    stacks: [
      { value: habitStats.completedDays, color: task.color, onPress: () => setSelectedHabitIndex(index) },
      { value: habitStats.missedDays, color: MISSED_COLOR, onPress: () => setSelectedHabitIndex(index) },
    ],
    label: String(index + 1),
  }));

  const daysInRange = eachDay(studentRange);
  const completedByDate = new Map<string, Set<string>>();
  for (const log of logs) {
    if (
      !log.completed ||
      log.date < studentRange.start ||
      log.date > studentRange.end
    ) {
      continue;
    }
    const existing = completedByDate.get(log.date);
    if (existing) existing.add(log.task_id);
    else completedByDate.set(log.date, new Set([log.task_id]));
  }

  const anyActivityDays = daysInRange.filter((day) => (completedByDate.get(day)?.size ?? 0) > 0).length;
  const trackedHabits = activeTasks.map((task) => ({
    id: task.id,
    start: getHabitStartDate(task.created_at, profile.created_at),
  }));
  const allHabitsDays = daysInRange.filter((day) => {
    const required = trackedHabits.filter((habit) => habit.start <= day);
    if (required.length === 0) return false;
    const completed = completedByDate.get(day);
    return required.every((habit) => completed?.has(habit.id));
  }).length;
  const overallTotal = daysInRange.length;

  const selected =
    selectedHabitIndex != null ? habitComparisons[selectedHabitIndex] : undefined;
  const joinedDate = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>
        {profile.first_name} {profile.last_name}
      </Text>
      <Text style={styles.email}>{profile.email}</Text>
      {profile.phone ? <Text style={styles.email}>{profile.phone}</Text> : null}
      {profile.referral_source ? (
        <Text style={styles.referral}>Heard about Mauj via {profile.referral_source}</Text>
      ) : null}
      <Text style={styles.joined}>Joined {joinedDate}</Text>

      <DateRangeFilter
        preset={preset}
        onChangePreset={(next) => {
          setPreset(next);
          setSelectedHabitIndex(null);
        }}
        fromMonth={customFrom}
        toMonth={customTo}
        onChangeCustom={(from, to) => {
          setCustomFrom(from);
          setCustomTo(to);
        }}
        monthOptions={monthOptions}
        rangeLabel={
          rangeEmpty
            ? 'This student hadn’t joined yet during this period.'
            : `Stats below cover ${formatRangeLabel(studentRange)}`
        }
      />

      <Text style={styles.sectionTitle}>Today</Text>
      {activeTasks.length === 0 ? (
        <Text style={styles.emptyText}>No active habits.</Text>
      ) : (
        activeTasks.map((task) => {
          const log = todayLogs.find((l) => l.task_id === task.id);
          const done = log?.completed ?? false;
          return (
            <View key={task.id} style={styles.todayRow}>
              <Text style={[styles.todayTitle, { color: task.color }]}>{task.title}</Text>
              <Text style={[styles.todayStatus, done && styles.todayStatusDone]}>
                {task.type === 'boolean'
                  ? done
                    ? 'Done'
                    : 'Not done'
                  : `${log?.duration_minutes ?? 0} min`}
              </Text>
            </View>
          );
        })
      )}

      {habitComparisons.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Overall</Text>
          <View style={styles.chartCard}>
            <DoneMissedPie
              title="At least 1 habit"
              done={anyActivityDays}
              missed={overallTotal - anyActivityDays}
              color="#4f46e5"
              unit="days"
              explanation="A day counts as done if at least one habit was completed."
            />
          </View>
          <View style={styles.chartCard}>
            <DoneMissedPie
              title="All habits done"
              done={allHabitsDays}
              missed={overallTotal - allHabitsDays}
              color="#059669"
              unit="days"
              explanation="A day counts as done only if every assigned habit was completed."
            />
          </View>

          <Text style={styles.sectionTitle}>Habit comparison</Text>
          <View style={styles.chartCard}>
            <BarChart
              stackData={stackData}
              barWidth={28}
              spacing={20}
              maxValue={maxDaysInRange}
              noOfSections={4}
              height={160}
              xAxisLabelTextStyle={styles.chartAxisLabel}
              yAxisTextStyle={styles.chartAxisLabel}
              onPress={(_item: unknown, index: number) => setSelectedHabitIndex(index)}
            />
            <Text style={styles.chartNote}>
              One bar per habit, numbered to match the list below. The coloured part is days done,
              grey is days missed, and the full height is the {maxDaysInRange} days in this period.
            </Text>
            <ChartInfo
              placeholder="Tap a bar — or a habit below — for its numbers"
              title={selected ? selected.task.title : undefined}
              accentColor={selected?.task.color}
              lines={
                selected
                  ? [
                      `${selected.habitStats.completionPercent}% — done on ${selected.habitStats.completedDays} of ${selected.habitStats.totalDays} days, missed ${selected.habitStats.missedDays}`,
                      selected.habitStats.lastCompletedDate
                        ? `Last done ${formatDayLabel(selected.habitStats.lastCompletedDate)}.`
                        : 'Never done in this period.',
                      'Tap the habit name in the grid below for its full breakdown.',
                    ]
                  : undefined
              }
            />
          </View>

          {habitComparisons.map(({ task, habitStats }, index) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.comparisonRow, selectedHabitIndex === index && styles.comparisonRowSelected]}
              onPress={() => setSelectedHabitIndex(index)}
            >
              <Text style={[styles.comparisonTitle, { color: task.color }]} numberOfLines={1}>
                {index + 1}. {task.title}
              </Text>
              <Text style={styles.comparisonValue}>
                {habitStats.completedDays}/{habitStats.totalDays} days (
                {habitStats.completionPercent}%)
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>History</Text>
      {relevantTasks.length === 0 || rangeEmpty ? (
        <Text style={styles.emptyText}>No history in this period.</Text>
      ) : (
        <HabitMatrix
          tasks={relevantTasks}
          logs={logs}
          range={studentRange}
          onPressTask={(task) =>
            navigation.navigate('HabitDetail', {
              studentId,
              studentName: `${profile.first_name} ${profile.last_name}`,
              taskId: task.id,
              taskTitle: task.title,
              taskType: task.type,
              taskColor: task.color,
              taskCreatedAt: task.created_at,
              studentJoinedAt: profile.created_at,
            })
          }
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  error: { color: '#dc2626', textAlign: 'center', padding: 16 },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  referral: { fontSize: 13, color: '#666', marginTop: 6, fontStyle: 'italic' },
  joined: { fontSize: 13, color: '#999', marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  emptyText: { color: '#999', marginBottom: 16 },
  chartCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 24,
    marginBottom: 12,
  },
  chartAxisLabel: { fontSize: 10, color: '#666' },
  chartNote: { fontSize: 12, color: '#888', marginTop: 16, lineHeight: 17 },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  comparisonRowSelected: { backgroundColor: '#f5f3ff' },
  comparisonTitle: { fontSize: 13, color: '#333', flex: 1, marginRight: 8 },
  comparisonValue: { fontSize: 13, color: '#666', fontWeight: '600' },
  todayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  todayTitle: { fontSize: 14, color: '#333' },
  todayStatus: { fontSize: 13, color: '#999', fontWeight: '600' },
  todayStatusDone: { color: '#059669' },
});
