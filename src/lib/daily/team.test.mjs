// node --test src/lib/daily/team.test.mjs
// Playing for a college (17 Nov 2026, lane daily; owner LK293): the 67 colleges, the pick and change rule on the device and
// on the server, the boards (colleges, never people; the floors; whole fives only), the page's reading of the board, and
// every sentence the student reads. Software fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../du/cutoffPages.mjs';
import { SHORT_LIST, TEAM_COLLEGES, isTeamCollege, searchTeams, teamIdOfName, teamName } from './colleges.mjs';
import {
  AVG_RULE, BOARD_AVG_FLOOR, BOARD_PREVIEW, BOARD_RULE, CHANGE_RULE, SUNDAY_BOARD_FLOOR, SUNDAY_RULE, TEAM_CHANGE_DAYS, WEEK_FLOOR, WEEK_RULE,
  acceptBoard, accountTeam, avgWords, boardRows, canChange, changeFrom, dayBoard, editionName, emptyBoardLine, lockLine, mergeTeam, mondayOf, ordinal,
  perPlayerWords, pickTeam, playedWords, playingFor, readTeam, seatWords, standingLine, sundayBoard, teamForCheck, teamsByDay, weekBoard,
} from './team.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const H = 'hansraj-college';
const M = 'miranda-house';
const K = 'kirori-mal-college';
const S = 'shri-ram-college-of-commerce';

// ---------------------------------------------------------------------------------------------------------------------
// The colleges.

test('the 67 are DU\'s own list, by the cutoff pages\' addresses and titles, each once', () => {
  const index = JSON.parse(readFileSync(join(ROOT, 'public/du/2026/index.json'), 'utf8'));
  const offerings = {};
  for (const g of index.groups) if (g.offerings) offerings[g.id] = JSON.parse(readFileSync(join(ROOT, 'public/du/2026/offerings', `${g.id}.json`), 'utf8'));
  const catalog = buildCatalog(index, offerings);
  assert.equal(TEAM_COLLEGES.length, 67);
  assert.equal(index.meta.colleges, 67);
  assert.deepEqual(TEAM_COLLEGES.map((c) => [c.id, c.name]), catalog.colleges.map((c) => [c.slug, c.title]), 'the same colleges, ids and names as the files');
  assert.equal(new Set(TEAM_COLLEGES.map((c) => c.id)).size, 67);
  for (const c of TEAM_COLLEGES) assert.doesNotMatch(c.name, /\(W\)/, 'names only, without DU\'s mark');
  assert.ok(isTeamCollege(H));
  for (const bad of ['', 'Hansraj College', 'hansraj', 'du', null, 7, { id: H }, `${H}-x`]) assert.equal(isTeamCollege(bad), false, String(bad));
  assert.equal(teamName(M), 'Miranda House');
  assert.equal(teamName('nowhere'), '');
});

