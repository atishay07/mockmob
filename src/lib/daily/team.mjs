// Playing for a college (17 Nov 2026, lane daily; owner LK293: "something different ... building something unique"). The
// Daily Five becomes a game of the colleges students aim for: each student picks the DU college they are playing for, every
// five they play signed in counts for it, and the college board ranks colleges, never people. Pure and browser-safe (no
// server import, no alias import): the server half is src/lib/server/dailyTeam.js; tests in team.test.mjs.
//
// Where the choice lives (no new table): on the device until a five is played (guests and signed-in students alike, under
// TEAM_STORE), and on the account in the Daily Five's own rows. A signed-in check carries the college (POST /api/daily/check
// `for`), the server writes it into that row's metadata (`for`), and the account's college is the one its latest five was
// played for. So a team is never a profile field: it is what the student's fives were played for.
//
// The change rule: the first pick is free, and so is the first change after it (a wrong tap is fixed at once); after a change
// the next one opens TEAM_CHANGE_DAYS later. Teams cannot be hopped for a better board. The server applies the rule to the
// rows it writes; the device applies the same rule to what it shows.
//
// Honesty: the Daily Five is an honour system (its questions are the public sample's, whose answers are public), so the board
// counts who played first; an average of right answers shows only from BOARD_AVG_FLOOR players, and only as a second line.
import { DAILY_FIVE_SIZE, addDays, dayLabel, editionOf, isDateKey } from '../dailyFive.mjs';
import { isTeamCollege, teamName } from './colleges.mjs';

export const TEAM_STORE = 'mm:daily-team:v1';
/** After a change, the next change opens this many days later. */
export const TEAM_CHANGE_DAYS = 7;
/** A college's average right answers today shows once this many signed-in students played for it today. */
export const BOARD_AVG_FLOOR = 5;
/** A college's days a player this week shows once this many signed-in students played for it this week. */
export const WEEK_FLOOR = 5;
/** A college's Sunday Mock average shows once this many of its students sat the paper. */
export const SUNDAY_BOARD_FLOOR = 5;
/** How many colleges the home page's board shows before the student's own. */
export const BOARD_PREVIEW = 3;
/** Seat numbers: four digits, never starting with 0. */
export const SEAT_MIN = 1000;
export const SEAT_MAX = 9999;


// ---------------------------------------------------------------------------------------------------------------------
// The edition: each day's five by its own name, so anyone can decode it (no bare number; owner, 16 Nov: "Number 2 ... What
// exactly does it mean?").

/** "Tuesday’s five, 17 Nov". */
export function editionName(date) {
  return editionOf(date);
}

/** "Playing for Hansraj College", or '' without a college. */
export const playingFor = (id) => (isTeamCollege(id) ? `Playing for ${teamName(id)}` : '');

// ---------------------------------------------------------------------------------------------------------------------
// The device's choice: { college, on, changedOn, by? }. `on` is the IST date it was made; `changedOn` the date of the last
// change (null for a first pick that was never changed); `by` the account it was made or read under (none: a guest's pick,
// which the account signed in next takes over).

/** The stored text as a choice, or null. */
export function readTeam(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || !isTeamCollege(value.college) || !isDateKey(value.on)) return null;
  const by = typeof value.by === 'string' && value.by ? value.by : null;
  return { college: value.college, on: value.on, changedOn: isDateKey(value.changedOn) ? value.changedOn : null, ...(by ? { by } : {}) };
}

/** The first day a change is allowed again, or null when a change is allowed now (a first pick, or the first change). */
export function changeFrom(choice) {
  return choice && isDateKey(choice.changedOn) ? addDays(choice.changedOn, TEAM_CHANGE_DAYS) : null;
}

/** May the choice be changed on `today`? */
export function canChange(choice, today) {
  const from = changeFrom(choice);
  return !from || (isDateKey(today) && today >= from);
}

/**
 * The choice after a pick on `today`: a first pick, the same college again (nothing changes), or a change (allowed only by
 * the rule; a refused change returns the choice as it was).
 */
export function pickTeam(choice, college, today) {
  if (!isTeamCollege(college) || !isDateKey(today)) return choice || null;
  if (!choice) return { college, on: today, changedOn: null };
  if (choice.college === college) return choice;
  if (!canChange(choice, today)) return choice;
  return { college, on: today, changedOn: today };
}

