// Mob v3 on the web, part 2 (playing a game): the words, the times, the ruler, the pace chip and the podium's
// reveal order, plus the safety rules of MOB-BUILD-SPEC-V3 section 6 that the page can hold on its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  COPY, STICKERS, clock, day, when, stopwatch, momentSentence, nextQuestionIndex, rightStreak, paceChip, ghostAt,
  rulerRacers, podiumLayout, countBases, shownMarks, PODIUM_END_MS, PODIUM_LAMP, lampGaps, lampVars, foldSrc, foldHeadSrc, FOLD_PAPER, joinNames, gameHref, GAME_VIEWS,
} from '../../src/components/mob/v3/play/playModel.mjs';
import * as den from '../../src/components/mob/den/denRoutes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fx = (name) => JSON.parse(readFileSync(path.join(root, 'data/tests/fixtures/mob_v3', `${name}.json`), 'utf8'));
const PLAY_DIR = path.join(root, 'src/components/mob/v3/play');

test('times are IST and 12-hour, relative to the day', () => {
  const now = '2026-10-22T08:42:24.000Z'; // 2:12 PM IST, Thursday 22 Oct
  assert.equal(clock('2026-10-22T08:35:00.000Z'), '2:05 PM');
  assert.equal(clock('2026-10-21T18:30:00.000Z'), '12:00 AM');
  assert.equal(when('2026-10-23T08:35:00.000Z', now), '2:05 PM tomorrow');
  assert.equal(when('2026-10-22T15:14:00.000Z', now), '8:44 PM');
  assert.equal(when('2026-10-21T08:35:00.000Z', now), '2:05 PM yesterday');
  assert.equal(day('2026-10-27T18:30:00.000Z'), 'Wednesday 28 Oct');
  assert.equal(stopwatch(131), '2:11');
  assert.equal(joinNames(['You', 'Kabir']), 'You and Kabir');
});

test('the copy is the app\'s: plain, no exclamation marks, arrows, prices or pressure words', () => {
  const now = Date.parse('2026-10-22T08:42:24.000Z');
  const game = fx('game_get').game;
  const words = [];
  for (const [key, v] of Object.entries(COPY)) {
    if (typeof v === 'string') words.push(v);
    else if (typeof v === 'function') {
      const args = {
        wrongLine: ['2026-10-23T08:35:00.000Z', now], placesCanChange: ['2026-10-23T08:35:00.000Z', now], answersOpenAt: ['2026-10-23T08:35:00.000Z', now],
        playedAt: ['2026-10-22T15:14:00.000Z', '2026-10-23T08:35:00.000Z', now], roomStarted: ['2026-10-22T15:23:00.000Z', '2026-10-23T15:22:00.000Z', now],
        openLine: [game, now], runsSoFar: [game.runs, now], gameTitle: [game], playKey: [game], tieLine: [{ place: 2, names: ['You', 'Kabir'], marks: 19 }],
        sharedTop: [['Riya', 'Kabir'], true], stepCheck: ['2026-10-27T18:30:00.000Z'], pathCheck: ['2026-10-27T18:30:00.000Z'], checkOpens: ['2026-10-27T18:30:00.000Z'],
        trapProgress: ['Chai Circle', 0, 3], together: [15, 20], bubbleLabel: ['B', true, false],
      }[key] || ['Riya', 3, 5];
      words.push(String(v(...args)));
    }
  }
  for (const w of words) {
    assert.ok(!w.includes('!'), `no exclamation mark: ${w}`);
    assert.ok(!/→|->|←|⟶/.test(w), `no arrow: ${w}`);
    assert.ok(!/₹|\bRs\b|price|buy\b|\bpay\b/i.test(w), `no price: ${w}`);
    assert.ok(!/\blost\b|\blast\b|waiting on you|hurry|streak at risk|late night|all-nighter|night owl|up late|midnight|burn the/i.test(w), `no pressure or night words: ${w}`);
  }
  assert.equal(COPY.wrongLine('2026-10-23T08:35:00.000Z', now), '-1 mark. The right answer and why open for everyone when the game closes at 2:05 PM tomorrow.');
  assert.equal(COPY.openLine(game, now), '5 Goodwill questions. Race the runs so far. Open until 2:05 PM tomorrow.');
  assert.equal(COPY.runsSoFar(game.runs, now), 'Runs so far: Riya, 2:07 PM. Kabir, 2:10 PM. Aarav, 2:12 PM.');
  assert.deepEqual(STICKERS.map((s) => s.label), ['Nice one', 'So close', 'Teach me', 'Again?']);
});

