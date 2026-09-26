// The email link opens the installed Android app. Add this exact URL under
// Supabase → Authentication → URL Configuration → Redirect URLs.
export const PASSWORD_RESET_REDIRECT = 'mauj://reset-password';

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
