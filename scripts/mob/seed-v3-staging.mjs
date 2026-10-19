// Mob v3 heavy world on STAGING (onwkqxmjqjrhfbjjdydu) for the emulator walk. Idempotent, staging only.
//
//   node --use-system-ca scripts/mob/seed-v3-staging.mjs            seed if missing or stale; otherwise just verify
//   node --use-system-ca scripts/mob/seed-v3-staging.mjs --force    rebuild the Mob from scratch
//   node --use-system-ca scripts/mob/seed-v3-staging.mjs --check    verify only, write nothing
//
// Needs .env.staging in the repo root (STAGING_SUPABASE_URL, _ANON_KEY, _SERVICE_ROLE_KEY) and the Mob v3 staging site
// answering on SEED_SITE (default http://localhost:3105): the site creates each student's account row on first
// bearer call, and the final check reads the world back through the same API the app uses.
//
// Refuses to run unless the Supabase URL is the staging project and the keys are staging JWTs.
//
// WHAT IT BUILDS
//   Students (all @example.com): chai-riya (owner), chai-kabir, chai-zoya, chai-dev, plus chai-fresh (subjects chosen,
//   no Mob, for the first-time-student walk).
//   Mob "Chai Circle" (Accountancy, name key 0, podium on), 4 members, seat Folds dart / dogear / hexa / kandil.
//   Two closed Sprints with runs (the first has the trap, "most of you" on question 2), one open Sprint with two
//   finished runs (Riya and Dev have not played it), this week's quest at 51 of 60, a 3-week Mob chain (the three weeks
//   before this one, each done and settled), personal chains (Riya 13 days with a rest pass used and one held, Kabir 6,
//   Zoya 2), and Hop not owned (the quest completes during the walk, so the Hop reveal can be walked).
//
// HOW IT WRITES
//   Through the real service (src/lib/server/mob/service.js and games.js) wired to the real SQL functions, with a fake
//   clock passed as p_now so closed games, past weeks and answer times are consistent: create, invite, join, settings,
//   openGame, startRun, answer, sticker, and the trap settle (ensureSettled on read).
//   DIRECT WRITES (no function exists), all service role, all on staging:
//     - the students: Supabase auth user via generateLink, the account row via the site's GET /api/auth/me,
//       name and subjects via the site's PATCH /api/users/:id;
//     - the three settled past weeks: rpc mob_quest_tick (source 'paper', the call mob_record_sitting itself makes)
//       and mob_quest_week, because no real paper sittings exist for past weeks;
//     - this week's quest top-up to exactly 51: rpc mob_quest_tick with sources 'paper' and 'extra' (same reason);
//     - personal-chain days: perfect 5-question quick attempts in table attempts, ids att_seed_mobv3_*, built from a
//       real accountancy attempt's questions (the chain counts answered questions per IST day from attempts and games);
//     - reset (--force or a stale world): DELETE of the seed Mob (cascades) and of the seed students' rows in
//       fold_unlocks, mob_profiles, mob_seen, mob_start_claims, chain_prefs, chain_pauses and their att_seed_mobv3_* attempts.
// It never touches any other account, Mob or table row, never sets a password and never sends mail.

import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(ROOT);
const { createMobService } = await import('../../src/lib/server/mob/service.js');
const { mobWeek } = await import('../../src/lib/mob/model.mjs');

// ------------------------------------------------------------------------------------------------ staging guard
const STAGING_REF = 'onwkqxmjqjrhfbjjdydu';
const PROD_REF = 'isrxrxzjocewrdureyhp';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
loadEnvFile('.env.staging');
if (process.env.STAGING_SUPABASE_URL !== STAGING_URL) throw new Error('refused: STAGING_SUPABASE_URL is not the staging project');
for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string' && v.includes(PROD_REF)) throw new Error(`refused: ${k} mentions the production project`);
const jwtRef = (v) => { try { return JSON.parse(Buffer.from(String(v).split('.')[1], 'base64url').toString()).ref; } catch { return null; } };
const SERVICE_KEY = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY;
if (jwtRef(SERVICE_KEY) !== STAGING_REF || jwtRef(ANON_KEY) !== STAGING_REF) throw new Error('refused: the service or anon key is not a staging key');
const SITE = process.env.SEED_SITE || 'http://localhost:3105';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(SITE)) throw new Error('refused: SEED_SITE must be a local site');

