import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './contexts/AuthContext';
import RootNavigator from './navigation/RootNavigator';
import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>MAUJ isn’t configured</Text>
        <Text style={styles.body}>
          This install was built without Supabase keys. Rebuild the APK after adding
          EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the EAS preview
          environment.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#07072e',
  },
  title: { color: '#f97316', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  body: { color: '#eee', fontSize: 15, lineHeight: 22, textAlign: 'center' },
});

