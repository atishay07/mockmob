// Builds the two-phase production content import for study content v2 and dry-runs it in PGlite.
// Phase 1 inserts released versions only (insert-only; an existing id@version must have the same hash).
// Phase 2, run after the new application is deployed, retires superseded published unit versions through
// the existing correction trigger, which invalidates affected runs and records an event. Nothing is deleted.
// No production connection is made here. Usage: node scripts/learning/study-content-v2-import.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { canonicalStudyJSON } from '../../data/study_content.js';

const digest = v => createHash('sha256').update(canonicalStudyJSON(v)).digest('hex');
const pilot = JSON.parse(readFileSync('data/study/pilot.json', 'utf8'));
const release = JSON.parse(readFileSync('data/study/release.json', 'utf8'));
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const units = pilot.units.filter(u => release.units[`${u.id}@${u.version}`]?.contentHash === digest(u));
const cards = pilot.cards.filter(c => release.cards[`${c.id}@${c.version}`]?.contentHash === digest(c));
if (units.length !== pilot.units.length || cards.length !== pilot.cards.length) throw new Error('UNRELEASED_CONTENT_IN_PILOT');
const unitRow = u => ({ id: u.id, version: u.version, subject: u.subject, chapter: u.chapter, concept_id: u.conceptId, content: u, content_hash: digest(u), publication_state: 'published' });
const cardRow = c => ({ id: c.id, version: c.version, unit_id: c.unitId, unit_version: units.find(u => u.id === c.unitId).version, content: c, content_hash: digest(c) });
const insert = (table, row) => `insert into public.${table} select * from jsonb_populate_record(null::public.${table},${literal(row)}) on conflict(id,version) do nothing;
do $$ begin if not exists(select 1 from public.${table} where id=${literal(row.id)}#>>'{}' and version=${row.version} and content_hash='${row.content_hash}' and content=(${literal(row)})->'content') then raise exception 'Existing ${table} version differs: ${row.id}@${row.version}'; end if; end $$;`;
const phase1 = `-- Study content v2, phase 1: insert-only. Safe before deploy: the deployed release proof ignores these rows.
begin;
${units.map(u => insert('study_units', unitRow(u))).join('\n')}
${cards.map(c => insert('study_cards', cardRow(c))).join('\n')}
commit;
select (select count(*) from public.study_units) as units, (select count(*) from public.study_cards) as cards;
`;
const superseded = units.filter(u => u.version > 1).map(u => ({ id: u.id, below: u.version }));
const phase2 = `-- Study content v2, phase 2: run only after the v2 application is live. Retires older published versions of
-- corrected units; the correction trigger invalidates runs on them and records content_corrected events.
begin;
${superseded.map(s => `update public.study_units set publication_state='quarantined' where id='${s.id}' and version<${s.below} and publication_state='published';`).join('\n')}
commit;
select id,version,publication_state from public.study_units where id in (${superseded.map(s => `'${s.id}'`).join(',')}) order by id,version;
`;
mkdirSync('artifacts/study-suite', { recursive: true });
writeFileSync('artifacts/study-suite/content-v2-phase1.sql', phase1);
writeFileSync('artifacts/study-suite/content-v2-phase2.sql', phase2);