/** "You can change your college again on Monday, 24 November.", or '' when it can be changed now. */
export function lockLine(choice, today) {
  const from = changeFrom(choice);
  if (!from || (isDateKey(today) && today >= from)) return '';
  return `You can change it again on ${dayLabel(from)}.`;
}

/** The rule in one sentence, said beside the pick. */
export const CHANGE_RULE = 'You can change it later, once a week.';

/**
 * The device beside the account. `account` is /api/daily/me's team: { college, since, changedOn, last } (last: the latest
 * day a five was played for it). The account wins unless the device chose after the account's latest five (a change made
 * here and not yet played) on a day the account's own rule allowed a change (the server writes the account's college
 * otherwise, so the page must not say another): then the device's choice stands, and the lock is the later of the two.
 * `userId` is the signed-in student: a choice this device holds for another account (a shared phone) is not theirs and is
 * left out; a guest's pick (no `by`) is theirs to take over.
 */
export function mergeTeam(device, account, userId = null) {
  const own = device && !(typeof userId === 'string' && userId && device.by && device.by !== userId) ? device : null;
  const acc = account && isTeamCollege(account.college) ? account : null;
  if (!acc) return own || null;
  const accountRule = { college: acc.college, on: acc.since, changedOn: isDateKey(acc.changedOn) ? acc.changedOn : null };
  if (own && own.college !== acc.college && isDateKey(acc.last) && own.on >= acc.last && canChange(accountRule, own.on)) {
    const changedOn = [own.changedOn, acc.changedOn].filter(isDateKey).sort().pop() || null;
    return { college: own.college, on: own.on, changedOn };
  }
  return { college: acc.college, on: isDateKey(acc.since) ? acc.since : (own?.on || acc.last), changedOn: accountRule.changedOn };
}

// ---------------------------------------------------------------------------------------------------------------------
// The account's college, from its Daily Five rows (server side reads them; the rule is here so both sides say the same).
// A row: { session_id: 'daily:<date>', metadata: { n, for? } } (or the flat { date, n, team } the board reads).

const SESSION = /^daily:(\d{4}-\d{2}-\d{2})$/;
const dateOfRow = (row) => {
  if (isDateKey(row?.date)) return row.date;
  const m = SESSION.exec(String(row?.session_id ?? ''));
  return m && isDateKey(m[1]) ? m[1] : null;
};
const nOfRow = (row) => Number(row?.n ?? row?.metadata?.n);
const teamOfRow = (row) => {
  const t = row?.team ?? row?.metadata?.for;
  return isTeamCollege(t) ? t : null;
};

/**
 * The college of each day the rows hold: Map(date -> college). A day's college is the one on its lowest question place that
 * carries one, so a day can only ever count for one college.
 */
export function teamsByDay(rows) {
  const best = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = dateOfRow(row);
    const n = nOfRow(row);
    const team = teamOfRow(row);
    if (!date || !team || !Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE) continue;
    const held = best.get(date);
    if (!held || n < held.n) best.set(date, { n, team });
  }
  return new Map([...best].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, v]) => [d, v.team]));
}

/**
 * The account's college from its rows: { college, since, changedOn, last }, or null before any five carried one. `since` is
 * the first day of the latest stretch for that college, `changedOn` the latest day the college differed from the day before
 * it (null when it never changed), `last` the latest day with a college.
 */
export function accountTeam(rows, upTo = null) {
  const days = [...teamsByDay(rows)].filter(([d]) => !upTo || d <= upTo);
  if (!days.length) return null;
  let since = days[0][0];
  let changedOn = null;
  for (let i = 1; i < days.length; i += 1) {
    if (days[i][1] !== days[i - 1][1]) { since = days[i][0]; changedOn = days[i][0]; }
  }
  const [last, college] = days[days.length - 1];
  return { college, since, changedOn, last };
}

/**
 * The college a signed-in check is written with. `rows` are the account's Daily Five rows (today's and earlier); `asked` the
 * college the page sent (or nothing, as an older app does). Today keeps the college it already has. Without a college today,
 * the asked one counts if the rule allows it; otherwise the account's college carries on (a check that asks for nothing
 * still counts for it). Null when the account has none and none was asked.
 */