const admin = createClient(STAGING_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(STAGING_URL, ANON_KEY, { auth: { persistSession: false } });
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const CHECK_ONLY = args.has('--check');

// ------------------------------------------------------------------------------------------------ the cast
const SUBJECTS = ['accountancy', 'english', 'economics', 'business_studies'];
const CAST = {
  riya: { email: 'chai-riya@example.com', name: 'Riya', colour: 3, fold: 'dart' },
  kabir: { email: 'chai-kabir@example.com', name: 'Kabir', colour: 1, fold: 'dogear' },
  zoya: { email: 'chai-zoya@example.com', name: 'Zoya', colour: 5, fold: 'hexa' },
  dev: { email: 'chai-dev@example.com', name: 'Dev', colour: 2, fold: 'kandil' },
};
const FRESH = { email: 'chai-fresh@example.com', name: 'Mira' };
const SEED_ATTEMPT_PREFIX = 'att_seed_mobv3_';

// ------------------------------------------------------------------------------------------------ helpers
const log = (...a) => console.log('[seed-v3]', ...a);
const HOUR = 3_600_000; const MIN = 60_000; const DAY = 86_400_000;
const istDay = (ms) => new Date(ms + 19_800_000).toISOString().slice(0, 10);
const istStart = (day) => Date.parse(`${day}T00:00:00+05:30`);
const addDay = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

async function bearer(email) {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const { data, error } = await anon.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: link.data.properties.verification_type });
  if (error) throw error;
  return data.session.access_token;
}
async function api(token, method, path, body) {
  const r = await fetch(SITE + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 300); }
  return { status: r.status, json };
}

/** The student's account: auth user, account row, name and subjects. Returns { id, token }. */
async function ensureStudent(email, name) {
  const token = await bearer(email);
  const me = await api(token, 'GET', '/api/auth/me');
  if (me.status !== 200 || !me.json?.user?.id) throw new Error(`could not load ${email} through ${SITE} (status ${me.status}); is the Mob v3 staging site up?`);
  const u = me.json.user;
  const subjectsOk = SUBJECTS.every((s) => u.subjects.includes(s));
  if (!subjectsOk || u.name !== name) {
    const p = await api(token, 'PATCH', `/api/users/${u.id}`, { name, subjects: SUBJECTS });
    if (p.status !== 200) throw new Error(`could not set ${email} name and subjects (status ${p.status})`);
  }
  return { id: u.id, token };
}

// ------------------------------------------------------------------------------------------------ question bank (staging)
let POOL = null;
const optionKey = (row) => {
  const n = Array.isArray(row.options) ? row.options.length : 0;
  if (Number.isInteger(row.correct_index) && row.correct_index >= 0 && row.correct_index < n) return row.correct_index;
  const letter = String(row.correct_answer ?? '').trim().toUpperCase();
  const i = 'ABCD'.indexOf(letter);
  return letter.length === 1 && i >= 0 && i < n ? i : -1;
};
const toQuestion = (row) => ({
  id: row.id, subject: row.subject, chapter: row.chapter, question: row.question ?? row.body, body: row.body ?? row.question,
  options: row.options, correctIndex: optionKey(row), explanation: row.explanation || null, passageText: null,
});
const VISIBLE = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';
async function pool() {
  if (POOL) return POOL;
  const rows = must(await admin.from('questions').select('*').eq('subject', 'accountancy').eq('is_deleted', false).or(VISIBLE).order('id').limit(400), 'bank');
  POOL = rows
    .filter((r) => Array.isArray(r.options) && r.options.length === 4 && r.options.every((o) => typeof o === 'string') && optionKey(r) >= 0
      && !r.passage_id && !r.passage_group_id && !r.group_id && !r.passage_text && String(r.question ?? r.body ?? '').length > 20)
    .map(toQuestion);
  if (POOL.length < 40) throw new Error(`the staging bank has only ${POOL.length} usable Accountancy questions`);
  return POOL;
}

