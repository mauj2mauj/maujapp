import * as Linking from 'expo-linking';

// Built when the reset email is sent, so it matches this Expo Go session
// (exp://your-computer:8081/--/reset-password). In Supabase → Authentication
// → URL Configuration → Redirect URLs, add: exp://**
export function getPasswordResetRedirect(): string {
  return Linking.createURL('reset-password');
}

export function isPasswordResetUrl(url: string | null): boolean {
  return Boolean(url && url.includes('reset-password'));
}

export function readRecoveryParams(url: string): {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
} {
  const cut = url.includes('#')
    ? url.slice(url.indexOf('#') + 1)
    : url.includes('?')
      ? url.slice(url.indexOf('?') + 1)
      : '';
  const params = new URLSearchParams(cut);
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    code: params.get('code'),
  };
}
