import React, { createContext, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { isPasswordResetUrl, readRecoveryParams } from '../lib/passwordReset';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  schoolId: string | null;
  otherSchool: string;
  referrerId: string | null;
  referralSource: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Starts true: on app launch we don't yet know if a session exists in
  // AsyncStorage, so we show a spinner until getSession() resolves.
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const consumeUrl = async (url: string | null) => {
      if (!isPasswordResetUrl(url) || !url) return;
      setPasswordRecovery(true);
      const { accessToken, refreshToken, code } = readRecoveryParams(url);
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : accessToken && refreshToken
          ? await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
          : { error: new Error('This reset link is missing a session.') };
      if (!cancelled && error) setPasswordRecovery(false);
    };

    Linking.getInitialURL().then((url) => {
      if (!cancelled) consumeUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      consumeUrl(url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    // Fires on sign in, sign out, and token refresh — keeps `session` in
    // sync no matter where in the app the auth state changes.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Whenever we get a session (fresh login or app relaunch), fetch the
  // matching profiles row so we know the user's role.
  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    setLoading(true);
    setProfileError(null);

    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setProfile(null);
          setProfileError(error.message);
        } else {
          setProfile(data as Profile);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signUp: AuthContextValue['signUp'] = async ({
    email,
    password,
    firstName,
    lastName,
    phone,
    schoolId,
    otherSchool,
    referrerId,
    referralSource,
  }) => {
    // The `data` object here becomes `raw_user_meta_data` on the new
    // auth.users row, which our Postgres trigger (handle_new_user) reads.
    // We deliberately don't send a role — the trigger decides it from the
    // server-side admin_allowlist / invitations tables, so a hand-crafted
    // signUp() call can't mint itself an admin account.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
          school_id: schoolId,
          other_school: otherSchool,
          referrer_id: referrerId,
          referral_source: referralSource,
        },
      },
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        profileError,
        passwordRecovery,
        clearPasswordRecovery: () => setPasswordRecovery(false),
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