test('a run resumes at the first unanswered question, and three right in a row is a streak of 3', () => {
  const resume = fx('run_resume').run.answers;
  assert.equal(nextQuestionIndex(resume, 5), 3);
  assert.equal(nextQuestionIndex([], 5), 0);
  assert.equal(rightStreak(resume), 0);
  assert.equal(rightStreak([{ q: 0, correct: true, elapsedMs: 1 }, { q: 1, correct: true, elapsedMs: 2 }, { q: 2, correct: true, elapsedMs: 3 }]), 3);
});

test('the pace chip follows spec R4 and appears only after the first answer', () => {
  const ghosts = fx('run_start').ghosts;
  assert.equal(paceChip([], ghosts), null);
  // You answered question 1 at 41 s; Riya arrived at 30 s and Kabir at 33 s: Kabir is nearest, 8 s ahead of you.
  assert.equal(paceChip([{ q: 0, correct: true, elapsedMs: 41000 }], ghosts).text, '8 s behind Kabir');
  assert.equal(paceChip([{ q: 0, correct: true, elapsedMs: 26000 }], ghosts).text, '4 s ahead of Riya');
  assert.equal(paceChip([{ q: 0, correct: true, elapsedMs: 30200 }], ghosts).text, 'Level with Riya');
});

test('ghosts walk by their recorded arrivals and reach the flag at their finish', () => {
  const [riya] = fx('run_start').ghosts;
  assert.deepEqual(ghostAt(riya, 0, 5), { at: 1, finished: false, arrivedMs: 0 });
  assert.deepEqual(ghostAt(riya, 61000, 5), { at: 3, finished: false, arrivedMs: 60000 });
  assert.equal(ghostAt(riya, 150000, 5).finished, true);
});

test('two Folds on one number stand in depth: the later arrival 10 px up, at 0.86 and 70% brightness', () => {
  const ghosts = fx('run_start').ghosts;
  const racers = rulerRacers({ count: 5, ghosts, you: { fold: 'dart', answered: 0, arrivedMs: 0 }, t: 40000 });
  const riya = racers.find((r) => r.name === 'Riya');
  const kabir = racers.find((r) => r.name === 'Kabir');
  assert.equal(riya.at, 2);
  assert.equal(kabir.at, 2);
  assert.deepEqual([riya.depth, riya.lift, riya.scale, riya.brightness], [0, 0, 1, 1]);
  assert.deepEqual([kabir.depth, kabir.lift, kabir.scale, kabir.brightness], [1, 10, 0.86, 0.7]);
  assert.ok(racers.every((r) => !('pick' in r) && !('correct' in r) && !('marks' in r)), 'the ruler never carries a pick, a mark or right and wrong');
  assert.ok(racers.filter((r) => r.ghost).length === 2);
});

test('the podium: shared places, the floor, the switch off, and only you', () => {
  const now = Date.parse('2026-10-22T08:42:24.000Z');
  const closed = podiumLayout(fx('podium_closed'), now);
  assert.equal(closed.mode, 'podium');
  assert.equal(closed.title, 'Riya came first');
  assert.equal(closed.sub, 'Final');
  assert.equal(closed.line, null);
  assert.equal(closed.tieLine, 'You and Kabir tie on 19, so you share second.');
  assert.equal(closed.together, 'Your Mob got 15 of 20 right together.');
  assert.deepEqual(closed.stage.map((p) => p.shownName), ['You', 'Riya', 'Kabir'], 'the first stands in the middle');
  assert.equal(closed.stage[0].height, closed.stage[2].height, 'a shared place has two plinths of one height');
  assert.deepEqual(closed.floor.map((p) => p.name), ['Zoya']);
  const soFar = podiumLayout(fx('podium_so_far'), Date.parse('2026-10-22T08:42:24.000Z'));
  assert.equal(soFar.title, 'Riya is on top so far');
  assert.equal(soFar.line, 'Places can change until 2:05 PM tomorrow.');
  const off = podiumLayout({ ...fx('podium_closed'), showPodium: false, tie: null, places: fx('podium_closed').places.map(({ place, floor, ...p }) => p) }, now);
  assert.equal(off.mode, 'table');
  assert.equal(off.title, "Everyone's marks");
  assert.equal(off.stage.length, 0);
  const only = podiumLayout({ ...fx('podium_so_far'), places: [{ ...fx('podium_so_far').places[2], place: 1 }] }, now);
  assert.equal(only.mode, 'only');
  assert.equal(only.title, "You're the first to finish.");
  const priv = podiumLayout({ ...fx('podium_closed'), tie: null, places: fx('podium_closed').places.map((p) => (p.name === 'Kabir' ? { ...p, marks: null, place: undefined } : p)) }, now);
  assert.ok(priv.floor.some((p) => p.name === 'Kabir' && p.private), 'private marks stand on the floor with no place');
});