test('the short list is the home page strip\'s DU colleges, in its order; My colleges map by DU\'s spelling', () => {
  const strip = readFileSync(join(ROOT, 'src/components/landing/CollegeStrip.jsx'), 'utf8');
  const start = strip.indexOf('export const COLLEGES = ');
  const block = strip.slice(start, strip.indexOf(']);', start));
  const names = [...block.matchAll(/\{ name: (?:'([^']+)'|"([^"]+)")/g)].map((m) => m[1] || m[2]);
  assert.equal(names.length, 8);
  assert.deepEqual(SHORT_LIST.map(teamName), names);
  assert.equal(teamIdOfName('Miranda House (W)'), M);
  assert.equal(teamIdOfName('Lady Shri Ram College for Women (W)'), 'lady-shri-ram-college-for-women');
  assert.equal(teamIdOfName('St. Stephen’s College'), 'st-stephens-college');
  assert.equal(teamIdOfName('Not a college'), null);
  // The empty search: the student's own first, then the short list, no repeats.
  const first = searchTeams('', [K, H]).map((c) => c.id);
  assert.deepEqual(first.slice(0, 2), [K, H]);
  assert.equal(first.length, new Set(first).size);
  assert.equal(first.length, 2 + SHORT_LIST.filter((id) => ![K, H].includes(id)).length);
  // The cutoff tools' matcher: short names and a slip find the college.
  assert.equal(searchTeams('srcc')[0].id, S);
  assert.equal(searchTeams('kmc')[0].id, K);
  assert.equal(searchTeams('hansrj')[0].id, H);
  assert.equal(searchTeams('zzzz').length, 0);
});

// ---------------------------------------------------------------------------------------------------------------------
// The pick and the change rule, on the device.

test('a first pick and a first change are free; after a change the next opens a week later', () => {
  assert.equal(readTeam(null), null);
  assert.equal(readTeam('{bad'), null);
  assert.equal(readTeam({ college: 'nowhere', on: '2026-11-17' }), null);
  assert.deepEqual(readTeam(JSON.stringify({ college: H, on: '2026-11-17', changedOn: 'junk' })), { college: H, on: '2026-11-17', changedOn: null });
  const first = pickTeam(null, H, '2026-11-17');
  assert.deepEqual(first, { college: H, on: '2026-11-17', changedOn: null });
  assert.equal(changeFrom(first), null);
  assert.ok(canChange(first, '2026-11-17'), 'a wrong tap is fixed at once');
  assert.equal(pickTeam(first, H, '2026-11-18'), first, 'the same college again changes nothing');
  const changed = pickTeam(first, M, '2026-11-18');
  assert.deepEqual(changed, { college: M, on: '2026-11-18', changedOn: '2026-11-18' });
  assert.equal(changeFrom(changed), '2026-11-25');
  assert.equal(TEAM_CHANGE_DAYS, 7);
  assert.equal(canChange(changed, '2026-11-24'), false);
  assert.equal(pickTeam(changed, K, '2026-11-24'), changed, 'a refused change keeps the college');
  assert.ok(canChange(changed, '2026-11-25'));
  assert.equal(pickTeam(changed, K, '2026-11-25').college, K);
  assert.equal(lockLine(changed, '2026-11-20'), 'You can change it again on Wednesday, 25 November.');
  assert.equal(lockLine(changed, '2026-11-25'), '');
  assert.equal(pickTeam(first, 'nowhere', '2026-11-18'), first);
  assert.equal(CHANGE_RULE, 'You can change it later, once a week.');
});

test('the device beside the account: the account wins, unless a change was made here on or after its latest five', () => {
  const account = { college: H, since: '2026-11-10', changedOn: null, last: '2026-11-16' };
  assert.deepEqual(mergeTeam(null, account), { college: H, on: '2026-11-10', changedOn: null });
  assert.deepEqual(mergeTeam({ college: M, on: '2026-11-12', changedOn: null }, account).college, H, 'an older choice on this phone gives way');
  const pending = mergeTeam({ college: M, on: '2026-11-17', changedOn: '2026-11-17' }, account);
  assert.deepEqual(pending, { college: M, on: '2026-11-17', changedOn: '2026-11-17' }, 'a change made here, not yet played');
  assert.equal(mergeTeam({ college: M, on: '2026-11-16', changedOn: '2026-11-16' }, account).college, M, 'the same day as the five: after it');
  assert.equal(mergeTeam({ college: K, on: '2026-11-17', changedOn: null }, null).college, K, 'no account: the device');
  assert.equal(mergeTeam(null, null), null);
});

test('the device never says a college the server will not count: a change the account\'s week refuses gives way (review)', () => {
  // The account changed to Hansraj on the 14th: no change before the 21st, whatever this phone picked (the home block reads
  // no account, so its sheet can offer one).
  const locked = { college: H, since: '2026-11-14', changedOn: '2026-11-14', last: '2026-11-16' };
  const picked = { college: M, on: '2026-11-17', changedOn: null };
  assert.deepEqual(mergeTeam(picked, locked), { college: H, on: '2026-11-14', changedOn: '2026-11-14' });
  assert.equal(teamForCheck([...rowsOf('2026-11-13', K), ...rowsOf('2026-11-14', H), ...rowsOf('2026-11-16', H)], '2026-11-17', M), H, 'the server agrees');
  // From the 21st the same pick stands, as the server then writes it.
  assert.equal(mergeTeam({ ...picked, on: '2026-11-21' }, locked).college, M);
  assert.equal(teamForCheck([...rowsOf('2026-11-13', K), ...rowsOf('2026-11-14', H), ...rowsOf('2026-11-16', H)], '2026-11-21', M), M);
});

test('a shared phone: one account\'s college and its lock are never another\'s; a guest\'s pick moves to the account (review)', () => {
  assert.deepEqual(readTeam(JSON.stringify({ college: H, on: '2026-11-17', changedOn: '2026-11-17', by: 'user-a' })), { college: H, on: '2026-11-17', changedOn: '2026-11-17', by: 'user-a' });
  assert.deepEqual(readTeam({ college: H, on: '2026-11-17', by: '' }), { college: H, on: '2026-11-17', changedOn: null });
  const asA = { college: H, on: '2026-11-17', changedOn: '2026-11-17', by: 'user-a' };
  assert.equal(mergeTeam(asA, null, 'user-b'), null, 'another account signed in: no college, and no lock, from this phone');
  assert.equal(mergeTeam(asA, null, 'user-a').college, H);
  assert.equal(mergeTeam(asA, null).college, H, 'signed out: the phone\'s own choice shows');
  const account = { college: K, since: '2026-11-10', changedOn: null, last: '2026-11-16' };
  assert.equal(mergeTeam(asA, account, 'user-b').college, K, 'B\'s own college, never A\'s pending one');
  const guest = { college: M, on: '2026-11-17', changedOn: null };
  assert.equal(mergeTeam(guest, null, 'user-b').college, M, 'a guest\'s pick is the account\'s at sign-up');
});

// ---------------------------------------------------------------------------------------------------------------------
// The rule on the server, from the account's rows.

const rowsOf = (date, team, ns = [1, 2, 3, 4, 5]) => ns.map((n) => ({ session_id: `daily:${date}`, metadata: { n, ...(team ? { for: team } : {}) } }));

test('a day counts for one college: the one on its lowest place; the account\'s college is its latest five\'s', () => {
  const mixed = [...rowsOf('2026-11-15', null, [1]), ...rowsOf('2026-11-15', M, [3]), ...rowsOf('2026-11-15', H, [2])];
  assert.equal(teamsByDay(mixed).get('2026-11-15'), H, 'place 2 before place 3; place 1 carried none');
  const rows = [...rowsOf('2026-11-10', H), ...rowsOf('2026-11-11', H), ...rowsOf('2026-11-13', M), ...rowsOf('2026-11-14', M), ...rowsOf('2026-11-12', null)];
  assert.deepEqual(accountTeam(rows), { college: M, since: '2026-11-13', changedOn: '2026-11-13', last: '2026-11-14' });
  assert.deepEqual(accountTeam(rowsOf('2026-11-10', H)), { college: H, since: '2026-11-10', changedOn: null, last: '2026-11-10' });
  assert.equal(accountTeam(rowsOf('2026-11-10', null)), null);
  assert.equal(accountTeam(rows, '2026-11-12').college, H, 'as of a date');
  assert.equal(accountTeam([{ session_id: 'daily:2026-11-10', metadata: { n: 1, for: 'nowhere' } }]), null);
});

test('the college a check is written with: today\'s stands, a first pick and a first change count, a second change waits a week', () => {
  const today = '2026-11-17';
  assert.equal(teamForCheck([], today, H), H, 'a first pick');
  assert.equal(teamForCheck([], today, null), null, 'nothing asked, nothing held');
  assert.equal(teamForCheck([], today, 'nowhere'), null);
  const held = rowsOf('2026-11-16', H);
  assert.equal(teamForCheck(held, today, null), H, 'a check that asks for nothing (an older app) still counts for the account\'s college');
  assert.equal(teamForCheck(held, today, M), M, 'the first change is free');
  assert.equal(teamForCheck([...held, ...rowsOf(today, H, [1])], today, M), H, 'today keeps the college its first check carried');
  const changed = [...rowsOf('2026-11-10', H), ...rowsOf('2026-11-12', M), ...rowsOf('2026-11-16', M)];
  assert.equal(teamForCheck(changed, today, K), M, 'changed on the 12th: no change before the 19th');
  assert.equal(teamForCheck(changed, '2026-11-19', K), K);
  assert.equal(teamForCheck(changed, today, M), M);
});

// ---------------------------------------------------------------------------------------------------------------------
// The boards.

/** A student's whole five on a day: five flat rows, `right` of them right. */
const five = (user, date, team, right = 3) => [1, 2, 3, 4, 5].map((n) => ({ user, date, n, right: n <= right, team: n === 1 ? team : (n === 2 ? team : null) }));

test('today\'s board: colleges by players, an average only from 5, whole fives only, never a user id', () => {
  const date = '2026-11-17';
  const rows = [
    ...[1, 2, 3, 4, 5].flatMap((i) => five(`h${i}`, date, H, i % 5)), // 5 players, 0+1+2+3+4 = 10 right: avg 2
    ...[1, 2, 3].flatMap((i) => five(`m${i}`, date, M, 5)),
    ...five('k1', date, K, 4),
    ...five('none1', date, null, 2), // played for no college
    ...five('h1', '2026-11-16', H, 5), // another day
    ...five('half', date, S, 5).slice(0, 4), // four places are not a five
  ];
  const board = dayBoard(rows, date);
  assert.equal(board.players, 10);
  assert.equal(board.counted, 9);
  assert.deepEqual(board.colleges, [
    { college: H, players: 5, avg: null },
    { college: M, players: 3, avg: null },
    { college: K, players: 1, avg: null },
  ]);
  assert.equal(BOARD_AVG_FLOOR, 10);
  // Under a lower floor the same rows show the average, to the nearest half.
  assert.deepEqual(dayBoard(rows, date, 5).colleges[0], { college: H, players: 5, avg: 2 });
  const text = JSON.stringify(board);
  for (const id of ['h1', 'm1', 'k1', 'none1', 'half']) assert.ok(!text.includes(`"${id}"`), `no user id: ${id}`);
  // A place written twice keeps the first; the college of a day is its lowest place's.
  const dup = [...five('d1', date, M, 5), { user: 'd1', date, n: 1, right: false, team: K }];
  assert.deepEqual(dayBoard(dup, date).colleges, [{ college: M, players: 1, avg: null }]);
  assert.deepEqual(dayBoard([], date), { players: 0, counted: 0, colleges: [] });
});

test('the week\'s board: days a player from 5 players, Monday to today; under the floor by days', () => {
  const today = '2026-11-19'; // a Thursday
  assert.equal(mondayOf(today), '2026-11-16');
  assert.equal(mondayOf('2026-11-16'), '2026-11-16');
  assert.equal(mondayOf('2026-11-22'), '2026-11-16');
  const days = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
  const rows = [
    // Hansraj: 5 players, 3 of them all four days, 2 one day: 14 days, 2.8 each.
    ...['a', 'b', 'c'].flatMap((u) => days.flatMap((d) => five(u, d, H))),
    ...['d', 'e'].flatMap((u) => five(u, '2026-11-17', H)),
    // Miranda: 5 players, one day each: 1.0 each.
    ...['f', 'g', 'h', 'i', 'j'].flatMap((u) => five(u, '2026-11-18', M)),
    // Kirori Mal: 2 players, 4 days each (under the floor).
    ...['k', 'l'].flatMap((u) => days.flatMap((d) => five(u, d, K))),
    // Last week does not count.
    ...five('a', '2026-11-15', S),
  ];
  const week = weekBoard(rows, today);
  assert.equal(week.from, '2026-11-16');
  assert.equal(week.players, 12);
  assert.deepEqual(week.colleges, [
    { college: H, players: 5, days: 14, perPlayer: 2.8 },
    { college: M, players: 5, days: 5, perPlayer: 1 },
    { college: K, players: 2, days: 8, perPlayer: null },
  ]);
  assert.equal(WEEK_FLOOR, 5);
});

test('a Sunday Mock\'s board: average marks from 5 sitters, a sitter\'s college that Sunday, never a name', () => {
  const sittings = [
    ...['a', 'b', 'c', 'd', 'e'].map((user, i) => ({ user, scored: 100 + i * 10, max: 250 })), // avg 120
    { user: 'a', scored: 200, max: 250 }, // a second subject: avg of papers (100,110,120,130,140,200) = 133
    ...['f', 'g'].map((user) => ({ user, scored: 240, max: 250 })),
    { user: 'x', scored: 50, max: 250 }, // no college
  ];
  const teams = new Map([['a', H], ['b', H], ['c', H], ['d', H], ['e', H], ['f', M], ['g', M]]);
  const board = sundayBoard(sittings, teams);
  assert.equal(board.sitters, 8);
  assert.equal(board.counted, 7);
  assert.deepEqual(board.colleges, [
    { college: H, sitters: 5, avg: 133, max: 250 },
    { college: M, sitters: 2, avg: null, max: 250 },
  ]);
  assert.equal(SUNDAY_BOARD_FLOOR, 5);
  assert.ok(!JSON.stringify(board).includes('"a"'));
});

test('the student\'s own college always has its row; the page reads only a real board', () => {
  const list = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ college: [H, M, S, 'hindu-college', K][i], players: 10 - i, avg: null }));
  assert.deepEqual(boardRows(list, K).map((r) => [r.place, r.mine]), [[1, false], [2, false], [3, false], [5, true]]);
  assert.deepEqual(boardRows(list, M).map((r) => [r.place, r.mine]), [[1, false], [2, true], [3, false]]);
  assert.equal(boardRows(list, null).length, BOARD_PREVIEW);
  assert.equal(boardRows(list, 'nowhere').length, BOARD_PREVIEW);
  const date = '2026-11-17';
  const body = {
    day: 3, date,
    today: { players: 9, counted: 8, colleges: [{ college: H, players: 5, avg: 3.4 }, { college: 'nowhere', players: 2 }, { college: M, players: 0 }, { college: K, players: 3, avg: 9 }] },
    week: { from: '2026-11-16', to: date, players: 9, colleges: [{ college: H, players: 5, days: 3, perPlayer: 0.6 }, { college: H, players: 5, days: 9, perPlayer: 1.8 }] },
    sunday: { state: 'first', week: '2026-11-22', at: 1795000000000 },
    trap: { date: '2026-11-16', q: 'Stem', letter: 'B', wrong: 'W', right: 'R', pct: 41, of: 212 },
  };
  const accepted = acceptBoard(body, date);
  assert.deepEqual(accepted.today.colleges, [{ college: H, players: 5, avg: 3.4 }, { college: K, players: 3, avg: null }], 'unknown colleges, empty rows and an impossible average are dropped');
  assert.deepEqual(accepted.week.colleges, [{ college: H, players: 5, days: 9, perPlayer: 1.8 }], 'fewer days than players is not a week');
  assert.equal(accepted.sunday.state, 'first');
  assert.equal(accepted.trap.pct, 41);
  assert.equal(acceptBoard({ ...body, date: '2026-11-16' }, date), null, 'another day\'s board');
  assert.equal(acceptBoard(null, date), null);
  assert.equal(acceptBoard({ ...body, trap: { ...body.trap, pct: 0 } }, date).trap, null);
});

