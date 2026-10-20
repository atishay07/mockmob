// The web den (Mob v3 on the website, MOB-BUILD-SPEC-V3 5.3 D0 to D6, D0a, J1, SET, P1 to P5, C1, C2, S1, K1 to K5).
// Pure logic (denModel.mjs), the app's sentences (denCopy.mjs) and the copy and safety lint over every den file:
// no exclamation marks, arrows, emoji or 24-hour times; no price or plan in the Mob (F4, spec 6.6); no late-night framing
// (C-4); no count of non-players (F2); and the styles keep reduced motion and 44 px targets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenCopy, MobTime, denError, joinNames, FOLD_NAMES, FOLD_LINES, FOLD_RULES } from '../../src/lib/mob/v3/denCopy.mjs';
import { denState, momentQueue, parseJoinInput, joinBoxes, questSegments, questEach, whatsAppHref, passNotice, namePage, foldSrc, foldHeadSrc, pickableFolds, liveOffer, openGames, yourRunAt } from '../../src/lib/mob/v3/denModel.mjs';
import { FOLDS } from '../../src/lib/mob/folds.mjs';
import { MOB_NAMES } from '../../src/lib/mob/names.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const fx = (name) => JSON.parse(read(`data/tests/fixtures/mob_v3/${name}.json`));
const denDir = 'src/components/mob/den';
const denFiles = readdirSync(resolve(root, denDir)).filter((f) => /\.(jsx|js)$/.test(f)).map((f) => `${denDir}/${f}`);
const copyFiles = [...denFiles, 'src/lib/mob/v3/denCopy.mjs'];

