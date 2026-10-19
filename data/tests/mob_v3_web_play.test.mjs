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
    for (const pose of ['idle', 'cheer', 'think']) assert.ok(files.has(path.basename(foldSrc(key, pose))), `${key} ${pose}`);
    for (const size of [40, 64]) assert.ok(existsSync(path.join(root, 'public', foldHeadSrc(key, size))), `${key} head ${size}`);
  }
  // One set for the whole website: the den's names (fold-<key>-<pose>@<size>.webp), nothing else in the folder.
  assert.equal(foldSrc('dart', 'idle'), '/mob/folds/fold-dart-idle@256.webp');
  assert.equal(foldHeadSrc('dart', 40), '/mob/folds/fold-dart-head@128.webp');
  assert.equal(foldHeadSrc('dart', 64), '/mob/folds/fold-dart-head@256.webp');
  for (const f of files) assert.match(f, /^fold-[a-z]+-(idle|cheer|think|head|idle-blink)@(128|256|512)\.webp$/, `${f} follows the one naming`);
  assert.equal(foldSrc('dart', 'shrug'), '/mob/folds/fold-dart-think@256.webp', 'shrug falls back to think until it is drawn');
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