// ------------------------------------------------------------------------------------------------ the real service
const clock = { now: Date.now() };
const rpc = async (name, params) => { const { data, error } = await admin.rpc(name, params); if (error) throw error; return data; };
const blocklist = JSON.parse(readFileSync('data/mob_name_blocklist.json', 'utf8'));
const NAMES = { accountancy: 'Accountancy', english: 'English', economics: 'Economics', business_studies: 'Business Studies' };
const svc = createMobService({
  rpc, now: () => clock.now, secret: SERVICE_KEY, blocklist, randomBytes: (n) => randomBytes(n),
  subjectInfo: (s) => (NAMES[s] ? { ok: true, id: s, name: NAMES[s] } : { ok: false }),
  loadUser: async (id) => { const r = await admin.from('users').select('subjects,is_premium').eq('id', id).maybeSingle(); return r.data ? { isPremium: r.data.is_premium === true, subjects: r.data.subjects || [] } : null; },
  validChapter: () => false,
  pickQuestionIds: async (_s, { count = 5, key = null } = {}) => {
    const p = await pool();
    const h = [...String(key || Math.random())].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const start = h % (p.length - count);
    return p.slice(start, start + count).map((q) => q.id);
  },
  loadQuestions: async (ids) => { const p = await pool(); return ids.map((id) => p.find((q) => q.id === id)).filter(Boolean); },
  trapNameFor: async () => null, findAttempts: async () => [], chapterCounts: async () => [], forgetChapterCounts: () => {},
  invitesEnabled: () => true, startPractice: async () => { throw new Error('not used by the seed'); },
  v3Enabled: () => true, billingOn: () => false, liveEnabled: () => false,
});
const v3 = svc.v3;

// ------------------------------------------------------------------------------------------------ reset
async function resetWorld(ids) {
  const list = Object.values(ids);
  const mobs = must(await admin.from('mobs').select('id').in('created_by', list), 'find seed Mobs');
  const mobIds = mobs.map((m) => m.id);
  if (mobIds.length) {
    must(await admin.from('mob_start_claims').delete().in('mob_id', mobIds), 'delete start claims by Mob');
    must(await admin.from('mobs').delete().in('id', mobIds), 'delete seed Mobs');
  }
  for (const t of ['fold_unlocks', 'mob_profiles', 'mob_seen', 'mob_start_claims', 'chain_prefs', 'chain_pauses']) {
    must(await admin.from(t).delete().in('user_id', list), `reset ${t}`);
  }
  must(await admin.from('attempts').delete().in('user_id', list).like('id', `${SEED_ATTEMPT_PREFIX}%`), 'delete seed attempts');
  log(`reset: ${mobIds.length} seed Mob(s) removed`);
}

// ------------------------------------------------------------------------------------------------ plays
const wrongOption = (key, j) => (key + j) % 4; // j = 1..3, never the key
async function gameIds(gameId, userId) {
  const g = await rpc('mob_game_json', { p_game_id: gameId, p_user_id: userId, p_now: new Date(clock.now).toISOString() });
  return g.question_ids;
}
async function questionsOf(ids) { const p = await pool(); return ids.map((id) => p.find((q) => q.id === id)); }
/** plan: 'R' right | 'W1'..'W3' wrong (that offset from the key) | 'S' skip. secs: seconds per answer. */
async function play(gameId, userId, startMs, plan, secs) {
  const questions = await questionsOf(await gameIds(gameId, userId));
  clock.now = startMs;
  await v3.startRun(userId, gameId);
  for (let q = 0; q < plan.length; q += 1) {
    clock.now += secs[q] * 1000;
    const key = questions[q].correctIndex;
    const p = plan[q];
    const pick = p === 'R' ? key : p === 'S' ? -1 : wrongOption(key, Number(p.slice(1)));
    await v3.answer(userId, gameId, { q, pick });
  }
}
async function openSprint(mobId, hostId, atMs) {
  clock.now = atMs;
  const r = await v3.openGame(hostId, { mob: mobId, format: 'sprint', mode: 'async', count: 5 });
  return r.game.id;
}

// ------------------------------------------------------------------------------------------------ the build
async function attemptTemplate() {
  const rows = must(await admin.from('attempts').select('*').eq('subject', 'accountancy').order('completed_at', { ascending: false }).limit(60), 'template attempts');
  const t = rows.find((r) => !String(r.id).startsWith(SEED_ATTEMPT_PREFIX) && Array.isArray(r.questions_snapshot) && r.questions_snapshot.length >= 5
    && r.questions_snapshot.slice(0, 5).every((q) => Number.isInteger(q.correctIndex) && Array.isArray(q.options)));
  if (!t) throw new Error('no real accountancy attempt on staging to build the chain days from');
  return t;
}
function attemptRow(t, userId, day) {
  const snap = t.questions_snapshot.slice(0, 5);
  const meta = { ...(t.selection_meta || {}), mode: 'quick', finalCount: 5, selectedCount: 5, requestedCount: 5, seed: 'mob-v3-staging' };
  if (meta.recovery) { meta.recovery = { ...meta.recovery }; delete meta.recovery.recommendation; }
  return {
    ...t, id: `${SEED_ATTEMPT_PREFIX}${userId.slice(0, 8)}_${day}`, user_id: userId,
    score: 25, correct: 5, wrong: 0, unattempted: 0, total: 5,
    details: snap.map((q) => ({ qid: q.id, isCorrect: true, givenIndex: q.correctIndex })),
    questions_snapshot: snap, selection_meta: meta, completed_at: new Date(istStart(day) + 19.5 * HOUR).toISOString(),
  };
}

