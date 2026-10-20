// Mob games (MOB-BUILD-SPEC-V3 3.4 to 3.7): marks, places, the collective line, everyone's moment, the trap and ghosts.
// Pure: the service passes rows it read. The rules that keep a small Mob safe live here and are tested in
// data/tests/mob_v3.test.mjs:
//   F1 no correct option and no explanation for a game before closes_at (the service never asks for them).
//   F2 runs are a list of finished runs; nothing counts or names a member who has not played.
//   F3 the trap is "most of you", never a count; a moment never refers to the trap question.
//   Marks are CUET marks: +5 right, -1 wrong, 0 skipped. Ties share a place (standard competition ranking).
import { computeTrap } from './model.mjs';

export const MARK_RIGHT = 5;
export const MARK_WRONG = -1;
export const COUNTS = Object.freeze({ sprint: [5], round: [10, 15, 20] });
export const GRACE_MS = 60_000;

// Timed race (owner D167, H11 "5 minutes, 10 minutes"): as many as you can in the minutes, from one frozen pool that is
// the same for everyone in the same order. The pool is 6 a minute; a thin bank may give down to 4 a minute.
export const RACE_MINUTES = Object.freeze([5, 10]);
export const RACE_POOL_PER_MINUTE = 6;
export const RACE_MIN_PER_MINUTE = 4;
export const RACE_GRACE_MS = 2000; // the network: an answer counts if it reaches the server by the end plus 2 s
export const racePool = (minutes) => ({ want: minutes * RACE_POOL_PER_MINUTE, least: minutes * RACE_MIN_PER_MINUTE });
// Full mock together: one CUET paper, 50 questions in 60 minutes (CUET UG from 2025), 5 marks each.
export const MOCK_COUNT = 50;
export const MOCK_MINUTES = 60;
export const MOCK_MAX_MARKS = MOCK_COUNT * 5;
/** The playing time of a game in ms (the SQL mob_game_secs keeps the same numbers). */
export const gameMs = ({ format, minutes, count, secondsPerQuestion = 60 }) => (format === 'race' ? minutes * 60_000 : format === 'mock' ? (minutes || MOCK_MINUTES) * 60_000 : count * secondsPerQuestion * 1000);
export const marksFor = (right, wrong) => MARK_RIGHT * (Number(right) || 0) + MARK_WRONG * (Number(wrong) || 0);
export const deltaFor = (correct) => (correct === true ? MARK_RIGHT : correct === false ? MARK_WRONG : 0);
export const MOMENT_KINDS = Object.freeze(['all_right', 'fastest_right', 'quickest_finish', 'three_in_a_row', 'no_minus', 'finished_all', 'most_answered', 'raced']);

/**
 * places: runs [{ userId, marks, private }] (finished only). place = 1 + count(placed runs with strictly more marks).
 * A private run (the member keeps their marks private) gets no place and is not counted against anyone.
 */
export function placeRuns(runs) {
  const placed = (runs || []).filter((r) => !r.private);
  return (runs || []).map((r) => (r.private ? { ...r, place: null } : { ...r, place: 1 + placed.filter((o) => o.marks > r.marks).length }));
}

/** The tie line: the tie at your place when you are tied, else the highest shared place on the stage (1 to 3). */
export function tieFor(placedRuns, youId, nameOf) {
  const groups = new Map();
  for (const r of placedRuns) if (r.place) groups.set(r.place, [...(groups.get(r.place) || []), r]);
  const mine = placedRuns.find((r) => r.userId === youId && r.place);
  let pick = mine && groups.get(mine.place).length > 1 ? mine.place : null;
  if (!pick) pick = [...groups.keys()].sort((a, b) => a - b).find((p) => p <= 3 && groups.get(p).length > 1) || null;
  if (!pick) return null;
  const list = groups.get(pick);
  const names = [...list].sort((a, b) => (a.userId === youId ? -1 : b.userId === youId ? 1 : 0)).map((r) => (r.userId === youId ? 'You' : nameOf(r.userId)));
  return { place: pick, names, marks: list[0].marks };
}

const secondsBetween = (ms) => Math.max(1, Math.round(ms / 1000));

/**
 * Facts for every moment kind, per run. answers: [{ q, correct, elapsedMs, pick }] of that run in q order;
 * excludeQ: the trap question (after close), which no moment may mention.
 */
