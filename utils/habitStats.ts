import type { TaskType } from '../types/database';
import type { LogWithTask } from './stats';
import { getLocalDateString } from './date';
import { clampRange, eachDay, rangeIsEmpty, type DateRange } from './dateRange';

export interface WeekdayBucket {
  weekday: number;
  label: string;
  completed: number;
  total: number;
  percent: number;
}

export interface WeekBucket {
  start: string;
  end: string;
  label: string;
  completed: number;
  total: number;
  percent: number;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface HabitStats {
  // The range actually measured, after clamping to the habit's start and
  // today — this is what the screen should label the numbers with, not the
  // range the user picked.
  effectiveRange: DateRange;
  isEmpty: boolean;
  totalDays: number;
  completedDays: number;
  missedDays: number;
  completionPercent: number;
  completedDates: Set<string>;
  // Most recent completed day inside the range, or null if there wasn't one.
  lastCompletedDate: string | null;
  // Seven entries, Sunday first — how the student does on each weekday.
  weekdayBreakdown: WeekdayBucket[];
  // The range chopped into 7-day buckets from its start, for the trend chart.
  weeklyBreakdown: WeekBucket[];
  // Duration-only extras — undefined for boolean habits.
  totalMinutes?: number;
  avgMinutesPerDay?: number;
  bestDayMinutes?: number;
}

// The first day a habit could actually have been logged by this student —
// whichever came later: the admin creating the task, or the student
// joining. Everything before this date is out of scope for stats (the
// habit simply didn't exist for this student yet).
export function getHabitStartDate(taskCreatedAt: string, studentJoinedAt: string): string {
  const taskDate = getLocalDateString(new Date(taskCreatedAt));
  const joinedDate = getLocalDateString(new Date(studentJoinedAt));
  return taskDate > joinedDate ? taskDate : joinedDate;
}

// Computes every stat shown for one student + habit within a date range.
// `logs` may contain entries for other tasks too — this filters down to
// `taskId` internally so callers can pass whatever they already fetched.
//
// The whole calculation walks the calendar day by day rather than walking
// the log rows, because a day with no row at all counts as missed. That's
// the app's model everywhere else (see getCellState), and doing it this way
// means streaks and percentages can't disagree with the calendar grid.
export function computeHabitStats(
  logs: LogWithTask[],
  taskId: string,
  taskType: TaskType,
  habitStartDate: string,
  requestedRange: DateRange
): HabitStats {
  const effectiveRange = clampRange(requestedRange, habitStartDate);
  const habitLogs = logs.filter((log) => log.task_id === taskId);

  const completedDates = new Set(
    habitLogs
      .filter(
        (log) =>
          log.completed && log.date >= effectiveRange.start && log.date <= effectiveRange.end
      )
      .map((log) => log.date)
  );

  if (rangeIsEmpty(effectiveRange)) {
    return {
      effectiveRange,
      isEmpty: true,
      totalDays: 0,
      completedDays: 0,
      missedDays: 0,
      completionPercent: 0,
      completedDates,
      lastCompletedDate: null,
      weekdayBreakdown: [],
      weeklyBreakdown: [],
      ...(taskType === 'duration'
        ? { totalMinutes: 0, avgMinutesPerDay: 0, bestDayMinutes: 0 }
        : {}),
    };
  }

  const days = eachDay(effectiveRange);
  const totalDays = days.length;
  const completedDays = completedDates.size;

  const weekdayCounts = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    completed: 0,
    total: 0,
    percent: 0,
  }));
  const weeklyBreakdown: WeekBucket[] = [];
  let lastCompletedDate: string | null = null;

  days.forEach((day, index) => {
    const done = completedDates.has(day);
    if (done) lastCompletedDate = day;

    const bucket = weekdayCounts[new Date(`${day}T00:00:00`).getDay()];
    bucket.total += 1;
    if (done) bucket.completed += 1;

    // Weeks are 7-day blocks counted from the start of the range rather
    // than calendar weeks, so the first bar is never a stub.
    if (index % 7 === 0) {
      weeklyBreakdown.push({ start: day, end: day, label: '', completed: 0, total: 0, percent: 0 });
    }
    const week = weeklyBreakdown[weeklyBreakdown.length - 1];
    week.end = day;
    week.total += 1;
    if (done) week.completed += 1;
  });

  for (const bucket of weekdayCounts) {
    bucket.percent = bucket.total > 0 ? Math.round((bucket.completed / bucket.total) * 100) : 0;
  }
  for (const week of weeklyBreakdown) {
    week.percent = week.total > 0 ? Math.round((week.completed / week.total) * 100) : 0;
    week.label = String(Number(week.start.slice(8)));
  }

  const stats: HabitStats = {
    effectiveRange,
    isEmpty: false,
    totalDays,
    completedDays,
    missedDays: totalDays - completedDays,
    completionPercent: Math.round((completedDays / totalDays) * 100),
    completedDates,
    lastCompletedDate,
    weekdayBreakdown: weekdayCounts,
    weeklyBreakdown,
  };

  if (taskType === 'duration') {
    const minutesInRange = habitLogs
      .filter((log) => log.date >= effectiveRange.start && log.date <= effectiveRange.end)
      .map((log) => log.duration_minutes ?? 0);
    const totalMinutes = minutesInRange.reduce((sum, minutes) => sum + minutes, 0);
    stats.totalMinutes = totalMinutes;
    stats.avgMinutesPerDay = Math.round(totalMinutes / totalDays);
    stats.bestDayMinutes = minutesInRange.length > 0 ? Math.max(...minutesInRange) : 0;
  }

  return stats;
}
