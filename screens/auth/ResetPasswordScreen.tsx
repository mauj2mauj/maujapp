import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandHeader from '../../components/BrandHeader';
import PasswordField from '../../components/PasswordField';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordScreen() {
  const { clearPasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    clearPasswordRecovery();
  };

  const handleCancel = async () => {
    await signOut();
    clearPasswordRecovery();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BrandHeader />
        <Text style={styles.subtitle}>Choose a new password</Text>
        <PasswordField
          style={styles.input}
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
        />
        <PasswordField
          style={styles.input}
          placeholder="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save password</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.link}>Cancel</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
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