function momentFacts(run, count, excludeQ) {
  const list = [...(run.answers || [])].sort((a, b) => a.elapsedMs - b.elapsedMs);
  let prev = 0;
  let fastest = null;
  for (const a of list) {
    const took = Math.max(0, a.elapsedMs - prev);
    prev = a.elapsedMs;
    if (a.correct === true && a.q !== excludeQ && (!fastest || took < fastest.ms)) fastest = { q: a.q, ms: took };
  }
  const byQ = [...(run.answers || [])].sort((a, b) => a.q - b.q);
  let three = null;
  for (let i = 0; i + 2 < byQ.length && !three; i += 1) {
    const s = byQ.slice(i, i + 3);
    if (s.every((a, j) => a.correct === true && a.q === byQ[i].q + j && a.q !== excludeQ)) three = { from: s[0].q, to: s[2].q };
  }
  const answered = byQ.filter((a) => a.pick >= 0).length;
  const answeredAll = answered === count;
  const finishMs = list.length ? list.at(-1).elapsedMs : null;
  return { fastest, three, answeredAll, answered, finishMs, allRight: run.right === count, noMinus: run.wrong === 0 && run.right > 0 };
}

/**
 * Everyone's moment (3.6): kinds from a fixed list, assigned in place order (unplaced runs after, by finish), each
 * player taking the first true kind not yet used by another, else finished_all. "Fastest right" and "Quickest finish"
 * are only true for the one run that holds them. Never the trap question, never a skip fact, never negative.
 * A private run (`private: true`: that member keeps their marks private and it is not the viewer's own run) only ever
 * gets finished_all: no fact about it is shown (L-10). It still holds "fastest" or "quickest" when it truly does, so
 * nobody else is named for it (the line stays true), but the kind is simply not shown.
 * runs: [{ userId, memberId, place, finishedAt, right, wrong, answers, private? }]; q in the payload is 0-based, number is 1-based.
 */
export function assignMoments(runs, { count, trapQ = null, format = null, minutes = null }) {
  const race = format === 'race';
  const mock = format === 'mock';
  const facts = new Map(runs.map((r) => [r.userId, momentFacts(r, count, trapQ)]));
  let fastestOwner = null; let quickestOwner = null; let mostOwner = null;
  for (const r of runs) {
    const f = facts.get(r.userId);
    // A full mock's times are the runner's own record, not the server's: no time moment for it.
    if (!mock && f.fastest && (!fastestOwner || f.fastest.ms < facts.get(fastestOwner).fastest.ms)) fastestOwner = r.userId;
    if (!race && !mock && f.answeredAll && f.finishMs !== null && (!quickestOwner || f.finishMs < facts.get(quickestOwner).finishMs)) quickestOwner = r.userId;
  }
  // "Most answered" belongs to one race run alone: a tie at the top gives it to nobody. A private run that holds it keeps
  // it (unshown), so nobody else is named for it (L-10, as with fastest and quickest).
  if (race) {
    const top = Math.max(0, ...runs.map((r) => facts.get(r.userId).answered));
    const at = runs.filter((r) => facts.get(r.userId).answered === top);
    mostOwner = top > 0 && at.length === 1 ? at[0].userId : null;
  }
  const raceAllRight = (f, r) => race && f.answered >= 5 && r.right === f.answered;
  const order = [...runs].sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
  const used = new Set();
  const out = [];
  for (const r of order) {
    const f = facts.get(r.userId);
    if (r.private) { out.push(race ? { memberId: r.memberId, kind: 'raced', count: null, minutes } : { memberId: r.memberId, kind: 'finished_all', count }); continue; }
    const fallback = race ? { memberId: r.memberId, kind: 'raced', count: f.answered, minutes } : { memberId: r.memberId, kind: 'finished_all', count };
    const candidates = [
      ['most_answered', race && mostOwner === r.userId, { count: f.answered, minutes }],
      ['all_right', race ? raceAllRight(f, r) : f.allRight, { count: race ? f.answered : count }],
      ['fastest_right', r.userId === fastestOwner, f.fastest ? { q: f.fastest.q, number: f.fastest.q + 1, seconds: secondsBetween(f.fastest.ms) } : null],
      ['quickest_finish', r.userId === quickestOwner, { count, seconds: f.finishMs !== null ? secondsBetween(f.finishMs) : null }],
      ['three_in_a_row', Boolean(f.three), f.three ? { from: f.three.from + 1, to: f.three.to + 1 } : null],
      ['no_minus', f.noMinus, {}],
    ];
    const hit = candidates.find(([kind, ok]) => ok && !used.has(kind));
    if (hit) { used.add(hit[0]); out.push({ memberId: r.memberId, kind: hit[0], ...hit[2] }); }
    else out.push(fallback);
  }
  return out;
}

/**
 * The collective line "Your Mob got R of N right together" (3.6). Runs of members who keep their marks private are left
 * out unless the run is the viewer's own (L-10): with them in, a difference between two views, or between two opens of
 * the "so far" podium, gives away a private member's count. `of` counts only the runs in the sum, so the line stays true.
 * runs: [{ userId, right, private }] finished only; private already means "not the viewer".
 */
export function togetherLine(runs, count) {
  const counted = (runs || []).filter((r) => !r.private);
  return { kind: 'together', right: counted.reduce((s, r) => s + (Number(r.right) || 0), 0), of: counted.length * count };
}