test('the podium order is true in every frame (F10): each count rolls up from the place below', () => {
  for (const name of ['podium_closed', 'podium_so_far']) {
    const layout = podiumLayout(fx(name), Date.now());
    const bases = countBases(layout.stage, layout.floor);
    assert.ok([...bases.values()].every((b) => Number.isFinite(b)));
    for (let t = 0; t <= PODIUM_END_MS; t += 10) {
      const shown = layout.stage.map((p) => ({ place: p.place, v: shownMarks(p, t) })).filter((s) => s.v !== null);
      for (const a of shown) for (const b of shown) if (a.place < b.place) assert.ok(a.v >= b.v, `${name} t=${t}: place ${a.place} shows ${a.v} under ${b.v}`);
      const floorTop = Math.max(0, ...layout.floor.map((f) => f.marks ?? 0));
      for (const s of shown) assert.ok(s.v >= floorTop || layout.floor.length === 0, `${name} t=${t}: a plinth never shows less than the floor`);
    }
    for (const p of layout.stage) assert.equal(shownMarks(p, PODIUM_END_MS), p.marks, 'every count lands on the server\'s marks');
  }
});

test('the first place stands under the lamp and never reaches its edge (owner leftover 20 Oct)', () => {
  const g = lampGaps();
  // At rest the Fold box sits clear + hop under the lamp; the hop still leaves 24 px or more; the drop starts below it.
  assert.ok(g.rest >= 40, `rest gap ${g.rest}`);
  assert.ok(g.hop >= 24, `hop gap ${g.hop}`);
  assert.ok(g.dropStart >= PODIUM_LAMP.minGap, `the first place's drop starts ${g.dropStart} px under the lamp`);
  assert.ok(PODIUM_LAMP.firstDrop < PODIUM_LAMP.drop && PODIUM_LAMP.firstDrop >= 24, 'the first place still drops, a shorter way');
  const vars = lampVars();
  assert.deepEqual(Object.keys(vars).sort(), ['--pod-bulb', '--pod-clear', '--pod-drop', '--pod-first-drop', '--pod-hop']);
  // The stage reserves the lamp, the clearance and the hop above its tallest Fold; the drop and the hop read the same variables.
  const css = readFileSync(path.join(PLAY_DIR, 'play.css'), 'utf8');
  assert.match(css, /\.mp-pod__stage--podium \{ padding-top: calc\(var\(--pod-bulb, 20px\) \+ var\(--pod-clear, 32px\) \+ var\(--pod-hop, 14px\)\); \}/);
  assert.match(css, /\.mp-plinth\.is-first \.mp-plinth__fold \{ --drop: var\(--pod-first-drop, 36px\); \}/);
  assert.match(css, /@keyframes mp-crown-hop[^\n]*var\(--pod-hop, 14px\)/);
  assert.match(css, /mp-drop \{ from \{[^}]*var\(--drop, 60px\)/);
  const jsx = readFileSync(path.join(PLAY_DIR, 'Podium.jsx'), 'utf8');
  assert.match(jsx, /style=\{LAMP_VARS\}/);
  // The squash waits for the drop (fill forwards, not both): with both, its first frame held every Fold squashed in place
  // through the drop, so the drop never showed.
  assert.match(css, /mp-drop 220ms var\(--mp-leave\) 420ms forwards, mp-squash 400ms var\(--mp-celebrate\) 640ms forwards;/);
});

test('moments are the fixed positive kinds from the server', () => {
  const moments = fx('podium_closed').moments;
  assert.deepEqual(moments.map((m) => momentSentence(m, 5)), [
    'Three right in a row: questions 1 to 3.', 'Played all 5.', 'Fastest right answer: question 1 in 10 seconds.', 'Played all 5.',
  ]);
  assert.equal(momentSentence({ kind: 'quickest_finish', count: 5, seconds: 165 }, 5), 'Quickest finish: all 5 in 2:45.');
  assert.equal(momentSentence({ kind: 'all_right', count: 5 }, 5), 'All 5 right.');
  assert.equal(momentSentence({ kind: 'no_minus' }, 5), 'No minus marks.');
});

test('F1: the run never reads a right answer or an explanation; the trap is never a count', () => {
  const run = readFileSync(path.join(PLAY_DIR, 'GameRun.jsx'), 'utf8');
  const ruler = readFileSync(path.join(PLAY_DIR, 'RulerRace.jsx'), 'utf8');
  for (const src of [run, ruler]) assert.ok(!/correctIndex|explanation/.test(src), 'no correct option or explanation in the run');
  const moments = readFileSync(path.join(PLAY_DIR, 'Moments.jsx'), 'utf8');
  assert.ok(!/trap\.(count|of)\b/.test(moments), 'the trap line never prints a count of who picked it');
  assert.ok(/!closed \?/.test(moments) || /closed \?/.test(moments));
  const fix = readFileSync(path.join(PLAY_DIR, 'FixTogether.jsx'), 'utf8');
  assert.ok(!/picks|members\b/.test(fix), 'Fix it together shows only your own pick');
});

test('the page exists only with MOB_ENABLED and MOB_V3_ENABLED, and the game is a focus place', () => {
  const page = readFileSync(path.join(root, 'src/app/(app)/mob/game/[id]/page.jsx'), 'utf8');
  assert.match(page, /MOB_ENABLED !== 'true' \|\| process\.env\.MOB_V3_ENABLED !== 'true'\) notFound\(\)/);
  const shell = readFileSync(path.join(root, 'src/app/(app)/AppLayoutClient.jsx'), 'utf8');
  assert.match(shell, /activePath\.startsWith\('\/mob\/game\/'\)/);
  const preview = readFileSync(path.join(root, 'src/app/preview/mob-play/page.jsx'), 'utf8');
  assert.match(preview, /NODE_ENV === 'production'\) notFound\(\)/);
});

