import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// The app's masthead, shown above the contextual header on both the Student
// and Admin screens so the branding is identical either side of the login.
export default function BrandHeader() {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.punjabi}>ਮੌਜ</Text>
        <Text style={styles.separator}> | </Text>
        <Text style={styles.english}>MAUJ</Text>
      </View>
      <Text style={styles.tagline}>My Att Uttam Journey</Text>
      <Text style={styles.habitsLine}>8 Atomic Habits</Text>
      <Text style={styles.habitsSubline}>Just 30 mins per day</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  punjabi: {
    fontSize: 42,
    fontWeight: '400',
    color: '#4f46e5',
    lineHeight: 64,
    paddingTop: 4,
  },
  separator: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4f46e5',
    lineHeight: 64,
  },
  english: {
    fontSize: 30,
    fontWeight: '800',
    color: '#4f46e5',
    letterSpacing: 1,
    lineHeight: 64,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },
  habitsLine: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginTop: 10,
    textAlign: 'center',
  },
  habitsSubline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginTop: 2,
    textAlign: 'center',
  },
});
