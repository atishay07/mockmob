// End-to-end check of the app endpoints against the local site running on STAGING
// (`node scripts/pipeline/tools/stagingLocalApp.mjs`, port 3101), signed in as a staging test student
// with a bearer token, exactly like the Android app. Writes only to that test account on staging.
// Usage: node --use-system-ca scripts/dev/staging-app-api-check.mjs
import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';

loadEnvFile('.env.staging');
const target = 'https://onwkqxmjqjrhfbjjdydu.supabase.co';
if (process.env.STAGING_SUPABASE_URL !== target) throw Error('wrong_staging_project');
const base = process.env.APP_CHECK_BASE || 'http://localhost:3101';
const EMAIL = 'app-e2e-student@example.com';

const admin = createClient(target, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(target, process.env.STAGING_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function bearerFor(email) {
  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) throw link.error;
  }
  const { data, error } = await anon.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: link.data.properties.verification_type });
  if (error) throw error;
  return data.session.access_token;
}

const results = [];
async function call(name, method, path, { token, body, expect = 200 } = {}) {
  const started = Date.now();
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  const pass = Array.isArray(expect) ? expect.includes(response.status) : response.status === expect;
  results.push({ name, status: response.status, pass, ms: Date.now() - started, ...(pass ? {} : { body: json }) });
  return { status: response.status, json };
}

const token = await bearerFor(EMAIL);
const me = (await call('auth/me with bearer', 'GET', '/api/auth/me', { token })).json;
const userId = me?.user?.id || me?.id;
assert.ok(userId, 'no user id from /api/auth/me');

// Security: a student cannot grant themselves Pro or a role.
await call('profile rejects forged entitlement', 'PATCH', `/api/users/${userId}`, { token, body: { isPremium: true, role: 'admin' }, expect: 400 });
await call('profile accepts subjects', 'PATCH', `/api/users/${userId}`, { token, body: { subjects: ['accountancy', 'english'] } });
const after = (await call('auth/me after profile', 'GET', '/api/auth/me', { token })).json;
assert.notEqual(after?.user?.isPremium, true, 'forged premium must not stick');

// Consent (D183, 20 Oct 2026): under 18 stays off; 18 or older and "Rather not say" (unknown) can have usage data on; withdrawal deletes events.
// The unknown step needs supabase/migrations/20261020160000_usage_consent_d183.sql applied on the project being checked.
await call('consent default', 'GET', '/api/me/consent', { token });
await call('consent refuses analytics for under 18', 'PUT', '/api/me/consent', { token, body: { ageBand: 'minor', analyticsAllowed: true }, expect: 400 });
await call('consent accepts analytics for rather not say', 'PUT', '/api/me/consent', { token, body: { ageBand: 'unknown', analyticsAllowed: true } });
await call('consent adult opt-in', 'PUT', '/api/me/consent', { token, body: { ageBand: 'adult', analyticsAllowed: true } });
const ev = (n) => ({ event_id: `e2e-${Date.now()}-${n}`, name: 'app_opened', platform: 'android', app_version: '1.0.0', occurred_at: new Date().toISOString(), props: { screen: 'today' } });
const sent = await call('events accepted for consenting adult', 'POST', '/api/events', { token, body: { events: [ev(1), ev(2)] }, expect: 202 });
assert.equal(sent.json.collecting, true);
const withdrawn = await call('consent withdrawal', 'PUT', '/api/me/consent', { token, body: { ageBand: 'adult', analyticsAllowed: false } });
assert.ok(withdrawn.json.deletedEvents >= 2, 'withdrawal should delete collected events');
const dropped = await call('events dropped after withdrawal', 'POST', '/api/events', { token, body: { events: [ev(3)] }, expect: 202 });
assert.equal(dropped.json.collecting, false);

// Preferences, goal and rhythm.
await call('notification prefs default', 'GET', '/api/me/notification-prefs', { token });
await call('notification prefs save', 'PUT', '/api/me/notification-prefs', { token, body: { quietStart: '23:00', quietEnd: '07:00', timezone: 'Asia/Kolkata' } });
await call('goal save', 'PUT', '/api/me/goal', { token, body: { daysPerWeek: 4 } });
await call('goal read', 'GET', '/api/me/goal', { token });
await call('rhythm', 'GET', '/api/me/rhythm', { token });

// Results, record, bests, sample import.
await call('attempts summary', 'GET', '/api/attempts/summary?limit=5', { token });
await call('repair record', 'GET', '/api/me/repair-record', { token });
const credits = await call('credits and history', 'GET', '/api/me/credits', { token });
assert.deepEqual(Object.keys(credits.json), ['practice', 'ai', 'plan', 'history', 'nextCursor']);
await call('credits without a bearer is rejected', 'GET', '/api/me/credits', { expect: 401 });
await call('bests', 'GET', '/api/me/bests', { token });
const importKey = `e2e_sample_${Date.now()}`;
const sample = { importKey, sampleVersion: 'landing-v1', subject: 'accountancy', answers: ['B', 'B', 'C', 'A', 'B'].map((optionKey, i) => ({ sampleQuestionId: `q${i + 1}`, optionKey })) };
const firstImport = await call('sample import', 'POST', '/api/me/sample-import', { token, body: sample, expect: [200, 201] });
const secondImport = await call('sample import is idempotent', 'POST', '/api/me/sample-import', { token, body: sample, expect: [200, 201] });
assert.equal(firstImport.json.correct, 4);
assert.equal(secondImport.json.savedAt, firstImport.json.savedAt);

// Plan, quote and practice check gate.
await call('learning plan', 'GET', '/api/learning/plan?minutes=10', { token });
await call('practice quote', 'GET', '/api/practice/quote?subject=accountancy&mode=quick&count=10', { token });
await call('practice check is off until enabled', 'POST', '/api/sessions/att_practice_missing/check', { token, body: { qid: 'q1', answer: 0 }, expect: [403, 404] });
await call('no bearer is rejected', 'GET', '/api/me/rhythm', { expect: 401 });

for (const r of results) console.log(`${r.pass ? 'pass' : 'FAIL'}  ${String(r.status).padEnd(3)}  ${String(r.ms).padStart(5)} ms  ${r.name}${r.pass ? '' : `  ${JSON.stringify(r.body).slice(0, 300)}`}`);
const failed = results.filter(r => !r.pass).length;
console.log(`${results.length - failed} of ${results.length} checks passed against ${base} (staging).`);
process.exit(failed ? 1 : 0);
