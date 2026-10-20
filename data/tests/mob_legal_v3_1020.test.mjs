// L-08 (20 Oct 2026): the Mob's sections on /privacy and /terms describe Mob v3 and nothing the code does not do. Source-level:
// each claim is tied to the constant or rule in the v3 code that makes it true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNTS, MARK_RIGHT, MARK_WRONG } from '../../src/lib/mob/games.mjs';
import { MAX_MEMBERS, INVITE_DAYS, NAME_MAX, REPORT_REASONS } from '../../src/lib/mob/model.mjs';
import { STICKERS } from '../../src/lib/server/mob/games.js';
import { MOB_NAMES } from '../../src/lib/mob/names.mjs';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const legal = read('src/components/mob/MobLegal.jsx');
const sections = legal.slice(legal.indexOf('export function MobPrivacySection'));
const privacy = sections.slice(0, sections.indexOf('export function MobTermsSection'));
const terms = sections.slice(sections.indexOf('export function MobTermsSection'));
const plain = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '');

test('the Mob privacy section names the v3 features: games, podium, ghosts, stickers, the trap, Fix it together, quest, mic', () => {
  for (const must of ['<b>Games.</b>', '<b>The podium.</b>', '<b>Ghosts.</b>', '<b>Stickers.</b>', '<b>The trap.</b>', '<b>Fix it together.</b>',
    '<b>Quest, chain and Folds.</b>', '<b>Passing the mic.</b>', '<b>The weekly paper.</b>', '<b>Nudges.</b>', '<b>Leaving and blocking.</b>', '<b>Reporting.</b>']) {
    assert.ok(privacy.includes(must), must);
  }
  assert.ok(privacy.includes('id="mob"'));
});

test('the pre-v3 sentences are gone: no "never ranked", no "same 10-question paper each week" as what a Mob is', () => {
  assert.doesNotMatch(legal, /never ranked|never a ranking|sorted by score/i);
  assert.doesNotMatch(legal, /sit the same 10-question paper each week/);
  assert.doesNotMatch(legal, /you will never share a Mob with that person again/);
});

test('numbers in the text equal the code: 5 members, 7-day invites, 18-character names, game lengths, CUET marks, 8 stickers, 30 days, 180 days', () => {
  const p = plain(privacy);
  assert.equal(MAX_MEMBERS, 5); assert.match(p, /up to 5 students/);
  assert.equal(INVITE_DAYS, 7); assert.match(p, /works for 7 days/);
  assert.equal(NAME_MAX, 18); assert.match(p, /2 to 18 characters/);
  assert.deepEqual([...COUNTS.sprint, ...COUNTS.round], [5, 10, 15, 20]);
  assert.match(p, /a sprint of 5 questions, or a round of 10, 15 or 20 questions/);
  assert.match(p, /open for 24 hours/);
  assert.equal(MARK_RIGHT, 5); assert.equal(MARK_WRONG, -1);
  assert.match(p, /5 for a right answer, minus 1 for a wrong answer and 0 for a skipped question/);
  assert.equal(STICKERS.length, 8); assert.match(p, /fixed set of 8/);
  assert.match(p, /Stickers are kept for 30 days/);
  assert.match(read('supabase/migrations/20261020100100_mob_v3_games.sql'), /delete from public\.mob_reactions where mob_id = g\.mob_id and created_at < p_now - interval '30 days'/);
  assert.match(p, /Reports are deleted after 180 days/);
  assert.match(read('src/app/api/internal/refresh-inventory/route.js'), /180 \* 86_400_000/);
  assert.deepEqual([...REPORT_REASONS], ['name', 'nudge', 'safety']);
  assert.ok(MOB_NAMES.length === 24 && /name comes from a fixed list/.test(p));
});

test('what a member sees and the share switch are stated as the v3 and L-10 behaviour', () => {
  const p = plain(privacy);
  assert.match(p, /If you share your marks, they also see your marks and your place on the podium/);
  assert.match(p, /Nobody sees which option you picked on a question in a game/);
  assert.match(p, /Places are on by default\. The member who started the Mob can switch places off for the whole Mob/);
  assert.match(p, /A ghost replays the pace of another member's finished run/);
  assert.match(p, /A ghost never shows what that member picked or whether they were right/);
  assert.match(p, /turn off "Share my marks in games"/);
  assert.match(p, /your run takes no place and shows no marks on the podium, your moment line only says you finished, your right answers are left out of the Mob's together total \(the number of questions the Mob got right as a group\), and your run is not used as a ghost for others/);
  // The label the policy names is the one the den shows.
  assert.match(read('src/lib/mob/v3/denCopy.mjs'), /shareMarks: 'Share my marks in games'/);
  // The podium switch is the owner's (mob_settings_set refuses anyone else).
  assert.match(read('src/lib/server/mob/games.js'), /not_owner['"]\) throw new MobError\('NOT_OWNER_SETTINGS'\)/);
});

test('leave and block (L-09) and the Mob deletion list cover every v3 table that holds a user id', () => {
  const p = plain(privacy);
  assert.match(p, /Leave and block takes you out of that Mob and out of every other Mob you share with that person \(in a Mob you own, that person is removed instead\), and neither of you can join a Mob the other is in\. They are not told that you blocked them/);
  const kept = new Set(DELETION_STEPS.map((s) => s.table));
  const v3Tables = ['mob_game_runs', 'mob_game_answers', 'mob_fix_checks', 'mob_start_claims', 'mob_mics', 'mob_reactions', 'mob_step_outs', 'mob_seen', 'fold_unlocks', 'mob_profiles', 'chain_pauses', 'chain_prefs', 'mob_room_tickets', 'mob_games', 'mobs', 'mob_members', 'mob_blocks', 'mob_reports'];
  for (const t of v3Tables) assert.ok(kept.has(t), `${t} has a deletion step`);
  for (const word of ['game runs, answers and marks', 'the stickers you sent', 'Fix it together answers', 'seat Fold and the Folds you earned', 'chain settings', 'Reports you made or that name you lose any link to your account']) {
    assert.ok(p.includes(word), word);
  }
});

test('live rooms are not described (MOB_LIVE_ENABLED is off), and the section does not gate on anything that is off', () => {
  assert.doesNotMatch(privacy + terms, /live room|live game|play together at the same moment/i);
  assert.match(legal, /export const mobEnabledForLegal = \(\) => process\.env\.MOB_ENABLED === 'true';/);
  assert.doesNotMatch(legal.replace(/^\/\/.*$/gm, ''), /\bMOB_(V3|LIVE)_ENABLED\b/);
});

test('the Terms section states the Mob rules and links to /privacy#mob', () => {
  const t = plain(terms);
  assert.match(t, /Use a display name that is not offensive and does not pretend to be MockMob or someone else/);
  assert.match(t, /Do not use stickers, nudges or reports to harass anyone/);
  assert.match(t, /We may remove a member from a Mob, pause invites, or restrict the Mob for misuse/);
  assert.ok(terms.includes('href="/privacy#mob"'));
});
