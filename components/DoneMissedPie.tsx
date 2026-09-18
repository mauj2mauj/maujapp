import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import ChartInfo from './ChartInfo';

interface Props {
  title?: string;
  done: number;
  missed: number;
  color: string;
  // "days" on a single habit, "opportunities" when several habits are combined.
  unit: string;
  explanation: string;
}

type Slice = 'done' | 'missed';

export default function DoneMissedPie({
  title,
  done,
  missed,
  color,
  unit,
  explanation,
}: Props) {
  const [slice, setSlice] = useState<Slice | null>(null);
  const total = done + missed;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const missedPercent = total > 0 ? 100 - percent : 0;

  // A 0-value slice is omitted — gifted-charts can't press (or even draw) it,
  // and a 5% slice is too thin to hit in the browser anyway. Legend buttons
  // below are the reliable way to inspect either side.
  const pieData = [
    ...(done > 0 ? [{ value: done, color, onPress: () => setSlice('done') }] : []),
    ...(missed > 0 ? [{ value: missed, color: '#e5e7eb', onPress: () => setSlice('missed') }] : []),
  ];

  return (
    <View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.pieWrapper}>
        {pieData.length > 0 ? (
          <PieChart
            data={pieData}
            donut
            radius={82}
            innerRadius={54}
            extraRadius={12}
            focusOnPress
            onPress={(_item: unknown, index: number) => {
              // Index maps onto the slices we actually rendered, which skips
              // a 0-value side. The 5% slice is still tiny on web, so the
              // legend below is the real click target.
              if (done > 0 && missed > 0) setSlice(index === 0 ? 'done' : 'missed');
              else if (done > 0) setSlice('done');
              else setSlice('missed');
            }}
            centerLabelComponent={() => (
              <View style={styles.pieCenter}>
                <Text style={[styles.pieCenterValue, { color }]}>{percent}%</Text>
                <Text style={styles.pieCenterLabel}>done</Text>
              </View>
            )}
          />
        ) : null}
      </View>

      <Text style={styles.summary}>
        {percent}% — done on {done} of {total} {unit}, missed {missed}
      </Text>
      {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}

      <View style={styles.legend}>
        <TouchableOpacity
          style={[styles.legendButton, slice === 'done' && { borderColor: color }]}
          onPress={() => setSlice('done')}
        >
          <View style={[styles.legendSwatch, { backgroundColor: color }]} />
          <Text style={styles.legendText}>Done · {done}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.legendButton, slice === 'missed' && styles.legendButtonSelected]}
          onPress={() => setSlice('missed')}
        >
          <View style={[styles.legendSwatch, styles.missedSwatch]} />
          <Text style={styles.legendText}>Missed · {missed}</Text>
        </TouchableOpacity>
      </View>

      <ChartInfo
        placeholder="Tap Done or Missed above for that side"
        title={slice === 'done' ? 'Done' : slice === 'missed' ? 'Missed' : undefined}
        accentColor={slice === 'done' ? color : '#6b7280'}
        lines={
          slice === 'done'
            ? [
                `${percent}% — done on ${done} of ${total} ${unit}, missed ${missed}`,
                'These are the days the student marked complete.',
              ]
            : slice === 'missed'
              ? [
                  `${missedPercent}% — missed ${missed} of ${total} ${unit}`,
                  'Includes days with no entry at all.',
                ]
              : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pieWrapper: { alignItems: 'center' },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  pieCenter: { alignItems: 'center' },
  pieCenterValue: { fontSize: 22, fontWeight: '800' },
  pieCenterLabel: { fontSize: 12, color: '#888' },
  summary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 12,
  },
  explanation: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  legend: { flexDirection: 'row', marginTop: 14 },
  legendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  legendButtonSelected: { borderColor: '#6b7280' },
  legendSwatch: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  missedSwatch: { backgroundColor: '#e5e7eb' },
  legendText: { fontSize: 13, fontWeight: '600', color: '#333' },
});