test('every Fold has its web stills and head (public/mob/folds), with a fallback for a missing one', () => {
  const dir = path.join(root, 'public/mob/folds');
  const files = new Set(readdirSync(dir));
  for (const key of Object.keys(FOLD_PAPER)) {
    for (const pose of ['idle', 'cheer', 'think', 'shrug', 'wave']) assert.ok(files.has(path.basename(foldSrc(key, pose))), `${key} ${pose}`);
    for (const size of [40, 64]) assert.ok(existsSync(path.join(root, 'public', foldHeadSrc(key, size))), `${key} head ${size}`);
  }
  // One set for the whole website: the den's names (fold-<key>-<pose>@<size>.webp), nothing else in the folder.
  assert.equal(foldSrc('dart', 'idle'), '/mob/folds/fold-dart-idle@256.webp');
  assert.equal(foldHeadSrc('dart', 40), '/mob/folds/fold-dart-head@128.webp');
  assert.equal(foldHeadSrc('dart', 64), '/mob/folds/fold-dart-head@256.webp');
  for (const f of files) assert.match(f, /^fold-[a-z]+-(idle|cheer|think|shrug|wave|head|idle-blink)@(128|256|512)\.webp$/, `${f} follows the one naming`);
  assert.equal(foldSrc('dart', 'shrug'), '/mob/folds/fold-dart-shrug@256.webp', 'shrug is drawn (20 Oct)');
  assert.equal(foldSrc('stamp', 'wave'), '/mob/folds/fold-stamp-idle@256.webp', 'Stamp has no wave yet: idle');
  assert.equal(foldSrc('unknown'), null, 'an unknown Fold gives no file, so the initial disc shows');
});

test('the den links into the game screens by one contract (gameHref), and every /mob/folds file named in the source exists', () => {
  const id = '3f2b8c1e-5d4a-4b7e-9c10-2a6d7e8f9a0b';
  assert.deepEqual(GAME_VIEWS, ['run', 'podium', 'moments', 'fix']);
  assert.equal(gameHref(id, 'run', '?play=1'), `/mob/game/${id}?play=1`);
  assert.equal(gameHref(id, 'podium'), `/mob/game/${id}?view=podium`);
  assert.equal(den.gameHref(id), `/mob/game/${id}?play=1`, "the sprint key starts the run");
  assert.equal(den.gameCardHref(id), `/mob/game/${id}`, 'a card link never starts the clock');
  assert.equal(den.podiumHref(id), `/mob/game/${id}?view=podium`);
  assert.equal(den.momentsHref(id), `/mob/game/${id}?view=moments`);
  assert.equal(den.fixHref(id), `/mob/game/${id}?view=fix`);
  assert.equal(den.DEN_HREF, '/mob');
  for (const href of [den.gameHref(id), den.podiumHref(id), den.fixHref(id)]) assert.equal((href.match(/\?/g) || []).length, 1, `${href} has one query`);
  // The MobGame component re-exports the same contract and the server page reads the views from the pure module.
  assert.match(readFileSync(path.join(PLAY_DIR, 'MobGame.jsx'), 'utf8'), /export \{ GAME_VIEWS, gameHref \}/);
  assert.match(readFileSync(path.join(root, 'src/app/(app)/mob/game/[id]/page.jsx'), 'utf8'), /GAME_VIEWS \} from '@\/components\/mob\/v3\/play\/playModel\.mjs'/);
  // No broken Fold paths: a literal file name in the source exists; a built one (a template) is covered by the loop above.
  const files = new Set(readdirSync(path.join(root, 'public/mob/folds')));
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const f of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'data/tests'))].filter((x) => /\.(jsx?|mjs|css)$/.test(x))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\/mob\/folds\/(fold-[a-z0-9@.-]+\.webp)/g)) assert.ok(files.has(m[1]), `${path.relative(root, f)} names ${m[1]}, which is not in public/mob/folds`);
  }
});

