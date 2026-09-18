import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  // Shown when nothing has been tapped yet.
  placeholder: string;
  title?: string;
  lines?: string[];
  accentColor?: string;
}

// The readout that sits under every chart. Charts alone don't say what a
// bar or slice means, so tapping one fills this in with the plain numbers
// behind it.
export default function ChartInfo({ placeholder, title, lines, accentColor = '#4f46e5' }: Props) {
  if (!title) {
    return (
      <View style={[styles.container, styles.placeholderContainer]}>
        <Text style={styles.placeholder}>{placeholder}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: accentColor }]}>
      <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
      {(lines ?? []).map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  placeholderContainer: { borderColor: '#eee', backgroundColor: '#fafafa' },
  placeholder: { fontSize: 12, color: '#999', textAlign: 'center' },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  line: { fontSize: 13, color: '#444', lineHeight: 19 },
});