async function build(ids) {
  const N = Date.now();
  const thisWeek = mobWeek(N);
  clock.now = N;

  // 1. Mob, invite, members, settings
  const made = await svc.create(ids.riya, { subject: 'accountancy', name: CAST.riya.name, colour: CAST.riya.colour, nameKey: 0, fold: CAST.riya.fold });
  const mobId = made.mob.id;
  const inv = await svc.invite(ids.riya, { mob: mobId });
  for (const k of ['kabir', 'zoya', 'dev']) await svc.join(ids[k], { code: inv.code, name: CAST[k].name, colour: CAST[k].colour, fold: CAST[k].fold });
  await v3.settings(ids.riya, { mob: mobId, showPodium: true, nameKey: 0 });
  log('Mob created with 4 members', mobId);

  // 2. The three settled weeks before this one (the Mob chain): everyone did 15, the target for four is 60.
  for (let i = 3; i >= 1; i -= 1) {
    const week = addDay(thisWeek, -7 * i);
    const mid = istStart(week) + 2 * DAY + 10 * HOUR;
    for (const k of Object.keys(CAST)) {
      await rpc('mob_quest_tick', { p_mob_id: mobId, p_week: week, p_source: 'paper', p_source_id: `seed-paper-${week}`, p_user_id: ids[k], p_answered: 15, p_now: new Date(mid).toISOString() });
    }
    await rpc('mob_quest_week', { p_mob_id: mobId, p_week: week, p_now: new Date(istStart(addDay(week, 7)) + HOUR).toISOString() });
  }

  // 3. Closed Sprint A (host Riya): all four played, 3 of 4 fell into question 2 -> the trap. Opened 62 h ago.
  const aOpen = N - 62 * HOUR;
  const A = await openSprint(mobId, ids.riya, aOpen);
  await play(A, ids.riya, aOpen + 1 * HOUR, ['R', 'W1', 'R', 'R', 'R'], [11, 17, 9, 12, 8]);
  await play(A, ids.kabir, aOpen + 3 * HOUR, ['R', 'W1', 'R', 'W3', 'R'], [9, 14, 8, 15, 10]);
  await play(A, ids.zoya, aOpen + 5 * HOUR, ['R', 'W1', 'R', 'R', 'S'], [14, 21, 12, 10, 6]);
  await play(A, ids.dev, aOpen + 9 * HOUR, ['R', 'R', 'R', 'R', 'R'], [7, 12, 6, 9, 7]);

  // 4. Closed Sprint B (host Kabir): three played, scattered misses, no trap. Opened 44 h ago.
  const bOpen = N - 44 * HOUR;
  const B = await openSprint(mobId, ids.kabir, bOpen);
  await play(B, ids.kabir, bOpen + 1 * HOUR, ['R', 'R', 'W1', 'R', 'R'], [8, 10, 16, 9, 7]);
  await play(B, ids.zoya, bOpen + 4 * HOUR, ['R', 'W2', 'R', 'S', 'R'], [13, 19, 11, 5, 12]);
  await play(B, ids.riya, bOpen + 6 * HOUR, ['W3', 'R', 'R', 'R', 'W1'], [12, 9, 10, 13, 15]);

  // 5. Open Sprint (host Kabir), 2 hours old: Kabir and Zoya finished, Riya and Dev have not played it.
  const oOpen = N - 2 * HOUR;
  const O = await openSprint(mobId, ids.kabir, oOpen);
  await play(O, ids.kabir, oOpen + 5 * MIN, ['R', 'R', 'R', 'W2', 'R'], [8, 11, 9, 14, 7]);
  await play(O, ids.zoya, oOpen + 25 * MIN, ['R', 'R', 'S', 'R', 'R'], [12, 13, 5, 10, 9]);

  // 6. Settle the closed games (reading them closes them: the trap is found from every pick, once).
  clock.now = N;
  for (const g of [A, B]) await v3.getGame(ids.riya, g);

  // 7. Stickers.
  await v3.sticker(ids.kabir, { mob: mobId, game: A, kind: 'nice_one' });
  await v3.sticker(ids.zoya, { mob: mobId, game: A, kind: 'so_close' });
  await v3.sticker(ids.dev, { mob: mobId, game: O, kind: 'good_luck' });
  await v3.sticker(ids.riya, { mob: mobId, game: B, kind: 'again' });

  // 8. This week's quest to exactly 51 of 60. The games above add what fell in this IST week; the rest is paper and an extra paper.
  clock.now = N;
  const q0 = await rpc('mob_quest_week', { p_mob_id: mobId, p_week: thisWeek, p_now: new Date(N).toISOString() });
  let need = 51 - Number(q0.answered);
  if (need < 0) throw new Error(`this week's games already add ${q0.answered}, more than 51`);
  const plan = [['paper', 'riya'], ['paper', 'kabir'], ['paper', 'zoya'], ['paper', 'dev'], ['extra', 'kabir'], ['extra', 'zoya']];
  for (const [source, k] of plan) {
    if (need <= 0) break;
    const take = Math.min(need, source === 'paper' ? 10 : 15);
    await rpc('mob_quest_tick', { p_mob_id: mobId, p_week: thisWeek, p_source: source, p_source_id: `seed-${source}-${thisWeek}`, p_user_id: ids[k], p_answered: take, p_now: new Date(N).toISOString() });
    need -= take;
  }
  if (need > 0) throw new Error(`could not reach 51 (still ${need} short)`);

  // 9. Personal chains: perfect 5-question quick attempts on past IST days (never today).
  const today = istDay(N);
  const tmpl = await attemptTemplate();
  const span = (from, to) => { const out = []; for (let d = from; d <= to; d += 1) out.push(addDay(today, -d)); return out; };
  const chainDays = { riya: span(1, 13).filter((d) => d !== addDay(today, -8)), kabir: span(1, 6), zoya: span(1, 2), dev: [] };
  const rows = [];
  for (const [k, list] of Object.entries(chainDays)) for (const day of list) rows.push(attemptRow(tmpl, ids[k], day));
  must(await admin.from('attempts').upsert(rows, { onConflict: 'id' }), 'chain attempts');
  log(`chain attempts written: ${rows.length}`);
  return { mobId, games: { A, B, open: O }, thisWeek };
}

