import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  referralSource: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
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
      value={{ session, profile, loading, profileError, signIn, signUp, signOut }}
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