// ---------------------------------------------------------------------------------------------------
// D167 (20 Oct): a timed race and a full mock together, as two more tiles in the one "Start a game" sheet (D168: no new
// screens). The race reuses the run, the podium and the moments; the full mock the full-mock runner and the podium.
// ---------------------------------------------------------------------------------------------------
const formats = await import('../../src/components/mob/v3/play/formats.mjs');
const { FORMAT_COPY, formatTiles, startBody, raceClock, racePace, ghostCountAt, raceWindow, raceRacers, raceLabelled, mockRunnerHref, MOCK, RACE_MINUTES } = formats;

test('D167 F-1 the tiles follow the server: billing off opens all four; a free member sees the full mock locked with Pro; no formats, no new tiles', () => {
  const open = formatTiles({ billingOn: false, can: true, formats: ['sprint', 'round', 'rematch', 'race', 'mock'], locked: [] });
  assert.deepEqual(open.map((t) => [t.format, t.can, t.locked, t.pro]), [['sprint', true, false, false], ['race', true, false, false], ['round', true, false, false], ['mock', true, false, false]]);
  const free = formatTiles({ billingOn: true, can: true, via: 'free_weekly', formats: ['sprint', 'round', 'race'], locked: ['mock'] });
  assert.deepEqual(free.map((t) => [t.format, t.can, t.pro]), [['sprint', true, false], ['race', true, false], ['round', true, false], ['mock', false, true]]);
  // MOB_FORMATS_ENABLED off: the server offers neither, and the sheet shows today's two tiles only.
  assert.deepEqual(formatTiles({ billingOn: false, can: true, formats: ['sprint', 'round'] }).map((t) => t.format), ['sprint', 'round']);
  // Your start used: nothing can start, and with billing off no tile says Pro.
  assert.equal(formatTiles({ billingOn: false, can: false, formats: ['sprint', 'race', 'mock'] }).some((t) => t.can || t.pro), false);
});

test('D167 F-2 the start body: a race is 5 or 10 minutes, a full mock is always anytime and the whole subject, live only when allowed', () => {
  assert.deepEqual(startBody({ format: 'race', minutes: 10, mode: 'live', chapter: 'Goodwill', liveAllowed: true }), { format: 'race', minutes: 10, mode: 'live', chapter: 'Goodwill' });
  assert.deepEqual(startBody({ format: 'race', minutes: 7, mode: 'live', liveAllowed: false }), { format: 'race', minutes: 5, mode: 'async', chapter: null });
  assert.deepEqual(startBody({ format: 'mock', mode: 'live', chapter: 'Goodwill', liveAllowed: true }), { format: 'mock', mode: 'async' });
  assert.deepEqual(startBody({ format: 'round', count: 15, mode: 'async' }), { format: 'round', mode: 'async', count: 15, chapter: null });
  assert.deepEqual(startBody({ format: 'sprint', count: 20 }), { format: 'sprint', mode: 'async', count: 5, chapter: null });
  assert.equal(startBody({ format: 'sprint', rematchOf: 'g1', count: 5 }).format, 'rematch');
  assert.deepEqual([...RACE_MINUTES], [5, 10]);
});

test('D167 F-3 the race clock: time left in m:ss on the server clock; it warms in the last half-minute; never below zero', () => {
  const ends = Date.parse('2026-10-22T08:45:00.000Z');
  assert.deepEqual(raceClock(ends, ends - 272_000), { left: 272_000, text: '4:32', low: false, over: false });
  assert.equal(raceClock(ends, ends - 29_500).low, true);
  assert.equal(raceClock(ends, ends - 29_500).text, '0:30');
  assert.deepEqual(raceClock(ends, ends + 5000), { left: 0, text: '0:00', low: false, over: true });
});

