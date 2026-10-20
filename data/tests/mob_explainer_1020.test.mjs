// The Mob explainer on the web (D166, pass-1020 MOB-EXPLAINER.md, the owner's K9 copy of 20 Oct 2:05 pm).
// Pure rules from src/components/mob/v3/explainer/explainerModel.mjs, plus source checks on the wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLIDE_COPY, SLIDE_COUNT, PLAY_CARDS, PODIUM_FIXTURE, SETUP_COPY, EXPLAINER_COPY, MARK_FOR,
  slidesFor, liveLine, endKeys, skipTo, marksSeen, seenKey, createSeenGate, inviteKeyLabel,
  initialSetup, setupKey, setupBody, setupBack, setupNext, setupSteps, stepOf, isLastStep, changeFold, pennantShowsSubject,
  nameNote, namesOnPage, timeline, buildTimes, beatOrder, marksOf,
} from '../../src/components/mob/v3/explainer/explainerModel.mjs';
import { assignMoments, placeRuns, COUNTS } from '../../src/lib/mob/games.mjs';
import { MOB_NAMES } from '../../src/lib/mob/names.mjs';
import { MAX_MEMBERS, checkName, PAPER_COUNT, RUNNER_SECONDS_PER_QUESTION } from '../../src/lib/mob/model.mjs';
import { STARTERS } from '../../src/lib/mob/folds.mjs';
import { PER_MEMBER } from '../../src/lib/mob/quest.mjs';
import { DAY_GOAL } from '../../src/lib/chain/chain.mjs';
import { startRight } from '../../src/lib/mob/starts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

function memoryStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('the seen flag is per account: set on slide 7, on Skip and on an end key, never on Escape', () => {
  assert.equal(seenKey('u1'), 'mob.explainer.v1.seen:u1');
  const store = memoryStore();
  const gate = createSeenGate(store);
  assert.equal(gate.seen('u1'), false);
  assert.equal(marksSeen('last'), true);
  assert.equal(marksSeen('skip'), true);
  assert.equal(marksSeen('key'), true);
  assert.equal(marksSeen('escape'), false);
  assert.equal(marksSeen('outside'), false);
  gate.mark('u1');
  assert.equal(store.getItem('mob.explainer.v1.seen:u1'), '1');
  assert.equal(gate.seen('u1'), true);
  assert.equal(gate.seen('u2'), false, 'another account on the same device has its own flag');
  assert.equal(createSeenGate(store).seen('u1'), true, 'a new page reads the stored flag');
  assert.equal(createSeenGate(store).seen(null), false, 'no account, no flag');
});

test('a store that fails reads as unseen, but the explainer never loops within the page', () => {
  const gate = createSeenGate(throwing);
  assert.equal(gate.seen('u1'), false, 'storage fails: unseen');
  assert.equal(gate.mark('u1'), false, 'the write fails quietly');
  assert.equal(gate.seen('u1'), true, 'remembered in memory, so Skip never opens it again');
  const missing = createSeenGate(() => { throw new Error('no window'); });
  assert.equal(missing.seen('u1'), false);
  missing.mark('u1');
  assert.equal(missing.seen('u1'), true);
});

test('routing: Skip goes where the student was heading', () => {
  assert.equal(skipTo('start'), 'setup');
  assert.equal(skipTo('join'), 'join');
  assert.equal(skipTo('invite'), 'invite', 'the invite page with its code filled');
  assert.equal(skipTo('replay'), 'den');
});

test('slide 7 keys per mode: the one the student came from first and volt; a replay has one key', () => {
  const ids = (m, o) => endKeys(m, o).map((k) => [k.id, k.label, k.primary]);
  assert.deepEqual(ids('start'), [['setup', 'Start your Mob', true], ['join', 'Join with a code', false]]);
  assert.deepEqual(ids('join'), [['join', 'Join with a code', true], ['setup', 'Start your Mob', false]]);
  assert.deepEqual(ids('invite', { mobName: 'Chai Circle' }), [['invite', 'Join Chai Circle', true], ['setup', 'Start your Mob', false]]);
  assert.deepEqual(ids('invite', { mobName: '' }), [['invite', "Join your friend's Mob", true], ['setup', 'Start your Mob', false]], 'no name in the preview: no invented name');
  assert.deepEqual(ids('replay'), [['den', 'Back to your Mob', true]]);
  assert.equal(inviteKeyLabel('  Steady Kites '), 'Join Steady Kites');
  assert.equal(inviteKeyLabel(null), "Join your friend's Mob");
});