// ------------------------------------------------------------------------------------------------ verify through the API
async function verify(toks, mobId) {
  const fails = []; const out = {};
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const riya = await api(toks.riya, 'GET', `/api/mob?mob=${mobId}`);
  ok(riya.status === 200, `GET /api/mob?mob= as Riya returned ${riya.status}`);
  const m = riya.json?.mob || {}; const v = m.v3 || {};
  out.mob = { name: v.name?.text, subject: m.subject, members: (v.members || []).length, showPodium: v.showPodium, youOwn: v.youOwn, folds: (v.members || []).map((x) => `${x.name}:${x.fold}`) };
  ok(v.name?.text === 'Chai Circle', `name is ${v.name?.text}`);
  ok(v.showPodium === true, 'podium not on');
  ok((v.members || []).length === 4, `members ${(v.members || []).length}`);
  ok(JSON.stringify((v.members || []).map((x) => x.fold).sort()) === JSON.stringify(['dart', 'dogear', 'hexa', 'kandil']), 'starter Folds');
  const games = v.games || [];
  out.games = games.map((g) => ({ format: g.format, closed: g.closed, runs: g.runs.length, yourRun: g.yourRun, closesAt: g.closesAt }));
  ok(games.length === 3, `den games ${games.length}`);
  ok(games.filter((g) => g.closed).length === 2, 'closed sprint count');
  const open = games.find((g) => !g.closed);
  ok(open && open.runs.length === 2 && open.yourRun === 'none', 'open sprint with 2 finished runs, Riya not played');
  out.quest = v.quest;
  const qa = Number(v.quest?.answered ?? v.quest?.have); const qt = Number(v.quest?.target ?? v.quest?.need);
  ok(qa === 51 && qt === 60, `quest ${qa} of ${qt}`);
  out.mobChain = v.mobChain;
  ok(v.mobChain?.weeks === 3 && v.mobChain?.stitchedThisWeek === false, `Mob chain ${JSON.stringify(v.mobChain)}`);
  // The three settled weeks make the parcel read Stamp (games.js counts every done week of the Mob in quests_done), while
  // Hop itself stays unowned for these members (mob_unlock_facts counts only weeks done after the member joined).
  ok(v.quest?.parcel?.fold === 'stamp', `parcel ${JSON.stringify(v.quest?.parcel)} (expected Stamp for a 3-week Mob)`);
  let trapSeen = 0; out.review = [];
  for (const g of games.filter((x) => x.closed)) {
    const rv = await api(toks.riya, 'GET', `/api/mob/game/${g.id}/review`);
    ok(rv.status === 200, `review ${g.id} ${rv.status}`);
    if (rv.json?.trap) { trapSeen += 1; out.review.push({ trapQuestion: rv.json.trap.number, check: rv.json.trap.fix?.check }); }
  }
  ok(trapSeen === 1, `traps found ${trapSeen}`);
  const shelf = await api(toks.riya, 'GET', '/api/mob/shelf');
  const hop = (shelf.json?.folds || []).find((f) => f.key === 'hop');
  out.hopOwned = hop?.owned; ok(hop && hop.owned === false, 'Hop is owned');
  out.foldsOwned = (shelf.json?.folds || []).filter((f) => f.owned).map((f) => f.key);
  const chains = {};
  for (const k of Object.keys(CAST)) {
    const c = await api(toks[k], 'GET', '/api/me/chain');
    chains[k] = { status: c.status, days: c.json?.days, rested: c.json?.rested, passesHeld: c.json?.passes?.held, best: c.json?.best, practised: c.json?.practised };
  }
  out.chains = chains;
  ok(chains.riya.days === 13 && chains.riya.rested >= 1 && chains.riya.passesHeld >= 1, `Riya chain ${JSON.stringify(chains.riya)}`);
  const freshMe = await api(toks.fresh, 'GET', '/api/auth/me');
  out.fresh = { subjects: freshMe.json?.user?.subjects };
  ok((freshMe.json?.user?.subjects || []).length > 0, 'fresh student has no subjects');
  const freshMob = await api(toks.fresh, 'GET', '/api/mob');
  out.fresh.mobStatus = freshMob.status; out.fresh.hasMob = Boolean(freshMob.json?.mob);
  ok(!freshMob.json?.mob, 'fresh student is already in a Mob');
  return { fails, out };
}