// ---------------------------------------------------------------------------------------------------------------------
// Words.

test('every sentence is plain: the edition by its day, no bare number, no name, no exclamation, no arrow', () => {
  assert.equal(editionName('2026-11-17'), 'Tuesday’s five, 17 Nov');
  assert.equal(editionName('2026-11-22'), 'Sunday’s five, 22 Nov');
  assert.equal(editionName('junk'), '');
  assert.equal(playingFor(H), 'Playing for Hansraj College');
  assert.equal(playingFor('nowhere'), '');
  assert.equal(playedWords(38), '38 played');
  assert.equal(avgWords(3.4), '3.4 of 5 right on average');
  assert.equal(avgWords(null), '');
  assert.equal(perPlayerWords(2.8), '2.8 days each');
  assert.equal(seatWords(4127), '4127');
  assert.equal(seatWords(999), '');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st']);
  const list = [{ college: H, players: 5 }, { college: M, players: 2 }];
  assert.equal(standingLine(list, M), 'Miranda House: 2 players today, 2nd of 2 colleges.');
  assert.equal(standingLine(list, K), 'No one has played for Kirori Mal College yet today.');
  assert.equal(standingLine(list, null), '');
  const all = [
    BOARD_RULE, AVG_RULE, WEEK_RULE, SUNDAY_RULE, CHANGE_RULE, emptyBoardLine(null), emptyBoardLine(H), lockLine({ college: H, on: '2026-11-17', changedOn: '2026-11-17' }, '2026-11-18'),
    editionName('2026-11-17'), playingFor(H), standingLine(list, M),
  ].join(' ');
  assert.doesNotMatch(all, /!|→|->|\bNo\. ?\d|#\d|\bday \d+\b/i);
  assert.doesNotMatch(all, /\b(rank(ed)? \d|percentile|top student|topper)\b/i);
  assert.match(BOARD_RULE, /signed-in/);
  assert.match(BOARD_RULE, /answers are public/);
  assert.match(AVG_RULE, new RegExp(String(BOARD_AVG_FLOOR)));
  assert.match(WEEK_RULE, new RegExp(String(WEEK_FLOOR)));
  assert.match(SUNDAY_RULE, new RegExp(String(SUNDAY_BOARD_FLOOR)));
});

test('the day board average: from ten players, to the nearest half, so one more player never gives a score away', () => {
  const date = '2026-11-18';
  // Ten players with 34 right in all (3.4 each): 3.5. An eleventh with 5 right (39 of 55, 3.55): still 3.5.
  const ten = [...Array(10).keys()].flatMap((i) => five(`p${i}`, date, H, i < 4 ? 4 : 3));
  assert.deepEqual(dayBoard(ten, date).colleges, [{ college: H, players: 10, avg: 3.5 }]);
  assert.deepEqual(dayBoard([...ten, ...five('p10', date, H, 5)], date).colleges, [{ college: H, players: 11, avg: 3.5 }]);
  // Nine players: no average at all.
  assert.deepEqual(dayBoard(ten.filter((r) => r.user !== 'p9'), date).colleges, [{ college: H, players: 9, avg: null }]);
});