test('the approved copy (K9) is exactly what the slides say', () => {
  const want = [
    ['This is your Mob', 'You and up to 4 friends. Start a quick game any time. Your friends get 24 hours to play the same questions, and you see who did best.'],
    ['Everyone sits as a Fold', "The Folds are paper friends. Each one was a mistake once, until someone fixed it. Mobi came from the very first fix, so he's the eldest. You start as one of these four."],
    ['Four ways to play', 'With Pro you can start any game. On Free you get one start in each Mob every week, and a friend with Pro can pass you the mic. Joining and playing are always free.'],
    ['See who did best', "After a game, the podium goes by CUET marks: +5 if right, −1 if wrong, 0 if you skip. Kabir skipped the one he wasn't sure of and beat Riya by a mark. Then everyone gets one highlight."],
    ['Fix it together', "When a game closes, the question that caught most of you becomes your Mob's to fix. See why, try a fresh one, and on Wednesday one more checks it held. If 2 of you pass, it's fixed."],
    ['Stitch a week together', "Answer 15 questions each in Mob games and papers, and the week is stitched onto your Mob's pennant. Nobody can break it alone. Your own chain needs 5 questions a day, and a rest pass covers a missed day."],
    ['Earned, never bought', "Your Mob's first weekly quest brings Hop to everyone in it. The rest come from real things you do, and each one goes on your shelf. None can be bought."],
  ];
  assert.equal(SLIDE_COUNT, 7);
  assert.deepEqual(slidesFor({ billingOn: true }).map((s) => [s.title, s.body]), want);
  const off = slidesFor({ billingOn: false });
  assert.equal(off[2].body, 'Anyone in your Mob can start a game. Joining and playing are always free.', 'billing off: no plan words');
  assert.doesNotMatch(off.map((s) => s.body).join(' '), /\bPro\b|\bFree\b/);
  assert.deepEqual(off.filter((_, i) => i !== 2).map((s) => s.body), want.filter((_, i) => i !== 2).map((w) => w[1]));
  assert.equal(SLIDE_COPY[2].soon, 'Coming soon.');
  assert.equal(SLIDE_COPY[2].soonLine, 'Live rooms, where everyone starts on one 3, 2, 1.');
  assert.deepEqual(PLAY_CARDS.map((c) => [c.label, c.figure || (c.chips ? c.chips.join(' ') : null), c.line, c.foot]), [
    ['Sprint', '5', 'questions', 'Open for 24 hours'],
    ['Your own round', '10 15 20', 'Pick a chapter and a length', 'Open for 24 hours'],
    ['Rematch', null, 'The same chapter and length, one more go', 'Open for 24 hours'],
    ["This week's Mob paper", '10', 'questions in 10 minutes', 'The same paper for everyone. Until Sunday 11:59 PM'],
  ]);
  assert.equal(EXPLAINER_COPY.replayRow, 'How the Mob works');
  assert.equal(EXPLAINER_COPY.replayLine, 'Watch the 7 slides again');
  assert.equal(liveLine(slidesFor({ billingOn: false }), 2), '3 of 7. Four ways to play. Anyone in your Mob can start a game. Joining and playing are always free. Coming soon. Live rooms, where everyone starts on one 3, 2, 1.');
});

test('live rooms appear only as the Coming soon line; copy rules hold', () => {
  const all = slidesFor({ billingOn: true });
  const text = all.map((s) => `${s.title} ${s.body}`).join(' ') + PLAY_CARDS.map((c) => `${c.label} ${c.line} ${c.foot}`).join(' ');
  assert.doesNotMatch(text, /live room/i, 'no live room outside the Coming soon line');
  assert.doesNotMatch(text, /\brace\b|ghost/i, 'K9: no race wording');
  assert.doesNotMatch(text + Object.values(SETUP_COPY).join(' '), /!|→|₹|\bprice\b|\blost\b|\bbehind\b|\bhurry\b|\blast chance\b|unlock|seamless|elevate/i);
});

