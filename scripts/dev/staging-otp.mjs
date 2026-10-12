// Development helper: print a one-time sign-in code for a STAGING test account, so the Android
// app can be exercised against `npm run factory:staging-app` without sending email.
// Refuses to run against any project other than the staging one used by stagingLocalApp.mjs.
// Usage: node scripts/dev/staging-otp.mjs test-student@example.com
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';

loadEnvFile('.env.staging');
const target = 'https://onwkqxmjqjrhfbjjdydu.supabase.co';
if (process.env.STAGING_SUPABASE_URL !== target) throw Error('wrong_staging_project');
const email = process.argv[2];
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Error('usage: node scripts/dev/staging-otp.mjs <email>');

const admin = createClient(target, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (error) throw Error(`generateLink failed: ${error.message}`);
console.log(`staging sign-in code for ${email}: ${data.properties?.email_otp}`);