// ---------- Dry run against the four applied migrations with the current production shape ----------
const old = JSON.parse(execFileSync('git', ['show', 'a6a61cc:data/study/pilot.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const db = new PGlite();
const report = { at: new Date().toISOString(), scope: 'Isolated PGlite dry run of the saved two-phase import; not production evidence', checks: {} };
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table users(id text primary key,credit_balance int,is_premium boolean,premium_until timestamptz);
    create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,correct_index int,explanation text,status text,verification_state text);
    create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb,selection_meta jsonb);
    create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz,last_attempted_at timestamptz,updated_at timestamptz,primary key(user_id,question_id));
    create table question_interactions(user_id text,question_id text);create table question_bookmarks(user_id text,question_id text);
    create table credit_transactions(user_id text,amount int,type text,reference text,action text,credit_delta int);
    create table passage_groups(id text primary key,passage_text text);
    create function public.spend_credits(text,text,text) returns boolean language sql as 'select false';
    insert into users values('owner',40,true,now()+interval '1 month');insert into questions(id,body,correct_answer) values('existing-question','Existing bank item','A');`);
  for (const file of ['20261001105920_score_recovery_foundations.sql', '20261002120000_connected_learning.sql', '20261004154217_connected_study_suite.sql', '20261004172214_study_review_backlog.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  for (const u of old.units) await db.query('insert into study_units select * from jsonb_populate_record(null::study_units,$1)', [unitRow(u)]);
  for (const c of old.cards) await db.query('insert into study_cards select * from jsonb_populate_record(null::study_cards,$1)', [{ ...cardRow({ ...c, unitId: c.unitId }), unit_version: 1 }]);
  const v1 = old.units.find(u => u.id === 'english-vocabulary-01');
  await db.query('insert into study_runs(id,user_id,request_key,request,mode,content,projection) values($1,$2,$3,$4,$5,$6,$7)', ['owner-run', 'owner', 'owner_run_request_1', { mode: 'learn', unitId: v1.id }, 'learn', { units: [{ id: v1.id, version: 1, contentHash: digest(v1) }], items: [] }, { id: 'owner-run', state: 'active', revision: 0, cursor: 1 }]);
  const before = (await db.query('select (select count(*)::int from questions) q,(select credit_balance from users) c,(select count(*)::int from study_card_states) s')).rows[0];
  await db.exec(phase1); await db.exec(phase1);
  report.checks.phase1Idempotent = (await db.query('select count(*)::int n from study_units')).rows[0].n === old.units.length + units.filter(u => !old.units.some(o => o.id === u.id && o.version === u.version)).length;
  report.checks.oldVersionsStillPublishedAfterPhase1 = (await db.query("select count(*)::int n from study_units where version=1 and id in ('english-vocabulary-01','accountancy-sacrificing-gaining') and publication_state='published'")).rows[0].n === 2;
  report.checks.ownerRunUntouchedByPhase1 = (await db.query("select projection->>'state' s from study_runs where id='owner-run'")).rows[0].s === 'active';
  // Same id@version and claimed hash, but different content, must be refused.
  const tampered = phase1.replaceAll(units[0].blocks[0].title, `${units[0].blocks[0].title} (edited)`);
  if (tampered === phase1) throw new Error('TAMPER_NOT_APPLIED');
  let rejected = false; try { await db.exec(tampered); } catch { rejected = true; await db.exec('rollback'); }
  report.checks.changedSameVersionRejected = rejected;
  await db.exec(phase2); await db.exec(phase2);
  const states = (await db.query("select id,version,publication_state from study_units where id in ('english-vocabulary-01','accountancy-sacrificing-gaining') order by id,version")).rows;
  report.checks.supersededQuarantinedNotDeleted = states.length === 4 && states.filter(s => s.version === 1).every(s => s.publication_state === 'quarantined') && states.filter(s => s.version === 2).every(s => s.publication_state === 'published');
  report.checks.ownerRunInvalidatedWithEvent = (await db.query("select projection->>'state' s from study_runs where id='owner-run'")).rows[0].s === 'invalidated' && (await db.query("select count(*)::int n from study_events where run_id='owner-run' and event->>'type'='content_corrected'")).rows[0].n === 1;
  const after = (await db.query('select (select count(*)::int from questions) q,(select credit_balance from users) c,(select count(*)::int from study_card_states) s')).rows[0];
  report.checks.unrelatedDataUnchanged = JSON.stringify(before) === JSON.stringify(after);
  report.counts = { releasedUnits: units.length, releasedCards: cards.length, supersededUnits: superseded.map(s => `${s.id}@<${s.below}`) };
} finally { await db.close(); }
report.state = Object.values(report.checks).every(Boolean) ? 'passed' : 'failed';
writeFileSync('artifacts/study-suite/content-v2-import-dry-run-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 1));
if (report.state !== 'passed') process.exit(1);
