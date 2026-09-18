import { getLocalDateString } from './date';

// A closed interval of local calendar dates, both ends inclusive, in
// "YYYY-MM-DD" form — the same shape daily_logs.date uses, so ranges can be
// compared against log dates with plain string comparison.
export interface DateRange {
  start: string;
  end: string;
}

export type RangePresetKey =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'all_time'
  | 'custom';

export const RANGE_PRESETS: { key: RangePresetKey; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'last_6_months', label: 'Last 6 months' },
  { key: 'all_time', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

// Months are identified by a "YYYY-MM" key throughout this module.
export function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function firstDayOfMonth(monthKey: string): string {
  return `${monthKey}-01`;
}

export function lastDayOfMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  // Day 0 of the *next* month is the last day of this one, which also gets
  // leap years right without any special casing.
  return getLocalDateString(new Date(year, month, 0));
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  return monthKeyOf(getLocalDateString(new Date(year, month - 1 + delta, 1)));
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

export function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRangeLabel(range: DateRange): string {
  if (range.start === range.end) return formatDayLabel(range.start);
  return `${formatDayLabel(range.start)} – ${formatDayLabel(range.end)}`;
}

// Presets are calendar-based, not rolling: "Last 3 months" means from the
// 1st of the month two months back through today, so the buckets line up
// with how people talk about months.
export function getPresetRange(preset: RangePresetKey, allTimeStart: string): DateRange {
  const today = getLocalDateString();
  const thisMonth = monthKeyOf(today);

  switch (preset) {
    case 'last_month': {
      const previous = shiftMonth(thisMonth, -1);
      return { start: firstDayOfMonth(previous), end: lastDayOfMonth(previous) };
    }
    case 'last_3_months':
      return { start: firstDayOfMonth(shiftMonth(thisMonth, -2)), end: today };
    case 'last_6_months':
      return { start: firstDayOfMonth(shiftMonth(thisMonth, -5)), end: today };
    case 'all_time':
      return { start: allTimeStart, end: today };
    case 'this_month':
    case 'custom':
    default:
      return { start: firstDayOfMonth(thisMonth), end: today };
  }
}

export function getCustomRange(fromMonth: string, toMonth: string): DateRange {
  // Tolerates the two dropdowns being set "backwards".
  const [earlier, later] = fromMonth <= toMonth ? [fromMonth, toMonth] : [toMonth, fromMonth];
  return { start: firstDayOfMonth(earlier), end: lastDayOfMonth(later) };
}

// Trims a requested range to the days that can actually hold data: nothing
// before the habit existed for this student, nothing after today. Without
// this, picking "Last 6 months" for a habit created last week would divide
// by 180 days and report a near-zero completion rate.
export function clampRange(range: DateRange, earliestPossible: string): DateRange {
  const today = getLocalDateString();
  return {
    start: range.start > earliestPossible ? range.start : earliestPossible,
    end: range.end < today ? range.end : today,
  };
}

export function rangeIsEmpty(range: DateRange): boolean {
  return range.start > range.end;
}

// Every month from `earliest` through the current month, newest first —
// this is what the Custom range dropdowns list.
export function buildMonthOptions(earliestDate: string): string[] {
  const months: string[] = [];
  const currentMonth = monthKeyOf(getLocalDateString());
  let cursor = monthKeyOf(earliestDate);

  while (cursor <= currentMonth) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }

  return months.reverse();
}

// The equally-long stretch immediately before `range` — used to answer
// "is this student doing better or worse than last period?".
export function previousRangeOf(range: DateRange): DateRange {
  const length = eachDay(range).length;
  const end = new Date(`${range.start}T00:00:00`);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (length - 1));
  return { start: getLocalDateString(start), end: getLocalDateString(end) };
}

// Inclusive list of every date in the range, oldest first.
export function eachDay(range: DateRange): string[] {
  const days: string[] = [];
  if (rangeIsEmpty(range)) return days;

  const cursor = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  while (cursor.getTime() <= end.getTime()) {
    days.push(getLocalDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Every month key touched by the range, oldest first.
export function eachMonth(range: DateRange): string[] {
  const months: string[] = [];
  if (rangeIsEmpty(range)) return months;

  let cursor = monthKeyOf(range.start);
  const last = monthKeyOf(range.end);
  while (cursor <= last) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}
