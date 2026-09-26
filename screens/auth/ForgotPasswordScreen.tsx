import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import BrandHeader from '../../components/BrandHeader';
import { PASSWORD_RESET_REDIRECT } from '../../lib/passwordReset';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter the email you used to sign up.');
      return;
    }
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: PASSWORD_RESET_REDIRECT,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BrandHeader />
        <Text style={styles.subtitle}>Reset your password</Text>
        {sent ? (
          <Text style={styles.sent}>A reset link has been sent to your email.</Text>
        ) : (
          <>
            <Text style={styles.hint}>Enter the email you used to sign up.</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleSend} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send reset link</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.link}>Back to Sign In</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20, marginTop: 8 },
  hint: { color: '#666', fontSize: 13, marginBottom: 16, textAlign: 'center', lineHeight: 18 },
  sent: { color: '#059669', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    color: '#111',
  },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 12, textAlign: 'center' },
  link: { color: '#4f46e5', textAlign: 'center', marginTop: 16 },
});