export function teamForCheck(rows, today, asked) {
  const byDay = teamsByDay(rows);
  if (byDay.has(today)) return byDay.get(today);
  const before = accountTeam(rows, isDateKey(today) ? addDays(today, -1) : null);
  const want = isTeamCollege(asked) ? asked : null;
  if (!before) return want;
  if (!want || want === before.college) return before.college;
  const choice = { college: before.college, on: before.since, changedOn: before.changedOn };
  return canChange(choice, today) ? want : before.college;
}

// ---------------------------------------------------------------------------------------------------------------------
// The board. Input rows are the signed-in Daily Five rows of a span of days, flat: { user, date, n, right, team }. Nothing
// leaves but college ids and counts: never a user id, a seat or a score of one student.

/** Each student's whole fives in the rows: Map(user -> Map(date -> { score, team })). A day counts only with all five places. */
function fivesOf(rows) {
  const places = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const user = typeof row?.user === 'string' ? row.user : null;
    const date = dateOfRow(row);
    const n = nOfRow(row);
    if (!user || !date || !Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE) continue;
    const key = `${user}\u0001${date}`;
    if (!places.has(key)) places.set(key, { user, date, at: new Map() });
    const day = places.get(key);
    if (!day.at.has(n)) day.at.set(n, { right: row.right === true, team: teamOfRow(row) });
  }
  const out = new Map();
  for (const { user, date, at } of places.values()) {
    if (at.size !== DAILY_FIVE_SIZE) continue;
    let team = null;
    for (let n = 1; n <= DAILY_FIVE_SIZE && !team; n += 1) team = at.get(n)?.team || null;
    const score = [...at.values()].filter((p) => p.right).length;
    if (!out.has(user)) out.set(user, new Map());
    out.get(user).set(date, { score, team });
  }
  return out;
}

const tenth = (v) => Math.round(v * 10) / 10;
const byName = (a, b) => teamName(a).localeCompare(teamName(b), 'en', { sensitivity: 'base' });

/**
 * One day's board: { players, counted, colleges: [{ college, players, avg }] }. `players` is every signed-in student with a
 * whole five that day; `counted` those who played for a college. Colleges by players, most first; `avg` (right answers out
 * of 5, one decimal) only from BOARD_AVG_FLOOR players, else null. Ties: the higher average, then A to Z.
 */
export function dayBoard(rows, date, floor = BOARD_AVG_FLOOR) {
  const per = new Map();
  let players = 0;
  let counted = 0;
  for (const days of fivesOf(rows).values()) {
    const five = days.get(date);
    if (!five) continue;
    players += 1;
    if (!five.team) continue;
    counted += 1;
    const c = per.get(five.team) || { players: 0, right: 0 };
    c.players += 1;
    c.right += five.score;
    per.set(five.team, c);
  }
  const colleges = [...per].map(([college, c]) => ({ college, players: c.players, avg: c.players >= floor ? tenth(c.right / c.players) : null }));
  colleges.sort((a, b) => b.players - a.players || (b.avg ?? -1) - (a.avg ?? -1) || byName(a.college, b.college));
  return { players, counted, colleges };
}

/**
 * The week's board, Monday to `today`: { from, to, players, colleges: [{ college, players, days, perPlayer }] }. A student
 * counts for each college they played for this week, a day for each whole five played for it. `perPlayer` (days a player,
 * one decimal) only from WEEK_FLOOR players. The colleges whose players came back most days lead: by days a player, then by
 * days, then A to Z; colleges under the floor follow, by days.
 */
export function weekBoard(rows, today, floor = WEEK_FLOOR) {
  if (!isDateKey(today)) return { from: null, to: null, players: 0, colleges: [] };
  const from = mondayOf(today);
  const per = new Map();
  const everyone = new Set();
  for (const [user, days] of fivesOf(rows)) {
    for (const [date, five] of days) {
      if (date < from || date > today) continue;
      everyone.add(user);
      if (!five.team) continue;
      const c = per.get(five.team) || { users: new Set(), days: 0 };
      c.users.add(user);
      c.days += 1;
      per.set(five.team, c);
    }
  }
  const colleges = [...per].map(([college, c]) => ({ college, players: c.users.size, days: c.days, perPlayer: c.users.size >= floor ? tenth(c.days / c.users.size) : null }));
  colleges.sort((a, b) => (a.perPlayer === null) - (b.perPlayer === null) || (b.perPlayer ?? 0) - (a.perPlayer ?? 0) || b.days - a.days || byName(a.college, b.college));
  return { from, to: today, players: everyone.size, colleges };
}