test('every claim on the slides is true in this build (the truth table)', () => {
  assert.equal(MAX_MEMBERS, 5, 'you and up to 4 friends');
  assert.deepEqual(COUNTS.sprint, [5], 'a sprint is 5 questions');
  assert.deepEqual(COUNTS.round, [10, 15, 20], 'your own round is 10, 15 or 20');
  assert.match(read('supabase/migrations/20261020100100_mob_v3_games.sql'), /p_now \+ interval '24 hours'/, 'a game is open 24 hours');
  assert.match(read('src/lib/server/mob/games.js'), /count = prev\.question_ids\.length; chapter = prev\.chapter \|\| null;/, 'a rematch keeps the length and chapter');
  assert.equal(PAPER_COUNT, 10); assert.equal(PAPER_COUNT * RUNNER_SECONDS_PER_QUESTION, 600, '10 questions in 10 minutes');
  assert.deepEqual([...STARTERS], ['dart', 'dogear', 'hexa', 'kandil'], 'you start as one of these four');
  assert.equal(PER_MEMBER, 15); assert.equal(DAY_GOAL, 5);
  // billing on: Pro starts anything; Free one async start a week per Mob; a mic from Pro. Billing off: anyone.
  assert.equal(startRight({ billingOn: false, pro: false, mode: 'async', format: 'sprint', claimUsed: true, micsHeld: 0, liveOn: false, inLiveHours: true }).ok, true);
  assert.equal(startRight({ billingOn: true, pro: true, mode: 'async', format: 'round', claimUsed: true, micsHeld: 0, liveOn: false, inLiveHours: true }).ok, true);
  assert.equal(startRight({ billingOn: true, pro: false, mode: 'async', format: 'sprint', claimUsed: false, micsHeld: 0, liveOn: false, inLiveHours: true }).via, 'free_weekly');
  assert.equal(startRight({ billingOn: true, pro: false, mode: 'async', format: 'sprint', claimUsed: true, micsHeld: 0, liveOn: false, inLiveHours: true }).ok, false);
  assert.equal(startRight({ billingOn: true, pro: false, mode: 'async', format: 'sprint', claimUsed: true, micsHeld: 1, liveOn: false, inLiveHours: true }).via, 'mic');
  assert.match(read('src/lib/server/mob/deps.js'), /MOB_LIVE_ENABLED === 'true'/, 'live rooms stay behind their switch');
  assert.match(read('src/lib/server/mob/games.js'), /FIXED_FOR_CRANE = 3/);
});

test('slide 4: the podium by CUET marks, and each highlight is the one assignMoments gives the fixture', () => {
  const rows = PODIUM_FIXTURE.rows;
  assert.deepEqual(rows.map((r) => marksOf(r.cells)), [20, 19, 15]);
  assert.deepEqual(MARK_FOR, { r: 5, w: -1, s: 0 });
  const runs = rows.map((r) => ({ userId: r.who, memberId: r.who, marks: marksOf(r.cells) }));
  assert.deepEqual(placeRuns(runs).map((r) => r.place), [1, 2, 3], 'Kabir beat Riya by a mark');
  const keyOf = { r: (p) => p, w: () => 0, s: () => -1 };
  const full = rows.map((r, i) => ({
    userId: r.who, memberId: r.who, place: i + 1, finishedAt: new Date(Date.UTC(2026, 9, 22, 9, 0, r.arrivals[4])).toISOString(),
    right: r.cells.filter((c) => c === 'r').length, wrong: r.cells.filter((c) => c === 'w').length,
    answers: r.cells.map((c, q) => ({ q, correct: c === 'r' ? true : c === 'w' ? false : null, elapsedMs: r.arrivals[q] * 1000, pick: c === 's' ? -1 : keyOf[c](r.picks[q]) })),
  }));
  const moments = assignMoments(full, { count: 5, trapQ: PODIUM_FIXTURE.trapQ });
  const kind = Object.fromEntries(moments.map((m) => [m.memberId, m.kind]));
  assert.deepEqual(kind, { kabir: 'fastest_right', riya: 'quickest_finish', you: 'no_minus' });
  assert.deepEqual(PODIUM_FIXTURE.highlights, { kabir: 'Fastest right answer', riya: 'Quickest finish', you: 'No minus marks' });
  const lines = read('src/components/mob/v3/play/playModel.mjs');
  for (const h of Object.values(PODIUM_FIXTURE.highlights)) assert.ok(lines.includes(h), `"${h}" is the start of the app's own moment line`);
});