function visibleText(source) {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const out = [];
  for (const m of noComments.matchAll(/(?<![=-])>([^<>{}=;()]+)</g)) out.push(m[1]);
  for (const m of noComments.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) out.push(m[2]);
  return out.map((t) => t.trim()).filter((t) => /[A-Za-z]/.test(t) && !/^[\w./:@#?&=${}()[\]-]+$/.test(t) && !t.startsWith('/') && !/\$\{[^}]*\}\//.test(t));
}

const NOW = Date.parse('2026-10-22T09:30:00.000Z'); // Thursday 22 Oct, 3:00 PM IST

test('IST, 12-hour times: today, tomorrow, yesterday and a named day', () => {
  assert.equal(MobTime.clock('2026-10-23T08:35:00.000Z'), '2:05 PM');
  assert.equal(MobTime.clock('2026-10-22T18:30:00.000Z'), '12:00 AM');
  assert.equal(MobTime.when('2026-10-23T08:35:00.000Z', NOW), '2:05 PM tomorrow');
  assert.equal(MobTime.when('2026-10-22T15:14:00.000Z', NOW), '8:44 PM');
  assert.equal(MobTime.when('2026-10-21T08:35:00.000Z', NOW), '2:05 PM yesterday');
  assert.equal(MobTime.when('2026-10-24T08:35:00.000Z', NOW), '2:05 PM on Saturday 24 Oct');
  assert.equal(MobTime.day('2026-10-27T18:30:00.000Z'), 'Wednesday 28 Oct');
  assert.equal(MobTime.weekdayOfKey('2026-10-16'), 'Friday');
});

test('the den picks one state and one game, and never counts who has not played (F2)', () => {
  const v3 = fx('den_get').mob.v3;
  // The fixture: one open game you finished, one closed.
  assert.equal(denState(v3).kind, 'played');
  assert.equal(denState(v3).game.id, 'uuid-1');
  const open = structuredClone(v3);
  open.games[0].yourRun = 'none';
  assert.equal(denState(open).kind, 'open');
  const quiet = { ...v3, games: [] };
  assert.equal(denState(quiet).kind, 'quiet');
  assert.equal(denState({ ...quiet, starts: fx('starts_used') }).kind, 'ask');
  const live = structuredClone(open);
  live.games[0].room = { state: 'lobby', startsAt: null };
  assert.equal(denState(live).kind, 'live');
  live.games[0].room = { state: 'running', startsAt: '2026-10-22T09:00:00.000Z' };
  assert.equal(denState(live).kind, 'room_running');
  assert.equal(denState({ ...quiet, members: v3.members.slice(0, 1) }).one, true);
  // Several open games: the one closing soonest you have not played leads; the rest are a link.
  const two = structuredClone(open);
  two.games[1] = { ...two.games[0], id: 'uuid-9', closesAt: '2026-10-22T20:00:00.000Z', yourRun: 'none' };
  assert.deepEqual(openGames(two).map((g) => g.id), ['uuid-9', 'uuid-1']);
  assert.equal(denState(two).game.id, 'uuid-9');
  assert.equal(denState(two).more, 1);
  assert.equal(DenCopy.moreOpen(1), '1 more game is open');
  assert.equal(DenCopy.moreOpen(2), '2 more games are open');
  assert.equal(yourRunAt(v3.games[0], 'member-3'), '2026-10-22T08:42:24.000Z');
});

test('the card copy is the app\'s: opened, the line, runs so far (finished runs with times), the key', () => {
  const g = { format: 'sprint', count: 5, chapter: 'Goodwill', subjectName: 'Accountancy', host: { memberId: 'm2', name: 'Riya' }, closesAt: '2026-10-23T08:35:00.000Z', runs: [{ name: 'Riya', at: '2026-10-22T08:40:00.000Z' }, { name: 'Kabir', at: '2026-10-22T11:25:00.000Z' }], youId: 'm3' };
  assert.equal(DenCopy.openedA(g), 'Riya opened a sprint');
  assert.equal(DenCopy.openLine(g, NOW), '5 Goodwill questions. Race the runs so far. Open until 2:05 PM tomorrow.');
  assert.equal(DenCopy.runsSoFar(g.runs, NOW), 'Runs so far: Riya, 2:10 PM. Kabir, 4:55 PM.');
  assert.equal(DenCopy.runsSoFar([], NOW), null);
  assert.equal(DenCopy.playKey(g), "Play Riya's sprint");
  assert.equal(DenCopy.gameTitle({ ...g, host: { memberId: 'm3', name: 'Aarav' } }), 'Your sprint');
  assert.equal(DenCopy.openLine({ ...g, runs: [], chapter: null }, NOW), '5 Accountancy questions. Be the first to set a run. Open until 2:05 PM tomorrow.');
  assert.equal(DenCopy.playedAt('2026-10-22T15:14:00.000Z', g.closesAt, NOW), 'You played at 8:44 PM. Places can change until 2:05 PM tomorrow.');
  assert.equal(DenCopy.denSubtitle('Accountancy', 4), 'Accountancy, 4 of you');
  assert.equal(DenCopy.denSubtitle('Accountancy', 1), 'Accountancy, just you');
  assert.equal(DenCopy.inviteCardLine('Accountancy', 'K7P 2M9'), 'An Accountancy Mob on MockMob. Code K7P 2M9.');
  assert.equal(DenCopy.inviteCardLine('Business Studies', 'K7P 2M9'), 'A Business Studies Mob on MockMob. Code K7P 2M9.');
});

test('the quest shows the true count past the goal (F8) and a full bar', () => {
  assert.equal(DenCopy.questCount({ answered: 51, target: 60 }), '51 of 60 questions');
  assert.equal(DenCopy.questCount({ answered: 70, target: 60 }), '70 answered. The quest needed 60.');
  assert.deepEqual(questSegments({ answered: 70, target: 60 }), { full: 12, part: 0, n: 12 });
  const s = questSegments({ answered: 51, target: 60 });
  assert.equal(s.full, 10);
  assert.ok(s.part > 0.19 && s.part < 0.21);
  assert.equal(questEach({ target: 60, sizedFor: 4 }), 15);
});

test('moments play in the spec order, once each, with their facts', () => {
  const q = momentQueue(['chain:14', 'reveal:hop', 'stitch:m:2026-10-19', 'quest_done:m:2026-10-19', 'bogus:1']);
  assert.deepEqual(q.map((m) => m.kind), ['quest_done', 'stitch', 'reveal', 'chain']);
  assert.equal(q[2].fold, 'hop');
  assert.equal(q[3].days, 14);
  assert.equal(DenCopy.questDoneLine('Chai Circle', 70, 60, 4), 'Chai Circle answered 70 questions this week. The quest needed 60, so week 4 of your chain is stitched.');
  assert.equal(DenCopy.stitchedLine('Chai Circle', 4, 4), "Chai Circle finished this week's quest together, so week 4 is stitched for all four of you.");
  assert.equal(DenCopy.revealFact('Chai Circle', 'hop'), 'Chai Circle finished its first weekly quest, so everyone in it gets Hop. Nobody can buy him.');
  assert.equal(DenCopy.rewardFor('desk_bell'), 'A desk bell for your den');
  assert.equal(DenCopy.milestoneLine({ days: 14, practised: 13, rested: 1, best: 14 }), 'You practised 13 of them and rested 1. It is your best run so far.');
  assert.equal(DenCopy.passNotice('Friday', 12), 'Friday was covered by a rest pass. Your chain is still 12.');
  const chain = { notices: [{ key: 'rest:2026-10-16', kind: 'rested', day: '2026-10-16', days: 12 }] };
  assert.equal(passNotice(chain, []).key, 'rest:2026-10-16');
  assert.equal(passNotice(chain, ['rest:2026-10-16']), null);
  assert.equal(passNotice({ ...chain, hidden: true }, []), null);
});

test('J1 codes: 6 boxes, 8 for an old code, a pasted link, Crockford reading', () => {
  assert.deepEqual(parseJoinInput('k7p 2m9'), { chars: 'K7P2M9', code: 'K7P2M9' });
  assert.deepEqual(parseJoinInput('https://www.mockmob.in/join/MR1SNQ'), { chars: 'MR1SNQ', code: 'MR1SNQ' });
  assert.equal(parseJoinInput('7kq2-m9xr').code, '7KQ2M9XR');
  assert.equal(parseJoinInput('MRISNO').code, 'MR1SN0');
  assert.equal(parseJoinInput('K7P').code, null);
  assert.equal(joinBoxes('K7P2M9'), 6);
  assert.equal(joinBoxes('7KQ2M9XR'), 8);
});

test('names six at a time from the kind list, and Folds with their art and fallbacks', () => {
  assert.equal(MOB_NAMES.length, 24);
  assert.deepEqual(namePage(MOB_NAMES, 0).names.map((n) => n.text), MOB_NAMES.slice(0, 6));
  assert.equal(namePage(MOB_NAMES, 4).page, 0);
  assert.equal(namePage(MOB_NAMES, 3).names[0].key, 18);
  for (const key of Object.keys(FOLDS)) {
    assert.ok(FOLD_NAMES[key] && FOLD_RULES[key], key);
    assert.equal(FOLD_LINES[key], FOLDS[key].line, `${key}: the shelf line matches the server's earn table`);
    for (const pose of ['idle', 'cheer', 'think', 'shrug', 'wave']) assert.ok(existsSync(resolve(root, 'public', foldSrc(key, pose).slice(1))), `${key} ${pose}`);
    assert.ok(existsSync(resolve(root, 'public', foldHeadSrc(key).slice(1))), `${key} head`);
  }
  assert.equal(foldSrc('dart', 'shrug'), '/mob/folds/fold-dart-shrug@256.webp', 'shrug is drawn (20 Oct)');
  assert.equal(foldSrc('dart', 'wave'), '/mob/folds/fold-dart-wave@256.webp');
  assert.equal(foldSrc('stamp', 'wave'), '/mob/folds/fold-stamp-idle@256.webp', 'a pose with no art (Stamp wave) draws idle');
  assert.equal(foldSrc('dart', 'sleep'), '/mob/folds/fold-dart-idle@256.webp', 'an unknown pose draws idle');
  assert.equal(foldSrc('mobi'), null, 'an unknown Fold has no art: the caller draws the initial disc');
  for (const f of ['scene-empty-nothing-night', 'scene-empty-nothing-day', 'group-desk', 'parcel-sealed', 'parcel-pop', 'parcel-open', 'stamp-seal']) assert.ok(existsSync(resolve(root, `public/mob/art/${f}.webp`)), f);
  assert.deepEqual(pickableFolds(fx('shelf')), ['dart', 'dogear', 'hexa', 'kandil']);
});

test('start rules come from the server: live only when on, and in hours', () => {
  const v3 = fx('den_get').mob.v3;
  assert.deepEqual(liveOffer(v3), { show: true, can: true, hoursOk: true });
  assert.equal(liveOffer({ ...v3, live: { enabled: true, hoursOk: false } }).can, false);
  assert.equal(liveOffer({ ...v3, live: { enabled: false, hoursOk: true } }).show, false);
  assert.equal(liveOffer({ ...v3, starts: fx('starts_free') }).can, false, 'Free with billing on starts anytime games only');
});

test('errors: the server sentence first, offline, then the den\'s own', () => {
  assert.equal(denError({ ok: false, status: 0, code: 'NETWORK' }), "You're offline. Nothing changed.");
  assert.equal(denError({ ok: false, status: 409, code: 'START_USED', message: 'From the server.' }), 'From the server.');
  assert.equal(denError({ ok: false, status: 409, code: 'MIC_LIMIT' }), 'You passed the mic twice this week, the most a week allows. You can pass it again on Monday.');
  assert.equal(denError({ ok: false, status: 500, code: 'X' }), DenCopy.generic);
  assert.equal(denError({ ok: true }), null);
  assert.equal(joinNames(['Riya', 'Kabir', 'Zoya']), 'Riya, Kabir and Zoya');
  assert.equal(whatsAppHref('a b'), 'https://wa.me/?text=a%20b');
});

test('the den copy is plain: no arrows, exclamation marks, 24-hour times or emoji', () => {
  assert.ok(denFiles.length >= 8, denFiles.join(', '));
  for (const file of copyFiles) {
    for (const t of visibleText(read(file))) {
      assert.doesNotMatch(t, /[→⟶»←↗↘]|&rarr;|&larr;|->/, `${file}: ${t}`);
      assert.doesNotMatch(t, /[A-Za-z0-9.'’)]!(?!=)/, `${file}: an exclamation mark in "${t}"`);
      assert.doesNotMatch(t, /\b([01]\d|2[0-3]):[0-5]\d\b(?!\s?(AM|PM))/, `${file}: 24-hour time in "${t}"`);
      assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, `${file}: emoji in "${t}"`);
    }
  }
});

test('safety (spec 6): no price in the Mob, no late-night framing, no count of non-players, no pressure', () => {
  for (const file of copyFiles) {
    const source = read(file);
    for (const t of visibleText(source)) {
      assert.doesNotMatch(t, /₹|\bRs\.?\s?\d|\brupees?\b|\bINR\b|\$\d|per month|\/month|\bbuy (now|it|pro)\b|\bprice\b/i, `${file}: a price in "${t}"`);
      assert.doesNotMatch(t, /late night|all-nighter|night owl|up late|midnight|burn the/i, `${file}: late-night framing in "${t}"`);
      assert.doesNotMatch(t, /not played|hasn't played|has not played|haven't played|\d+ of \d+ (played|have played)|one more can play|waiting on you|hurry|streak at risk|\blost\b|last chance/i, `${file}: "${t}"`);
    }
    assert.doesNotMatch(source, /isPremium|user\??\.plan|user\??\.tier|subscription/, `${file} reads the account's plan`);
  }
  // Pro words only where the server's billing flag allows (P1, P4), and "See Pro plans" opens the existing pricing page.
  const sheets = read(`${denDir}/DenSheets.jsx`);
  assert.match(sheets, /href="\/pricing"/);
  // The D167 tiles carry the Pro tag only for a format the server locks with billing on (formatTiles' pro).
  assert.match(sheets, /t\.pro \? <span className=\"den-format__tag\">/);
  assert.match(read('src/components/mob/v3/play/formats.mjs'), /pro: Boolean\(s\.billingOn\) && locked\.has\(format\)/);
});

test('the den styles: reduced motion for every animation, no banned looks, 44 px targets', () => {
  const css = read(`${denDir}/den.css`);
  assert.doesNotMatch(css, /text-transform:\s*uppercase/i);
  assert.doesNotMatch(css, /transition:\s*all\b/i);
  assert.doesNotMatch(css, /backdrop-filter/i);
  assert.doesNotMatch(css, /text-shadow|drop-shadow/i);
  assert.doesNotMatch(css, /background-clip:\s*text/i);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:root\[data-motion='reduced'\]/);
  for (const sel of ['.den-chip', '.den-tool', '.den-stickerkey', '.den-seg__opt', '.den-tabs__tab', '.den-pcal__day', '.den-k__skip', '.den-key']) {
    const rule = css.match(new RegExp(`${sel.replace(/[.]/g, '\\.')} \\{[^}]*\\}`))?.[0] || '';
    assert.match(rule, /(min-)?(height|width):\s*(4[4-9]|[5-9]\d)px/, `${sel} has no 44 px floor`);
  }
  // The go-live wash and the reveal never use rays or a sunburst (F6).
  assert.doesNotMatch(css, /conic-gradient|sunburst|rays/i);
});

test('the web keeps today\'s Mob when v3 is off: the den draws only from the server\'s v3 block', () => {
  const page = read('src/components/mob/MobPage.jsx');
  assert.match(page, /const v3 = data\.v3 \|\| null/);
  assert.match(page, /\{v3 \? <DenV3 /);
  assert.match(page, /mob\.v3Available \? <DenStart /);
  const service = read('src/lib/server/mob/service.js');
  assert.match(service, /v3On\(\) \? \{ mob: null, v3Available: true \} : \{ mob: null \}/);
});