/** Monday of a date's IST week. */
export function mondayOf(date) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

/**
 * A Sunday Mock's board: { sitters, counted, colleges: [{ college, sitters, avg, max }] } from the week's sittings
 * ([{ user, scored, max }], one per subject a student sat) and each sitter's college that Sunday (Map(user -> college)).
 * `avg` is the average marks of a paper among the college's sitters, a whole number, only from SUNDAY_BOARD_FLOOR sitters.
 * `max` is a paper's full marks. Colleges by average (those under the floor after, by sitters).
 */
export function sundayBoard(sittings, teamOf, floor = SUNDAY_BOARD_FLOOR) {
  const per = new Map();
  const everyone = new Set();
  const counted = new Set();
  let max = 0;
  for (const s of Array.isArray(sittings) ? sittings : []) {
    if (!s || typeof s.user !== 'string' || !Number.isFinite(s.scored) || !Number.isFinite(s.max) || s.max <= 0) continue;
    everyone.add(s.user);
    max = Math.max(max, s.max);
    const team = teamOf instanceof Map ? teamOf.get(s.user) : null;
    if (!isTeamCollege(team)) continue;
    counted.add(s.user);
    const c = per.get(team) || { users: new Set(), papers: 0, marks: 0 };
    c.users.add(s.user);
    c.papers += 1;
    c.marks += s.scored;
    per.set(team, c);
  }
  const colleges = [...per].map(([college, c]) => ({ college, sitters: c.users.size, avg: c.users.size >= floor ? Math.round(c.marks / c.papers) : null, max }));
  colleges.sort((a, b) => (a.avg === null) - (b.avg === null) || (b.avg ?? 0) - (a.avg ?? 0) || b.sitters - a.sitters || byName(a.college, b.college));
  return { sitters: everyone.size, counted: counted.size, colleges };
}

// ---------------------------------------------------------------------------------------------------------------------
// The page's reading of GET /api/daily/board.

const cleanDay = (rows) => (Array.isArray(rows) ? rows : []).filter((c) => c && isTeamCollege(c.college) && Number.isInteger(c.players) && c.players > 0)
  .map((c) => ({ college: c.college, players: c.players, avg: Number.isFinite(c.avg) && c.avg >= 0 && c.avg <= DAILY_FIVE_SIZE ? c.avg : null }));
const cleanWeek = (rows) => (Array.isArray(rows) ? rows : []).filter((c) => c && isTeamCollege(c.college) && Number.isInteger(c.players) && c.players > 0 && Number.isInteger(c.days) && c.days >= c.players)
  .map((c) => ({ college: c.college, players: c.players, days: c.days, perPlayer: Number.isFinite(c.perPlayer) && c.perPlayer >= 1 && c.perPlayer <= 7 ? c.perPlayer : null }));
const cleanSunday = (rows) => (Array.isArray(rows) ? rows : []).filter((c) => c && isTeamCollege(c.college) && Number.isInteger(c.sitters) && c.sitters > 0)
  .map((c) => ({ college: c.college, sitters: c.sitters, avg: Number.isInteger(c.avg) ? c.avg : null, max: Number.isInteger(c.max) && c.max > 0 ? c.max : null }));

/**
 * The board as the page draws it, or null for anything that is not one:
 *   { date, today: { players, counted, colleges }, week: { from, to, players, colleges }, sunday, trap }
 * sunday: { state: 'first' (no Sunday board yet: `at` is when the first appears) | 'ready' (`week`, sitters, colleges) }
 * trap: yesterday's most-picked wrong answer, or null.
 */
