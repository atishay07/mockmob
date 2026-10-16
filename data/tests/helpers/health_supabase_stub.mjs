// Stands in for src/lib/supabase.js in the health tests: every supabaseAdmin() is the in-memory fake.
import { fakeClient } from './health_supabase_fake.mjs';
export const supabaseAdmin = () => fakeClient;
export const supabase = fakeClient;
