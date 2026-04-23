#!/usr/bin/env node
/**
 * MockMob — seed script.
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Reads env from .env.local. Applies 0001_init + 0002_rls migrations, then
 * upserts the seed question bank (18 MCQs across 6 CUET subjects) and ports
 * any existing users from data/db.json so nothing is lost.
 *
 * Idempotent: re-running won't duplicate rows.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---- load .env.local ----
function loadEnv() {
  const p = join(ROOT, '.env.local');
  if (!existsSync(p)) return;
  const lines = readFileSync(p, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('\n✗ Missing env: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('  Fill them in .env.local first.\n');
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Dynamic import so we can pull ESM seed data (questions.js uses `export const`).
const { SEED_QUESTIONS } = await import(join(ROOT, 'data/questions.js'));
const { SUBJECTS } = await import(join(ROOT, 'data/subjects.js'));

// ---- legacy JSON (for preserving Atishay + any accumulated users) ----
const legacyPath = join(ROOT, 'data/db.json');
const legacy = existsSync(legacyPath)
  ? JSON.parse(readFileSync(legacyPath, 'utf-8'))
  : { users: [], attempts: [], pending: [] };

// =====================================================================
// 1) Preflight — make sure the tables exist.
// =====================================================================
async function preflight() {
  const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' });
  if (error) {
    console.error('\n✗ Supabase preflight failed — tables likely missing.');
    console.error('  Run the SQL migrations first:');
    console.error('    • supabase/migrations/0001_init.sql');
    console.error('    • supabase/migrations/0002_rls.sql');
    console.error('  (Dashboard → SQL Editor → paste → Run)\n');
    console.error('  Driver error:', error.message);
    process.exit(2);
  }
}

// =====================================================================
// 2) Upsert users from legacy db.json.
// =====================================================================
async function seedUsers() {
  if (!legacy.users?.length) {
    console.log('• users: no legacy users to port');
    return;
  }
  const rows = legacy.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    subjects: u.subjects || [],
    role: u.role || 'student',
    created_at: new Date(u.createdAt || Date.now()).toISOString(),
  }));
  const { error } = await supabase.from('users').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`✓ users: upserted ${rows.length}`);
}

// =====================================================================
// 3) Upsert the 18 live seed questions.
// =====================================================================
async function seedQuestions() {
  const rows = SEED_QUESTIONS.map(q => ({
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    question: q.question,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation || null,
    difficulty: q.difficulty || null,
    source: q.source || null,
    status: 'live',
    uploaded_by: q.uploadedBy || 'MockMob',
  }));
  const { error } = await supabase.from('questions').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`✓ questions: upserted ${rows.length} (status='live')`);
}

// =====================================================================
// 4) Port legacy pending questions (if any).
// =====================================================================
async function seedPending() {
  if (!legacy.pending?.length) return;
  const rows = legacy.pending.map(q => ({
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    question: q.question,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation || null,
    difficulty: q.difficulty || null,
    source: q.source || null,
    status: 'pending',
    uploaded_by: q.uploadedBy || null,
  }));
  const { error } = await supabase.from('questions').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`✓ pending questions: upserted ${rows.length}`);
}

// =====================================================================
// 5) Port legacy attempts (if any).
// =====================================================================
async function seedAttempts() {
  if (!legacy.attempts?.length) return;
  const rows = legacy.attempts.map(a => ({
    id: a.id,
    user_id: a.userId,
    subject: a.subject,
    score: a.score,
    correct: a.correct,
    wrong: a.wrong,
    unattempted: a.unattempted,
    total: a.total,
    details: a.details || [],
    questions_snapshot: a.questionsSnapshot || [],
    completed_at: new Date(a.completedAt || Date.now()).toISOString(),
  }));
  const { error } = await supabase.from('attempts').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`✓ attempts: upserted ${rows.length}`);
}

// =====================================================================
// 6) Seed chapters (no-op if the migration hasn't been applied yet).
// =====================================================================
async function seedChapters() {
  const rows = SUBJECTS.flatMap(s =>
    (s.chapters || []).map((name, i) => ({
      id: `${s.id}__${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      subject_id: s.id,
      name,
      sort_order: i,
    })),
  );
  if (!rows.length) return;
  const { error } = await supabase.from('chapters').upsert(rows, { onConflict: 'id' });
  if (error) {
    // Table missing = migration 0003 not applied yet. Non-fatal.
    if (error.code === '42P01' || /chapters/.test(error.message || '')) {
      console.log('• chapters: skipped (table missing — apply supabase/migrations/0003_chapters.sql then re-run)');
      return;
    }
    throw error;
  }
  console.log(`✓ chapters: upserted ${rows.length}`);
}

// =====================================================================
await preflight();
await seedUsers();
await seedChapters();
await seedQuestions();
await seedPending();
await seedAttempts();

console.log('\n✓ Seed complete.\n');