/** The game's trap after close: { q, number, caught: 'most', optionIndex } or null (3 finished runs, 2 picks, half). */
export function gameTrap(picksByRun, keys) {
  const raw = computeTrap((picksByRun || []).map((picks) => ({ picks })), keys);
  if (!raw) return null;
  return { q: raw.questionIndex, number: raw.questionNumber, caught: 'most', optionIndex: raw.optionIndex };
}

/**
 * Full mock together's trap (D167: "Fix it together takes the paper's most-missed question"): the question the most
 * finished sitters missed (wrong or not answered), when at least 2 missed it and at least half did; on a tie the one with
 * more wrong picks, then the earlier. { q, number, caught: 'most', optionIndex (the most picked wrong option, or -1) } or
 * null. Needs 2 finished sitters. picksByRun: [[pick per question]], keys: [correct index per question].
 */
export function mockTrap(picksByRun, keys) {
  const runs = (picksByRun || []).filter(Array.isArray);
  if (runs.length < 2) return null;
  let best = null;
  for (let q = 0; q < (keys || []).length; q += 1) {
    if (!Number.isInteger(keys[q]) || keys[q] < 0) continue;
    const picks = runs.map((p) => (Number.isInteger(p[q]) ? p[q] : -1));
    const missed = picks.filter((p) => p !== keys[q]).length;
    const wrong = picks.filter((p) => p >= 0 && p !== keys[q]);
    if (missed < 2 || missed * 2 < runs.length) continue;
    if (!best || missed > best.missed || (missed === best.missed && wrong.length > best.wrong.length)) best = { q, missed, wrong };
  }
  if (!best) return null;
  const tally = new Map();
  for (const p of best.wrong) tally.set(p, (tally.get(p) || 0) + 1);
  const optionIndex = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? -1;
  return { q: best.q, number: best.q + 1, caught: 'most', optionIndex };
}

/** Next Wednesday 12:00 AM IST at least 48 hours after `closesAtMs`, and that Sunday 11:59:59 PM IST. */
export function checkWindow(closesAtMs) {
  const earliest = closesAtMs + 48 * 3600_000;
  // IST calendar day of `earliest`.
  const ist = new Date(earliest + 5.5 * 3600_000);
  let day = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const wedAt = (d) => Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00+05:30`);
  for (let i = 0; i < 8; i += 1) {
    if (day.getUTCDay() === 3 && wedAt(day) >= earliest) break;
    day = new Date(day.getTime() + 86_400_000);
  }
  const opensAt = wedAt(day);
  const sunday = new Date(day.getTime() + 4 * 86_400_000).toISOString().slice(0, 10);
  return { opensAt: new Date(opensAt).toISOString(), closesAt: new Date(Date.parse(`${sunday}T23:59:59+05:30`)).toISOString() };
}

/**
 * Ghosts (3.4): finished runs of others (and your own earlier run on a rematch). Arrivals are the server's elapsed_ms per
 * answered question in order (a skip moves you on too). No picks and no correctness. A member who keeps their marks
 * private is never a ghost for anyone else (L-10: their per-question times are theirs).
 */
export function ghostOf(run, member) {
  const arrivals = [...(run.arrivals || [])].map(Number);
  return {
    memberId: member.memberId, name: member.name, colour: member.colour, fold: member.fold,
    playedAt: new Date(run.finishedAt || run.startedAt).toISOString(), arrivalsMs: arrivals, finishedMs: arrivals.length ? arrivals.at(-1) : 0,
    answered: arrivals.length,
  };
}

/**
 * The ghost pace chip (R4), the one number the app derives (unit-tested on both sides). youMs: elapsed of your latest
 * answer; k: its 0-based index. The ghost is the one whose arrivalsMs[k] is nearest. Positive delta: you are ahead.
 */
export function ghostPace(youMs, k, ghosts) {
  let best = null;
  for (const g of ghosts || []) {
    const at = g?.arrivalsMs?.[k];
    if (!Number.isFinite(at)) continue;
    if (!best || Math.abs(at - youMs) < Math.abs(best.at - youMs)) best = { name: g.name, at };
  }
  if (!best) return null;
  const delta = Math.round((best.at - youMs) / 1000);
  if (Math.abs(delta) < 1) return { name: best.name, delta: 0, text: `Level with ${best.name}` };
  return { name: best.name, delta, text: delta > 0 ? `${delta} s ahead of ${best.name}` : `${-delta} s behind ${best.name}` };
}

/** Strip a bank question to what a player may see during an open game: never the key, never the explanation. */
export function publicQuestion(question, q) {
  const options = (Array.isArray(question?.options) ? question.options : []).map((o) => (o && typeof o === 'object' ? String(o.text ?? o.label ?? o.value ?? '') : String(o ?? '')));
  return { q, stem: String(question?.question ?? question?.body ?? question?.stem ?? ''), options, passage: question?.passageText ? String(question.passageText) : null };
}
