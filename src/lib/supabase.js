import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Admin client — uses the service_role key.
 * Bypasses RLS; only import from server-only modules (route handlers, auth.js, data/db.js).
 * Lazy-initialized so `next build` can run without env vars set.
 */
let _admin = null;

export function supabaseAdmin() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }

  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  return _admin;
}

// Phase 1 compatibility: route handlers import { supabase } from '@/lib/supabase'.
// This proxy forwards every property access to the lazy admin client so the
// singleton is still only created on first request, not at module-load / build time.
export const supabase = new Proxy(/** @type {any} */({}), {
  get(_, prop) {
    return supabaseAdmin()[prop];
  },
});