test('D167 F-4 the race pace chip: questions answered against the nearest ghost at the same moment of the run', () => {
  const ghosts = [{ memberId: 'a', name: 'Riya', arrivalsMs: [9000, 18000, 27000, 36000, 45000] }, { memberId: 'b', name: 'Kabir', arrivalsMs: [15000, 30000] }];
  assert.equal(ghostCountAt(ghosts[0], 27_000), 3);
  assert.equal(ghostCountAt(ghosts[0], 26_999), 2);
  assert.equal(racePace(0, 10_000, ghosts), null);
  assert.equal(racePace(3, 27_000, ghosts).text, 'Level with Riya');
  assert.equal(racePace(5, 30_000, ghosts).text, '2 questions ahead of Riya');
  assert.equal(racePace(1, 40_000, [ghosts[0]]).text, '3 questions behind Riya');
  assert.equal(racePace(3, 31_000, [ghosts[1]]).text, '1 question ahead of Kabir');
});

test('D167 F-5 the race ruler: no flag, a window that grows in fives with the leader, depth on a shared number, a ghost stops at its time', () => {
  assert.equal(raceWindow(1, 30), 10);
  assert.equal(raceWindow(9, 30), 15);
  assert.equal(raceWindow(29, 30), 30);
  assert.equal(raceWindow(80, 60), 60);
  assert.equal(raceLabelled(1, 20, 7), true);
  assert.equal(raceLabelled(15, 20, 7), true);
  assert.equal(raceLabelled(7, 20, 7), true);
  assert.equal(raceLabelled(8, 20, 7), false);
  assert.equal(raceLabelled(8, 10, 2), true);
  assert.equal(raceLabelled(15, 30, 3), false);
  assert.equal(raceLabelled(20, 30, 3), true);
  const ghosts = [{ memberId: 'r', name: 'Riya', fold: 'kandil', colour: 3, arrivalsMs: [10_000, 20_000, 30_000] }];
  let view = raceRacers({ ghosts, you: { fold: 'dart', answered: 2, arrivedMs: 21_000 }, t: 25_000, minutes: 5, pool: 30 });
  assert.equal(view.window, 10);
  const at = Object.fromEntries(view.racers.map((r) => [r.name, [r.at, r.depth, r.finished]]));
  assert.deepEqual(at, { Riya: [3, 0, false], You: [3, 1, false] });
  // After the clock: everyone stands on their last answer, nobody at a flag.
  view = raceRacers({ ghosts, you: { fold: 'dart', answered: 4, finished: true }, t: 300_000, minutes: 5, pool: 30 });
  assert.deepEqual(view.racers.map((r) => [r.name, r.at, r.finished]), [['Riya', 3, false], ['You', 4, false]]);
});

