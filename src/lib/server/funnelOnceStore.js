import 'server-only';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createStepCounter } from '@/lib/server/funnelOnce';

// Counts in-product steps for a signed-in user, once per user per step. Fire-and-forget: returns nothing,
// never throws, never waits (the work runs through after(), once the response has gone out) and does
// nothing unless FUNNEL_ENABLED is exactly "true". Usage, from any route or server component:
//   countStepOnce(session.user.id, 'first_repair', request.headers);
// steps may be one name or an array. headers is the Headers of the request (for the platform category and
// Do Not Track / Global Privacy Control), or null. The rules and the once-per-user claim are in
// createStepCounter (src/lib/server/funnelOnce.js) and funnel_count_once (migration 20261016120000).
export const countStepOnce = createStepCounter({
  rpc: (name, args) => supabaseAdmin().rpc(name, args),
  schedule: after,
  warn: (message, code) => console.warn(message, code),
});
