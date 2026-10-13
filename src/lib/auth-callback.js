// Parses what Supabase sends to /auth/callback. Plain module (browser and node tests).
//
// Accepted shapes:
//   ?code=<uuid>                      Google sign-in (PKCE; the verifier is in this browser)
//   ?token_hash=<hash>&type=<type>    the link in our login email (works on any device)
//   ?error=...&error_code=...         Supabase or Google reported a failure (query or #hash)
// Anything else is ignored. Text from the URL is never shown to the student: an attacker
// can craft it, so only fixed copy chosen by error code is displayed.

const EMAIL_LINK_TYPES = new Set(['email', 'magiclink', 'signup', 'invite', 'email_change']);
const CODE_RE = /^[A-Za-z0-9-]{8,128}$/;
const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{8,256}$/;

const ERROR_COPY = {
  access_denied: 'Google sign-in was cancelled. Go back to login to try again, or use the email code.',
  otp_expired: 'This login link has expired or was already used. Go back to login and ask for a new code.',
  flow_state_expired: 'Sign-in took too long to finish. Go back to login and start again.',
  flow_state_not_found: 'Sign-in has to finish in the same browser it started in. Go back to login and start again here.',
  bad_oauth_state: 'Sign-in has to finish in the same browser it started in. Go back to login and start again here.',
  bad_oauth_callback: 'Google sign-in could not be completed. Go back to login and try again.',
};
const GENERIC_ERROR = 'Sign-in did not finish. Go back to login and try again, or use the email code.';

function paramsFrom(raw, prefix) {
  const text = String(raw || '');
  return new URLSearchParams(text.startsWith(prefix) ? text.slice(prefix.length) : text);
}

export function readCallbackParams(search, hash = '') {
  const query = paramsFrom(search, '?');
  const fragment = paramsFrom(hash, '#');
  const errorCode = query.get('error_code') || fragment.get('error_code') || query.get('error') || fragment.get('error');
  if (errorCode) {
    return { kind: 'error', code: errorCode, message: ERROR_COPY[errorCode] || GENERIC_ERROR };
  }

  const tokenHash = query.get('token_hash');
  const type = query.get('type');
  if (tokenHash || type) {
    if (!tokenHash || !TOKEN_HASH_RE.test(tokenHash) || !EMAIL_LINK_TYPES.has(type)) {
      return { kind: 'error', code: 'invalid_link', message: ERROR_COPY.otp_expired };
    }
    return { kind: 'token_hash', tokenHash, type };
  }

  const code = query.get('code');
  if (code) {
    if (!CODE_RE.test(code)) return { kind: 'error', code: 'invalid_code', message: GENERIC_ERROR };
    return { kind: 'code', code };
  }

  return { kind: 'none' };
}