// ------------------------------------------------------------------------------------------------ main
const ids = {}; const toks = {};
for (const [k, c] of Object.entries(CAST)) { const s = await ensureStudent(c.email, c.name); ids[k] = s.id; toks[k] = s.token; }
{ const s = await ensureStudent(FRESH.email, FRESH.name); toks.fresh = s.token; ids.fresh = s.id; }
const seedIds = Object.fromEntries(Object.keys(CAST).map((k) => [k, ids[k]]));

// Is the world there and fresh enough for a walk (an open Sprint with at least 4 hours left)?
async function existing() {
  const mobs = must(await admin.from('mobs').select('id').eq('created_by', ids.riya).eq('name_key', 0), 'find Mob');
  for (const mob of mobs) {
    const g = must(await admin.from('mob_games').select('id').eq('mob_id', mob.id).gt('closes_at', new Date(Date.now() + 4 * HOUR).toISOString()), 'find open game');
    if (g.length) return mob.id;
  }
  return null;
}
let mobId = await existing();
let built = false;
if (CHECK_ONLY) {
  if (!mobId) { log('check only: no fresh seeded world found'); process.exit(2); }
} else if (!mobId || FORCE) {
  await resetWorld(seedIds);
  mobId = (await build(seedIds)).mobId;
  built = true;
} else {
  log('world already seeded and fresh (the open Sprint has more than 4 hours left); verifying only. Use --force to rebuild.');
}
const { fails, out } = await verify(toks, mobId);
console.log(JSON.stringify({ site: SITE, mobId, built, students: Object.fromEntries(Object.values(CAST).map((c) => [c.email, c.name])), fresh: FRESH.email, seededAt: new Date().toISOString(), fails, ...out }, null, 2));
if (fails.length) { console.error('[seed-v3] CHECKS FAILED:', fails.join(' | ')); process.exit(1); }
log('ok');
