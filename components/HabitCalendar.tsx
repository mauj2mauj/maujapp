import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { eachMonth, firstDayOfMonth, formatMonthLabel, type DateRange } from '../utils/dateRange';
import { getLocalDateString } from '../utils/date';

interface Props {
  range: DateRange;
  completedDates: Set<string>;
  // The habit's colour, used for completed days so the calendar matches
  // the colour code the admin assigned.
  color: string;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_SIZE = 34;
const CELL_GAP = 4;

// One grid per calendar month in the range. Days inside the range read as
// done (habit colour) or missed (grey); days outside it — before the habit
// existed, after today, or simply not in the selected period — are drawn
// as empty outlines so they can't be mistaken for misses.
export default function HabitCalendar({ range, completedDates, color }: Props) {
  const months = eachMonth(range);
  const today = getLocalDateString();

  if (months.length === 0) {
    return null;
  }

  return (
    <View>
      {months.map((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const leadingBlanks = new Date(`${firstDayOfMonth(monthKey)}T00:00:00`).getDay();
        const cells: (string | null)[] = [
          ...Array<null>(leadingBlanks).fill(null),
          ...Array.from({ length: daysInMonth }, (_, index) =>
            `${monthKey}-${String(index + 1).padStart(2, '0')}`
          ),
        ];
        while (cells.length % 7 !== 0) cells.push(null);

        const weeks: (string | null)[][] = [];
        for (let index = 0; index < cells.length; index += 7) {
          weeks.push(cells.slice(index, index + 7));
        }

        return (
          <View key={monthKey} style={styles.month}>
            <Text style={styles.monthLabel}>{formatMonthLabel(monthKey)}</Text>

            <View style={styles.weekRow}>
              {WEEKDAY_LABELS.map((label, index) => (
                <View key={`${label}-${index}`} style={styles.cellSlot}>
                  <Text style={styles.weekdayLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {week.map((date, dayIndex) => {
                  if (!date) {
                    return <View key={`blank-${dayIndex}`} style={styles.cellSlot} />;
                  }

                  const inRange = date >= range.start && date <= range.end && date <= today;
                  const done = inRange && completedDates.has(date);

                  return (
                    <View key={date} style={styles.cellSlot}>
                      <View
                        style={[
                          styles.cell,
                          !inRange && styles.cellOutside,
                          inRange && !done && styles.cellMissed,
                          done && { backgroundColor: color },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            done && styles.cellTextDone,
                            !inRange && styles.cellTextOutside,
                          ]}
                        >
                          {Number(date.slice(8))}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: color }]} />
          <Text style={styles.legendText}>Done</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.cellMissed]} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.cellOutside]} />
          <Text style={styles.legendText}>Not tracked</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  month: { marginBottom: 20 },
  monthLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  weekRow: { flexDirection: 'row', marginBottom: CELL_GAP },
  cellSlot: { width: CELL_SIZE, marginRight: CELL_GAP, alignItems: 'center' },
  weekdayLabel: { fontSize: 11, color: '#999', fontWeight: '600' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellMissed: { backgroundColor: '#e5e7eb' },
  cellOutside: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f0f0' },
  cellText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  cellTextDone: { color: '#fff' },
  cellTextOutside: { color: '#d1d5db' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, color: '#666' },
});
