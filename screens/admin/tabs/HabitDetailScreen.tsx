import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart } from 'react-native-gifted-charts';
import { supabase } from '../../../lib/supabase';
import type { AdminStudentsStackParamList } from '../../../navigation/AdminStudentsStack';
import { computeHabitStats, getHabitStartDate } from '../../../utils/habitStats';
import type { LogWithTask } from '../../../utils/stats';
import {
  buildMonthOptions,
  formatDayLabel,
  formatRangeLabel,
  getCustomRange,
  getPresetRange,
  monthKeyOf,
  previousRangeOf,
  type RangePresetKey,
} from '../../../utils/dateRange';
import { getLocalDateString } from '../../../utils/date';
import { daysBetween } from '../../../utils/stats';
import DateRangeFilter from '../../../components/DateRangeFilter';
import HabitCalendar from '../../../components/HabitCalendar';
import ChartInfo from '../../../components/ChartInfo';
import DoneMissedPie from '../../../components/DoneMissedPie';

type Props = NativeStackScreenProps<AdminStudentsStackParamList, 'HabitDetail'>;

interface Selection {
  title: string;
  lines: string[];
}

const MISSED_COLOR = '#e5e7eb';

export default function HabitDetailScreen({ route }: Props) {
  const { studentId, studentName, taskId, taskType, taskColor, taskCreatedAt, studentJoinedAt } =
    route.params;
  const [logs, setLogs] = useState<LogWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<RangePresetKey>('this_month');
  const currentMonth = monthKeyOf(getLocalDateString());
  const [customFrom, setCustomFrom] = useState(currentMonth);
  const [customTo, setCustomTo] = useState(currentMonth);

  // One selection per chart, so tapping the weekly chart doesn't wipe what
  // you just read off the pie.
  const [weekSelection, setWeekSelection] = useState<Selection | null>(null);
  const [weekdaySelection, setWeekdaySelection] = useState<Selection | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    // Scoped to just this student + habit — independent of whatever
    // StudentDetailScreen already has loaded, so this screen works fine
    // even if navigated to directly.
    const { data, error: fetchError } = await supabase
      .from('daily_logs')
      .select('*, task:tasks(id, title, type, color)')
      .eq('student_id', studentId)
      .eq('task_id', taskId)
      .order('date', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else if (data) {
      setLogs(data as unknown as LogWithTask[]);
    }
    setLoading(false);
  }, [studentId, taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const habitStartDate = getHabitStartDate(taskCreatedAt, studentJoinedAt);
  const monthOptions = useMemo(() => buildMonthOptions(habitStartDate), [habitStartDate]);

  const requestedRange =
    preset === 'custom'
      ? getCustomRange(customFrom, customTo)
      : getPresetRange(preset, habitStartDate);

  const stats = computeHabitStats(logs, taskId, taskType, habitStartDate, requestedRange);
  // The same-length stretch immediately before, so "getting better or
  // worse?" is answerable at a glance.
  const previousStats = computeHabitStats(
    logs,
    taskId,
    taskType,
    habitStartDate,
    previousRangeOf(stats.effectiveRange)
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const today = getLocalDateString();
  const changeInPoints = previousStats.isEmpty
    ? null
    : stats.completionPercent - previousStats.completionPercent;

  const lastDoneLabel = (() => {
    if (!stats.lastCompletedDate) return 'Not in this period';
    const gap = daysBetween(today, stats.lastCompletedDate);
    if (gap === 0) return 'Today';
    if (gap === 1) return 'Yesterday';
    if (gap < 0) return formatDayLabel(stats.lastCompletedDate);
    return `${gap} days ago`;
  })();

  const rankedWeekdays = [...stats.weekdayBreakdown]
    .filter((bucket) => bucket.total > 0)
    .sort((a, b) => b.percent - a.percent);
  const bestWeekday = rankedWeekdays[0];
  const worstWeekday = rankedWeekdays[rankedWeekdays.length - 1];

  const weeklyData = stats.weeklyBreakdown.map((week) => ({
    value: week.percent,
    frontColor: taskColor,
    label: week.label,
  }));

  const weekdayData = stats.weekdayBreakdown.map((bucket) => ({
    value: bucket.percent,
    frontColor: bucket.total > 0 ? taskColor : MISSED_COLOR,
    label: bucket.label.slice(0, 1),
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>for {studentName}</Text>

      <DateRangeFilter
        preset={preset}
        onChangePreset={(next) => {
          setPreset(next);
          setWeekSelection(null);
          setWeekdaySelection(null);
        }}
        fromMonth={customFrom}
        toMonth={customTo}
        onChangeCustom={(from, to) => {
          setCustomFrom(from);
          setCustomTo(to);
        }}
        monthOptions={monthOptions}
        rangeLabel={
          stats.isEmpty
            ? 'This habit wasn’t being tracked during this period.'
            : `${formatRangeLabel(stats.effectiveRange)} · ${stats.totalDays} days`
        }
      />

      {stats.isEmpty ? (
        <Text style={styles.emptyText}>
          Pick a period on or after {formatDayLabel(habitStartDate)}, when this habit started for{' '}
          {studentName}.
        </Text>
      ) : (
        <>
          {/* Headline: one number, then the same number in words. */}
          <View style={[styles.headline, { borderColor: taskColor }]}>
            <Text style={[styles.headlineValue, { color: taskColor }]}>
              {stats.completionPercent}%
            </Text>
            <Text style={styles.headlineCaption}>
              Done on {stats.completedDays} of {stats.totalDays} days
              {stats.missedDays > 0 ? `, missed ${stats.missedDays}` : ''}
            </Text>
            <Text style={styles.headlineNote}>A day with no entry counts as missed.</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statValueSmall]}>{lastDoneLabel}</Text>
              <Text style={styles.statLabel}>Last done</Text>
            </View>
            <View style={styles.statBox}>
              <Text
                style={[
                  styles.statValue,
                  changeInPoints != null && changeInPoints > 0 && styles.statValueUp,
                  changeInPoints != null && changeInPoints < 0 && styles.statValueDown,
                ]}
              >
                {changeInPoints == null
                  ? '—'
                  : `${changeInPoints > 0 ? '+' : ''}${changeInPoints}`}
              </Text>
              <Text style={styles.statLabel}>
                {changeInPoints == null ? 'No earlier data' : 'Points vs previous period'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Done vs missed</Text>
          <View style={styles.chartCard}>
            <DoneMissedPie
              done={stats.completedDays}
              missed={stats.missedDays}
              color={taskColor}
              unit="days"
              explanation="A day with no entry counts as missed."
            />
          </View>

          <Text style={styles.sectionTitle}>Week by week</Text>
          <View style={styles.chartCard}>
            <BarChart
              data={weeklyData}
              barWidth={26}
              spacing={18}
              maxValue={100}
              noOfSections={4}
              height={150}
              yAxisLabelSuffix="%"
              xAxisLabelTextStyle={styles.chartAxisLabel}
              yAxisTextStyle={styles.chartAxisLabel}
              onPress={(_item: unknown, index: number) => {
                const week = stats.weeklyBreakdown[index];
                if (!week) return;
                setWeekSelection({
                  title: `${formatDayLabel(week.start)} – ${formatDayLabel(week.end)}`,
                  lines: [
                    `${week.completed} of ${week.total} days done (${week.percent}%)`,
                    `Missed ${week.total - week.completed} days.`,
                  ],
                });
              }}
            />
            <Text style={styles.chartNote}>
              Each bar is a 7-day block, labelled with the date it starts on.
            </Text>
            <ChartInfo
              placeholder="Tap a bar to see that week"
              title={weekSelection?.title}
              lines={weekSelection?.lines}
              accentColor={taskColor}
            />
          </View>

          <Text style={styles.sectionTitle}>Best days of the week</Text>
          <View style={styles.chartCard}>
            <BarChart
              data={weekdayData}
              barWidth={26}
              spacing={14}
              maxValue={100}
              noOfSections={4}
              height={150}
              yAxisLabelSuffix="%"
              xAxisLabelTextStyle={styles.chartAxisLabel}
              yAxisTextStyle={styles.chartAxisLabel}
              onPress={(_item: unknown, index: number) => {
                const bucket = stats.weekdayBreakdown[index];
                if (!bucket) return;
                setWeekdaySelection({
                  title: `${bucket.label}days`,
                  lines: [
                    `${bucket.completed} of ${bucket.total} done (${bucket.percent}%)`,
                    `${bucket.total} ${bucket.label}day${bucket.total === 1 ? '' : 's'} in this period.`,
                  ],
                });
              }}
            />
            {bestWeekday && worstWeekday && bestWeekday.label !== worstWeekday.label ? (
              <Text style={styles.chartNote}>
                Strongest on {bestWeekday.label}days ({bestWeekday.percent}%), weakest on{' '}
                {worstWeekday.label}days ({worstWeekday.percent}%).
              </Text>
            ) : null}
            <ChartInfo
              placeholder="Tap a bar for that weekday"
              title={weekdaySelection?.title}
              lines={weekdaySelection?.lines}
              accentColor={taskColor}
            />
          </View>

          {taskType === 'duration' ? (
            <>
              <Text style={styles.sectionTitle}>Duration</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats.totalMinutes}</Text>
                  <Text style={styles.statLabel}>Total minutes</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats.avgMinutesPerDay}</Text>
                  <Text style={styles.statLabel}>Avg min/day</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{stats.bestDayMinutes}</Text>
                  <Text style={styles.statLabel}>Best day</Text>
                </View>
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Day by day</Text>
          <HabitCalendar
            range={stats.effectiveRange}
            completedDates={stats.completedDates}
            color={taskColor}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  error: { color: '#dc2626', textAlign: 'center', padding: 16 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  emptyText: { color: '#999', lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 20 },
  headline: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  headlineValue: { fontSize: 40, fontWeight: '800' },
  headlineCaption: { fontSize: 14, color: '#333', marginTop: 4, textAlign: 'center' },
  headlineNote: { fontSize: 12, color: '#999', marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginHorizontal: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#4f46e5' },
  statValueSmall: { fontSize: 15 },
  statValueUp: { color: '#059669' },
  statValueDown: { color: '#dc2626' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2, textAlign: 'center' },
  chartCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 16,
  },
  chartAxisLabel: { fontSize: 10, color: '#666' },
  chartNote: { fontSize: 12, color: '#888', marginTop: 12, lineHeight: 17 },
});