test('the setup: a Fold is required, a listed name is required, the subject starts on the first one, the name is 2 to 18 letters', () => {
  const subjects = [{ id: 'accountancy', name: 'Accountancy' }, { id: 'economics', name: 'Economics' }];
  let st = initialSetup({ subjects, suggestedName: 'Aarav' });
  assert.deepEqual(st.steps, ['fold', 'name', 'subject', 'you']);
  assert.equal(st.fold, null); assert.equal(st.nameKey, null); assert.equal(st.subject, 'accountancy', 'the first subject, editable (T001)');
  assert.equal(st.name, 'Aarav'); assert.equal(st.colour, 0);
  assert.deepEqual(setupKey(st), { label: 'Pick your Fold', enabled: false });
  assert.equal(setupNext(st), st, 'no Fold, no step forward');
  st = { ...st, fold: 'hexa' };
  assert.deepEqual(setupKey(st), { label: 'Next', enabled: true });
  st = setupNext(st);
  assert.equal(stepOf(st), 'name');
  assert.deepEqual(setupKey(st), { label: "Pick your Mob's name", enabled: false });
  assert.deepEqual(setupKey({ ...st, nameKey: 99 }), { label: "Pick your Mob's name", enabled: false }, 'only a name from the list');
  st = setupNext({ ...st, nameKey: 3 });
  assert.equal(stepOf(st), 'subject');
  assert.deepEqual(setupKey(st), { label: 'Next', enabled: true });
  assert.equal(pennantShowsSubject(st), true);
  st = setupNext(st);
  assert.equal(stepOf(st), 'you'); assert.equal(isLastStep(st), true);
  assert.deepEqual(setupKey(st), { label: 'Start Steady Kites', enabled: true });
  for (const bad of ['', 'A', 'Aarav2', 'A'.repeat(19)]) assert.equal(setupKey({ ...st, name: bad }).enabled, false, `"${bad}" is not a name`);
  assert.equal(setupKey({ ...st, name: 'Al' }).enabled, true, '2 letters is enough');
  assert.equal(setupKey({ ...st, name: 'A'.repeat(18) }).enabled, true, '18 letters is the most');
  assert.equal(nameNote('Aarav2').bad, true); assert.equal(nameNote('A').bad, false, 'no rule while the student is still typing the first letters');
  assert.deepEqual(setupBody({ ...st, colour: 4 }), { subject: 'accountancy', name: 'Aarav', colour: 4, nameKey: 3, fold: 'hexa' }, 'the same fields as the D0a create call');
  assert.equal(setupBody({ ...st, fold: null }), null);
  assert.equal(setupBack({ ...st, at: 0 }), 'exit', 'Back on the first step returns to D0');
  assert.equal(stepOf(setupBack(st)), 'subject');
  assert.deepEqual(namesOnPage(0).names.map((n) => n.text), MOB_NAMES.slice(0, 6));
  assert.deepEqual(namesOnPage(1).names[0], { key: 6, text: MOB_NAMES[6] });
  assert.equal(namesOnPage(4).page, 0, 'Show six more wraps to the first six');
  assert.equal(checkName(setupBody(st).name).ok, true);
  assert.equal(SETUP_COPY.under, 'Next, you can invite up to 4 friends.');
  assert.equal(SETUP_COPY.youNote, 'Only your Mob sees it. 2 to 18 letters.');
});

test('D168/D169: no step a student does not need; the dots count only theirs', () => {
  const four = [{ id: 'accountancy', name: 'Accountancy' }, { id: 'economics', name: 'Economics' }];
  const one = [{ id: 'accountancy', name: 'Accountancy' }];
  assert.deepEqual(setupSteps({ subjects: four }), ['fold', 'name', 'subject', 'you']);
  assert.deepEqual(setupSteps({ subjects: one }), ['fold', 'name', 'you'], 'one subject: no subject step');
  assert.deepEqual(setupSteps({ subjects: four, seatFold: 'kandil' }), ['name', 'subject', 'you'], 'a seat Fold: no Fold step');
  assert.deepEqual(setupSteps({ subjects: one, seatFold: 'kandil' }), ['name', 'you']);
  let st = initialSetup({ subjects: one, suggestedName: 'Zoya', seatFold: 'kandil' });
  assert.equal(st.fold, 'kandil', 'sits as the seat Fold');
  assert.equal(st.subject, 'accountancy', 'the one subject, preselected');
  assert.equal(pennantShowsSubject(st), true, 'and on the pennant from the start');
  st = setupNext({ ...st, nameKey: 0 });
  assert.equal(stepOf(st), 'you');
  assert.equal(SETUP_COPY.playAs('Kandil'), 'You play as Kandil');
  // Change: the Fold step, and back to the last step when done
  let ch = changeFold(st);
  assert.equal(stepOf(ch), 'fold');
  assert.deepEqual(ch.steps, ['fold', 'name', 'you']);
  ch = setupNext({ ...ch, fold: 'hexa' });
  assert.equal(stepOf(ch), 'you', 'Next returns to the step Change came from');
  assert.equal(ch.fold, 'hexa');
  assert.equal(stepOf(setupBack(changeFold(st))), 'you', 'Back from the change returns there too');
  assert.deepEqual(setupBody(ch), { subject: 'accountancy', name: 'Zoya', colour: 0, nameKey: 0, fold: 'hexa' });
  const sheet = initialSetup({ subjects: four });
  assert.equal(pennantShowsSubject(sheet), false, 'with a subject step the pennant waits for it');
});