export function acceptBoard(body, date) {
  if (!body || typeof body !== 'object' || body.date !== date || !body.today || !body.week) return null;
  const today = { players: Math.max(0, Number(body.today.players) || 0), counted: Math.max(0, Number(body.today.counted) || 0), colleges: cleanDay(body.today.colleges) };
  const week = { from: isDateKey(body.week.from) ? body.week.from : null, to: isDateKey(body.week.to) ? body.week.to : null, players: Math.max(0, Number(body.week.players) || 0), colleges: cleanWeek(body.week.colleges) };
  let sunday = null;
  const s = body.sunday;
  if (s && s.state === 'first' && Number.isFinite(s.at)) sunday = { state: 'first', at: s.at, week: isDateKey(s.week) ? s.week : null };
  else if (s && s.state === 'ready' && isDateKey(s.week)) sunday = { state: 'ready', week: s.week, sitters: Math.max(0, Number(s.sitters) || 0), counted: Math.max(0, Number(s.counted) || 0), colleges: cleanSunday(s.colleges) };
  const t = body.trap;
  const trap = t && isDateKey(t.date) && typeof t.q === 'string' && typeof t.wrong === 'string' && typeof t.right === 'string' && Number.isInteger(t.pct) && t.pct > 0 && t.pct <= 100 && Number.isInteger(t.of) && t.of > 0
    ? { date: t.date, q: t.q.slice(0, 600), wrong: t.wrong.slice(0, 300), right: t.right.slice(0, 300), pct: t.pct, of: t.of, letter: /^[A-D]$/.test(t.letter) ? t.letter : null }
    : null;
  return { date, today, week, sunday, trap };
}

/**
 * The rows a board shows: the first `top` colleges, then the student's own college if it is further down (with its place),
 * so their row is always findable. [{ ...row, place, mine }].
 */
export function boardRows(colleges, mine, top = BOARD_PREVIEW) {
  const list = Array.isArray(colleges) ? colleges : [];
  const shown = list.slice(0, top).map((c, i) => ({ ...c, place: i + 1, mine: c.college === mine }));
  const at = list.findIndex((c) => c.college === mine);
  if (at >= top) shown.push({ ...list[at], place: at + 1, mine: true });
  return shown;
}

// ---------------------------------------------------------------------------------------------------------------------
// Words.

const n = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** How the board is counted, in one plain line. */
export const BOARD_RULE = 'Counted from signed-in players. The five’s answers are public, so colleges rank by how many play, not by scores.';
export const AVG_RULE = `A college’s average shows once ${BOARD_AVG_FLOOR} of its students have played.`;
export const WEEK_RULE = `Days played this week for each player, shown once a college has ${WEEK_FLOOR} players.`;
export const SUNDAY_RULE = `Average marks of a paper among each college’s sitters, shown once ${SUNDAY_BOARD_FLOOR} have sat it.`;

/** "38 played" */
export const playedWords = (players) => `${players} played`;
/** "3.4 of 5 right on average", or ''. */
export const avgWords = (avg) => (Number.isFinite(avg) ? `${avg} of ${DAILY_FIVE_SIZE} right on average` : '');
/** "4.2 days each", or ''. */
export const perPlayerWords = (v) => (Number.isFinite(v) ? `${v} ${v === 1 ? 'day' : 'days'} each` : '');

/** The line when nobody has played for a college today: never an empty table. */
export function emptyBoardLine(mine) {
  return mine ? `No one has played for a college yet today. Play today’s five to put ${teamName(mine)} on the board.` : 'No one has played for a college yet today. Pick yours and play to put it on the board.';
}

/** Where the student's college stands today, in one sentence, or ''. */
export function standingLine(colleges, mine) {
  if (!isTeamCollege(mine)) return '';
  const list = Array.isArray(colleges) ? colleges : [];
  const at = list.findIndex((c) => c.college === mine);
  if (at < 0) return `No one has played for ${teamName(mine)} yet today.`;
  const row = list[at];
  const of = list.length;
  return `${teamName(mine)}: ${n(row.players, 'player')} today, ${ordinal(at + 1)} of ${n(of, 'college')}.`;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(v) {
  const k = v % 100;
  if (k >= 11 && k <= 13) return `${v}th`;
  return `${v}${['th', 'st', 'nd', 'rd'][v % 10] || 'th'}`;
}

/** The seat as the admit card prints it: "4127", or ''. */
export const seatWords = (seat) => (Number.isInteger(seat) && seat >= SEAT_MIN && seat <= SEAT_MAX ? String(seat) : '');
