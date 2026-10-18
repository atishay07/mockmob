// The Mob's comparison (SOCIAL-SPEC section 15): the free teaser and the Pro side-by-side. PURE: no I/O, no clock reads,
// so the server builds it and node:test checks every rule in data/tests/mob.test.mjs.
//
// What is private stays private, and the plan only decides how much of the shared data a student may open:
//   - Another member's picks, seconds and changed answers are shown only when that member chose to share their answers
//     (the Mob's "Share my answers" switch, stored as show_score) AND the student looking shares theirs. Share is
//     reciprocal, so nobody reads a friend without being readable.
//   - A member who keeps their answers private is counted ("1 member keeps their answers private"), never named, and
//     is never drawn as a gap or a rank.
//   - How the Mob picked a question (counts per option, no names) is counted over the sitters this student can read: themselves
//     and the members shown to them. A member who keeps their answers private is never counted in it, so subtracting the
//     rows you can read from the counts never leaves their pick (18 Oct fix: with 3 sitters, "you A, Gita B, counts A 1
//     B 2" used to give the hidden member's B). It needs 3 readable sitters, like the shared trap (P7); the per-question
//     "Split" tag follows the same rule (2 readable sitters are enough, since each shows their own picks).
//   - The teaser needs 3 sitters, or every sitter sharing: with two sitters who both keep answers private, even "you
//     split on 3 questions" would tell one student something about the other.
// Nothing here ranks members or says who did better.
import { TRAP_MIN_SITTERS, computeTrap, letterFor, teaserLine } from './model.mjs';

export const STEM_MAX = 110;

const picksOf = (s, q) => (Array.isArray(s?.picks) && Number.isInteger(s.picks[q]) ? s.picks[q] : -1);
const clip = (text) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > STEM_MAX ? `${t.slice(0, STEM_MAX - 1).trimEnd()}…` : t;
};

/** The user ids that chose to share their answers with their Mob. */
export const sharingSet = (members) => new Set((Array.isArray(members) ? members : []).filter((m) => m?.show_score === true).map((m) => m.user_id));

/**
 * The free teaser: where the Mob split, in a number. Needs you to have sat and 2 or more sitters; 3 or more sitters, or
 * every sitter sharing (see the file's header). Named ("You and Riya") only when you share and exactly one other sitter
 * does, and then it counts the two of you. Otherwise it counts the whole Mob, with no names.
 * Returns { split, of, with } or null.
 */
export function computeTeaser(sittings, { userId, share, nameOf = () => null, count } = {}) {
  const list = Array.isArray(sittings) ? sittings : [];
  const shows = share instanceof Set ? share : new Set(share || []);
  const mine = list.find((s) => s?.user_id === userId);
  if (!mine || list.length < 2 || !(count > 0)) return null;
  const everyoneShares = list.every((s) => shows.has(s.user_id));
  if (list.length < TRAP_MIN_SITTERS && !everyoneShares) return null;
  let peer = null;
  let withName = null;
  if (shows.has(userId)) {
    const peers = list.filter((s) => s.user_id !== userId && shows.has(s.user_id));
    if (peers.length === 1 && nameOf(peers[0].user_id)) { peer = peers[0]; withName = nameOf(peer.user_id); }
  }
  let split = 0;
  for (let q = 0; q < count; q += 1) {
    if (peer) {
      if (picksOf(mine, q) !== picksOf(peer, q)) split += 1;
    } else {
      const first = picksOf(list[0], q);
      if (list.some((s) => picksOf(s, q) !== first)) split += 1;
    }
  }
  return { split, of: count, with: withName };
}

/**
 * What this plan lets the student open, drawn beside the teaser.
 *   full     Pro: every week, every Mob
 *   sample   free: the sample week (claimed, or about to be claimed by opening it) shows everything once
 *   offer    free, and the one free side-by-side is still unused: opening it uses it
 *   locked   free, and the sample went to another week
 * `available` is false until you sat and at least 2 have sat. `needsShare` says opening it would show only your own
 * row, because you or everyone else keeps their answers private: the offer is then not spent.
 */
export function compareSummary({ pro, sample, mobId, week, sittings, userId, members, nameOf, count }) {
  const list = Array.isArray(sittings) ? sittings : [];
  const mine = list.find((s) => s?.user_id === userId);
  const available = Boolean(mine) && list.length >= 2;
  const share = sharingSet(members);
  const youShare = share.has(userId);
  const peersShare = list.some((s) => s.user_id !== userId && share.has(s.user_id));
  const teaser = computeTeaser(list, { userId, share, nameOf, count });
  let access = 'locked';
  if (pro) access = 'full';
  else if (sample && sample.mob_id === mobId && String(sample.week_start).slice(0, 10) === week) access = 'sample';
  else if (!sample) access = 'offer';
  return {
    available, access, youShare, needsShare: available && !(youShare && peersShare),
    teaser: teaser ? { ...teaser, text: teaserLine(teaser) } : null,
  };
}

