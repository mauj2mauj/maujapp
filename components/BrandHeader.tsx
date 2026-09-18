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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  punjabi: {
    fontSize: 42,
    fontWeight: '800',
    color: '#4f46e5',
    lineHeight: 50,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  separator: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4f46e5',
    lineHeight: 50,
    includeFontPadding: false,
  },
  english: {
    fontSize: 30,
    fontWeight: '800',
    color: '#4f46e5',
    letterSpacing: 1,
    lineHeight: 50,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
});
