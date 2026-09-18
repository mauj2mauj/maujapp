import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/RootNavigator';
import BrandHeader from '../../components/BrandHeader';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

// Accepts an optional leading + and 10-15 digits, which covers Indian
// 10-digit numbers as well as anything written in full international form.
const PHONE_REGEX = /^\+?\d{10,15}$/;

export default function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Spaces, dashes and brackets are how people naturally type a number;
  // strip them before validating and before storing.
  const normalizedPhone = phone.replace(/[\s\-()]/g, '');

  const handleSignUp = async () => {
    setError(null);
    if (!firstName || !lastName || !email || !phone || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (!PHONE_REGEX.test(normalizedPhone)) {
      setError('Enter a valid phone number (10-15 digits).');
      return;
    }
    if (!referralSource.trim()) {
      setError('Please tell us how you heard about Mauj.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    const { data: mayRegister, error: checkError } = await supabase.rpc(
      'check_pending_invitation',
      { check_email: email.trim() }
    );
    if (checkError) {
      setSubmitting(false);
      setError('Could not verify invitation. Please try again.');
      return;
    }
    if (!mayRegister) {
      setSubmitting(false);
      setError('No invitation found for this email. Ask your admin to invite you first.');
      return;
    }

    const { error: signUpError } = await signUp({
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: normalizedPhone,
      referralSource: referralSource.trim(),
    });
    setSubmitting(false);
    if (signUpError) setError(signUpError);
    // On success, AuthContext picks up the new session automatically and
    // RootNavigator routes to the right screen — no manual navigation here.
  };

  return (
    <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <BrandHeader />
        <Text style={styles.subtitle}>Create account</Text>

        <Text style={styles.hint}>
          You can only register with an email your admin has already invited.
        </Text>

        {/* autoComplete matters on web: without an explicit hint the browser's
            saved-credential autofill guesses, and drops the email into
            whichever text box it sees first. */}
        <TextInput
          style={styles.input}
          placeholder="First Name"
          placeholderTextColor="#999"
          autoComplete="given-name"
          textContentType="givenName"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          placeholderTextColor="#999"
          autoComplete="family-name"
          textContentType="familyName"
          value={lastName}
          onChangeText={setLastName}
        />
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
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>How did you hear about Mauj?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. friend, Instagram, school"
          placeholderTextColor="#999"
          autoComplete="off"
          value={referralSource}
          onChangeText={setReferralSource}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.link}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 24, paddingTop: 12, flexGrow: 1 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20, marginTop: 4 },
  hint: { color: '#666', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4, marginBottom: 8 },
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