/**
 * The side-by-side payload (GET /api/mob/compare). Only built for a student who sat and for a plan that may open it.
 *   state     mob_state's answer for the week (members and sittings, rows as the database returns them)
 *   ids       the paper's question ids in order; questions: [{ id, stem, correctIndex }] in the same order (missing ones
 *             are left out of the payload, never guessed)
 *   memberIdFor(userId) -> memberId (user ids never leave the server)
 *   trapName  the trap atlas name for the shared trap, when known
 * Returns { ... } as documented in docs/design-decisions/pass-1016e/SOCIAL-APP-CONTRACT.json "compare".
 */
export function buildCompare({ members, sittings, ids, questions, userId, memberIdFor, access, kind = 'weekly', week, extra = null, trapName = null, nameOf }) {
  const list = Array.isArray(sittings) ? sittings : [];
  const byUser = new Map(list.map((s) => [s.user_id, s]));
  const mine = byUser.get(userId);
  const share = sharingSet(members);
  const youShare = share.has(userId);
  // P5: join order, whatever order the rows arrived in; never by score.
  const memberOrder = [...(Array.isArray(members) ? members : [])].sort((a, b) => (Date.parse(a.joined_at) || 0) - (Date.parse(b.joined_at) || 0) || String(a.user_id).localeCompare(String(b.user_id)));
  const shown = memberOrder.filter((m) => m.user_id !== userId && byUser.has(m.user_id) && youShare && share.has(m.user_id));
  const otherSitters = list.filter((s) => s.user_id !== userId);
  // The sitters this student can read: themselves, and the members shown to them (who share, when they share).
  const readable = [...(mine ? [mine] : []), ...shown.map((m) => byUser.get(m.user_id))];
  const qs = new Map((questions || []).map((q) => [q.id, q]));
  const keys = (ids || []).map((id) => (Number.isInteger(qs.get(id)?.correctIndex) ? qs.get(id).correctIndex : -1));
  const trapRaw = list.length >= TRAP_MIN_SITTERS ? computeTrap(list, keys) : null;
  const row = (s, q, key) => {
    const given = picksOf(s, q);
    const t = Array.isArray(s?.detail?.t) ? s.detail.t[q] : null;
    const c = Array.isArray(s?.detail?.c) ? s.detail.c[q] : null;
    return {
      picked: given >= 0 ? letterFor(given) : null,
      right: key >= 0 ? given === key : null,
      changed: Number.isInteger(c) && c >= 0 ? c : null,
      seconds: Number.isInteger(t) && t >= 0 ? t : null,
    };
  };
  const questionsOut = [];
  (ids || []).forEach((id, q) => {
    const info = qs.get(id);
    if (!info) return;
    const key = keys[q];
    // Only the sitters this student can read are counted: a private member's pick is in neither the counts nor the split.
    const counts = new Map();
    for (const s of readable) { const p = picksOf(s, q); counts.set(p, (counts.get(p) || 0) + 1); }
    const first = picksOf(readable[0], q);
    const split = readable.length >= 2 ? readable.some((s) => picksOf(s, q) !== first) : null;
    questionsOut.push({
      number: q + 1,
      id,
      stem: clip(info.stem),
      key: key >= 0 ? letterFor(key) : null,
      you: mine ? row(mine, q, key) : null,
      others: shown.map((m) => ({ memberId: memberIdFor(m.user_id), name: m.display_name, colour: m.colour, ...row(byUser.get(m.user_id), q, key) })),
      // How the readable members picked: counts per option, no names, only with 3 or more of them (P7).
      picks: readable.length >= TRAP_MIN_SITTERS
        ? [...counts].filter(([p]) => p >= 0).sort((a, b) => a[0] - b[0]).map(([p, n]) => ({ option: letterFor(p), count: n })).concat(counts.get(-1) ? [{ option: null, count: counts.get(-1) }] : [])
        : null,
      split,
      trap: trapRaw && trapRaw.questionIndex === q ? { option: letterFor(trapRaw.optionIndex), count: trapRaw.count, of: trapRaw.of, trapName } : null,
    });
  });
  const teaser = computeTeaser(list, { userId, share, nameOf, count: ids?.length || 0 });
  return {
    kind, week, extraId: extra?.id || null, chapter: extra?.chapter || null,
    access, youShare, sat: list.length, size: memberOrder.length,
    // Sitters you are not shown: they keep their answers private, or you do. Counted, never named.
    hidden: Math.max(0, otherSitters.length - shown.length),
    teaser: teaser ? { ...teaser, text: teaserLine(teaser) } : null,
    questions: questionsOut,
  };
}