test('D167 F-6 the words: plain, no exclamation marks, arrows, prices or pressure; the sheet says what each way to play is', () => {
  const now = Date.parse('2026-10-22T08:42:24.000Z');
  const race = { format: 'race', minutes: 5, count: 30, chapter: 'Goodwill', subjectName: 'Accountancy', closesAt: '2026-10-23T08:35:00.000Z', host: { name: 'Kabir', you: false }, runs: [{ name: 'Riya', at: '2026-10-22T08:37:30.000Z' }] };
  const mock = { format: 'mock', minutes: 60, count: 50, chapter: null, subjectName: 'Accountancy', closesAt: '2026-10-23T08:35:00.000Z', host: { name: 'Riya', you: false }, runs: [] };
  const lines = [];
  for (const [k, v] of Object.entries(FORMAT_COPY)) {
    if (typeof v === 'string') lines.push(v);
    else if (/^race(OpenLine|Row)$/.test(k)) lines.push(v(race, now));
    else if (/^mock(OpenLine|Row)$/.test(k)) lines.push(v(mock, now));
    else if (k === 'raceLiveLine' || k === 'title' || k === 'playRace') lines.push(v(race));
    else if (k === 'raceCounts' || k === 'sheetLine') lines.push(v({ right: 9, wrong: 3, skipped: 2 }));
    else if (k === 'satSoFar') lines.push(String(v(race.runs, now)));
    else if (k === 'sheetsWait') lines.push(v(mock.closesAt, now));
    else if (k === 'outOf') lines.push(v(182, 250));
    else if (k === 'startRowSub') lines.push(v(['sprint', 'round', 'race', 'mock']));
    else if (k === 'startKey') for (const format of ['sprint', 'race', 'round', 'mock']) { lines.push(v({ format })); lines.push(v({ format, live: true, minutes: 10, count: 15 })); }
    else if (k === 'sheetSub') lines.push(v('Chai Circle', 'Accountancy'));
    else lines.push(String(v(5, 10)));
  }
  for (const l of lines) {
    assert.doesNotMatch(l, /!/, l);
    assert.doesNotMatch(l, /[←-⇿\u{1F300}-\u{1FAFF}]/u, l);
    assert.doesNotMatch(l, /₹|\bRs\.?\s?\d|\bprice\b|per month|hurry|last chance|streak at risk|not played|hasn't played/i, l);
  }
  assert.equal(FORMAT_COPY.raceSub, 'As many as you can in 5 or 10 minutes');
  assert.equal(FORMAT_COPY.mockSub, 'The whole paper, in 24 hours');
  assert.equal(FORMAT_COPY.startKey({ format: 'race', minutes: 10, live: true }), 'Open the room for a 10-minute race');
  assert.equal(FORMAT_COPY.startKey({ format: 'mock' }), 'Start the full mock');
  assert.equal(FORMAT_COPY.startKey({ format: 'round', count: 15, live: true }), 'Open the room for a 15-question round');
  assert.equal(FORMAT_COPY.startsLeft(1), '1 start left this week. Everyone plays free.');
  assert.equal(FORMAT_COPY.usesStart(1), 'Uses your 1 start this week. Everyone plays free.');
  assert.equal(FORMAT_COPY.startRowSub(['sprint', 'round', 'race', 'mock']), 'Sprint, race, round or full mock');
  assert.equal(FORMAT_COPY.startRowSub(['sprint', 'round']), 'Sprint or round');
  assert.equal(FORMAT_COPY.raceOpenLine(race, now), '5 minutes on Goodwill. Answer as many as you can. Race the runs so far. Open until 2:05 PM tomorrow.');
  assert.equal(FORMAT_COPY.mockOpenLine(mock, now), '50 Accountancy questions in 60 minutes, like the real paper. Sit it by 2:05 PM tomorrow, then compare mark sheets.');
  assert.equal(FORMAT_COPY.raceDone(14, 5), 'You answered 14 in 5 minutes.');
  assert.equal(FORMAT_COPY.raceDone(1, 10), 'You answered 1 question in 10 minutes.');
  assert.equal(FORMAT_COPY.title(race), "Kabir's race");
  assert.equal(COPY.gameTitle({ ...mock, host: { name: 'Riya', you: false } }), "Riya's full mock");
  assert.equal(momentSentence({ kind: 'most_answered', count: 21, minutes: 5 }, 30), 'Most answered: 21 in 5 minutes.');
  assert.equal(momentSentence({ kind: 'raced', count: 14, minutes: 5 }, 30), 'Answered 14 in 5 minutes.');
});

test('D167 F-7 the full mock is sat in the existing full-mock runner, on the Mob\'s route, never with a price', () => {
  const href = mockRunnerHref({ subject: 'accountancy', mobId: 'mob-1', gameId: 'game-9', memberId: 'member-3' });
  const u = new URL(href, 'http://x');
  assert.equal(u.pathname, '/test');
  assert.deepEqual(Object.fromEntries(u.searchParams), { subject: 'accountancy', mode: 'full', count: String(MOCK.count), mob: '1', mobId: 'mob-1', game: 'game-9', generationKey: 'mob-game-game-9-member-3' });
  const runner = readFileSync(path.join(root, 'src/app/(app)/test/TestPageClient.jsx'), 'utf8');
  assert.match(runner, /gameId: launch\.get\('game'\)/);
  const useMob = readFileSync(path.join(root, 'src/components/mob/useMob.js'), 'utf8');
  assert.match(useMob, /\.\.\.\(gameId \? \{ game: gameId \} : \{\}\)/);
  // After the paper, the result's Mob row leads to the game's mark sheets, never to this week's ring.
  const row = readFileSync(path.join(root, 'src/components/mob/MobResultRow.jsx'), 'utf8');
  assert.match(row, /if \(mobPaper\.gameId\)/);
  assert.match(row, /gameHref\(mobPaper\.gameId, 'podium'\)/);
});

test('D167 F-8 no new screens: the race lives in the run, the full mock\'s card and mark sheets in the run and the podium; no answer shows early', () => {
  const run = readFileSync(path.join(PLAY_DIR, 'GameRun.jsx'), 'utf8');
  // The race counts 3, 2, 1 on the page before /run, so the server's clock starts at Go.
  assert.match(run, /if \(isRace\(g\) && !live\) getSet\(\)/);
  assert.match(run, /onGo=\{\(\) => \{ begin\(\); \}\}/);
  // One question at a time: the answer's `next` joins the list; no Next key in a race.
  assert.match(run, /body\.next && Number\.isInteger\(body\.next\.q\)/);
  assert.match(run, /result && !result\.race \?/);
  assert.match(run, /phase === 'mock' \|\| phase === 'mock-done'/);
  const podium = readFileSync(path.join(PLAY_DIR, 'Podium.jsx'), 'utf8');
  assert.match(podium, /function MarkSheets/);
  assert.match(podium, /sh\.private \|\| !Number\.isFinite\(sh\.marks\)/);
  for (const f of ['GameRun.jsx', 'Podium.jsx', 'formats.mjs']) {
    const src = readFileSync(path.join(PLAY_DIR, f), 'utf8');
    assert.doesNotMatch(src, /correctIndex|correct_index|explanation/, `${f} reads an answer`);
  }
  // No new routes or pages for the formats.
  assert.equal(existsSync(path.join(root, 'src/app/(app)/mob/race')), false);
  assert.equal(existsSync(path.join(root, 'src/app/(app)/mob/mock')), false);
  const sheets = readFileSync(path.join(root, 'src/components/mob/den/DenSheets.jsx'), 'utf8');
  // One sheet lists the ways to play (MOB-MINIMAL): the picker only leads into it. Live is one choice at its top, never a
  // row; the full mock is dimmed "Anytime only" in Live, never hidden.
  assert.equal((sheets.match(/<div className="den-formats"/g) || []).length, 1);
  assert.doesNotMatch(sheets, /function FormatTile/);
  assert.equal((sheets.match(/className="den-seg den-seg--mode"/g) || []).length, 1);
  assert.match(sheets, /const anytimeOnly = t\.format === 'mock' && playsLive/);
});

test('D167 F-9 the den card and rows: a race says its minutes, a full mock opens its card (an hour-long paper never starts itself)', () => {
  const den3 = readFileSync(path.join(root, 'src/components/mob/den/DenV3.jsx'), 'utf8');
  assert.match(den3, /href=\{gameCardHref\(g\.id\)\}>\{FORMAT_COPY\.sitMock\}/);
  assert.match(den3, /isRace\(g\) \? FORMAT_COPY\.raceOpenLine\(g, now\)/);
  const sheets = readFileSync(path.join(root, 'src/components/mob/den/DenSheets.jsx'), 'utf8');
  assert.match(sheets, /isMock\(g\) \? gameCardHref\(g\.id\) : gameHref\(g\.id\)/);
});

// The server's own D167 fixtures (web/1020-mob-formats). They live on the server branch; once both branches are merged
// these run against them, so the client's reading of each shape is held by the server's real bodies.
const FX_DIR = path.join(root, 'data/tests/fixtures/mob_v3');
const haveFormatFixtures = existsSync(path.join(FX_DIR, 'game_open_race.json')) && existsSync(path.join(FX_DIR, 'podium_mock.json'));
test('D167 F-10 contract: the client reads the server\'s race and mock bodies', { skip: haveFormatFixtures ? false : 'the server branch fixtures are not merged here yet' }, () => {
  const raceGame = fx('game_open_race').game;
  assert.equal(formats.isRace(raceGame), true);
  assert.ok(RACE_MINUTES.includes(raceGame.minutes));
  assert.ok(raceGame.count >= 20);
  const run = fx('run_start_race');
  assert.equal(run.questions.length, 1);
  assert.ok(Date.parse(run.run.endsAt) - Date.parse(run.run.startedAt) === run.run.minutes * 60_000);
  const ans = fx('answer_race');
  assert.ok(Number.isInteger(ans.next.q) && Array.isArray(ans.next.options));
  assert.ok(Number.isFinite(Date.parse(ans.endsAt)));
  const fin = fx('finish_race').run;
  assert.equal(FORMAT_COPY.raceCounts(fin), `${fin.right} right, ${fin.wrong} wrong, ${fin.skipped} skipped.`);
  const g = fx('game_get_race').game;
  assert.equal(g.ghosts[0].answered, g.ghosts[0].arrivalsMs.length);
  assert.ok(racePace(1, 12_000, g.ghosts));
  const podium = fx('podium_race');
  for (const p of podium.places) assert.ok(p.answered === null || Number.isInteger(p.answered));
  for (const m of podium.moments) assert.doesNotMatch(momentSentence(m, 30), /undefined|NaN/);
  const mock = fx('game_open_mock').game;
  assert.equal(formats.isMock(mock), true);
  assert.equal(mock.count, MOCK.count);
  assert.equal(mock.minutes, MOCK.minutes);
  const sheets = fx('podium_mock').sheets;
  for (const sh of sheets) {
    if (sh.private) { assert.equal(sh.marks, null); continue; }
    assert.equal(sh.of, MOCK.marks);
    assert.equal(sh.sections.reduce((n, s) => n + s.of, 0), MOCK.count);
  }
  const den = fx('den_get_formats').mob.v3;
  assert.deepEqual(formatTiles(den.starts).map((t) => [t.format, t.can, t.pro]), [['sprint', true, false], ['race', true, false], ['round', true, false], ['mock', false, true]]);
  for (const game of den.games.filter((x) => x.format === 'race')) assert.ok(RACE_MINUTES.includes(game.minutes));
});