test('reduced motion keeps every slide\'s order, at half the delay or less, with squash, particles, sheen and loops left out', () => {
  for (let i = 0; i < SLIDE_COUNT; i += 1) {
    const full = beatOrder(i); const rm = beatOrder(i, { reduced: true });
    assert.deepEqual(rm, full.filter((k) => rm.includes(k)), `slide ${i + 1}: same order`);
    const t = timeline(i); const r = timeline(i, { reduced: true });
    for (const k of Object.keys(r)) assert.ok(r[k] <= t[k], `slide ${i + 1} ${k}: never later than the full beat`);
    assert.ok(Math.max(...Object.values(r)) <= Math.max(...Object.values(t)) * 0.6, `slide ${i + 1}: the reduced slide is done in well under the full time`);
    // the builders pass buildTimes to the motion kit, which halves under reduced motion
    const b = buildTimes(i, { reduced: true });
    for (const k of Object.keys(r)) assert.equal(b[k] * 0.5, r[k], `slide ${i + 1} ${k}`);
  }
  assert.equal(timeline(1, { reduced: true }).corners, undefined, 'no folding corners under reduced motion');
  assert.equal(timeline(3, { reduced: true }).sheen, undefined, 'no sheen');
  assert.deepEqual([timeline(3, { reduced: true }).third, timeline(3, { reduced: true }).second, timeline(3, { reduced: true }).first], [1000, 1300, 1600], 'the plinths 300 ms apart: third, second, first');
  assert.ok(timeline(3).hl0 > timeline(3).first, 'the highlights come after the podium');
  assert.ok(timeline(5).stitch > timeline(5).done, 'the stitch never plays before Quest done (F13)');
});

test('the wiring: D0 gates Start and Join, the replay row and link exist, the invite page leads with the Mob name', () => {
  const start = read('src/components/mob/den/DenStart.jsx');
  assert.match(start, /explainerSeen\(userId\)/);
  assert.match(start, /EXPLAINER_COPY\.link/);
  assert.doesNotMatch(start, /function StartSheet/, 'the long D0a sheet is replaced by the setup');
  assert.match(read('src/components/mob/v3/explainer/MobSetup.jsx'), /run\('\/api\/mob', body, \{ name: 'create' \}\)/, 'the same create call');
  const page = read('src/components/mob/MobPage.jsx');
  assert.match(page, /EXPLAINER_COPY\.replayRow/);
  assert.match(page, /mode="replay"/);
  assert.match(read('src/components/mob/JoinMob.jsx'), /mode="invite"[^>]*mobName=\{info\?\.name \|\| null\}/);
  assert.match(read('src/app/(app)/mob/page.jsx'), /billingOn=\{playBillingEnabled\(\)\}/, 'the billing flag comes from the server');
  const flow = read('src/components/mob/v3/explainer/MobFlow.jsx');
  assert.match(flow, /onEscape=\{\(\) => closeRef\.current\?\.\('d0'\)\}/, 'Escape returns to D0');
  assert.match(flow, /if \(marksSeen\(how\)\) mark\(\)/);
  const ex = read('src/components/mob/v3/explainer/MobExplainer.jsx');
  assert.match(ex, /aria-roledescription="carousel"/);
  assert.match(ex, /aria-roledescription="slide"/);
  assert.match(ex, /aria-live="polite"/);
  const css = read('src/components/mob/v3/explainer/explainer.css');
  assert.doesNotMatch(css, /transition:\s*all\b|backdrop-filter|text-transform:\s*uppercase|conic-gradient/i);
  assert.match(css, /\.mx-skip \{[^}]*height: 44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
