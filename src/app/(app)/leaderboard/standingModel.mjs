// Your standing, 19 Nov 2026 (lane arena-a): a ladder with you on it. The top ten places and your own place are ONE list:
// ten rows, a gap row ("52 more places"), then your row, with the points to the place above written on it. Pure; every
// figure is the server's (src/lib/server/standing.js): places, totals, mock counts and toNext. Bars share one scale.

export const count = (n) => Number(n).toLocaleString('en-IN');
export const ordinal = (n) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${count(n)}th`;
  return `${count(n)}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
};

/**
 * The place above you, by number, only when the page can prove it: equal totals share a place (competition ranking), so
 * the place above is not always rank minus 1 (two students level on the next total above you make it rank minus 2). It
 * is the place of the ladder row whose total is yours plus toNext; at 2nd it can only be 1st. When that total is not on
 * the ladder (you are far below the ten, or the board has no ladder), the number is unknown and null is returned.
 */
export function placeAbove(standing) {
  const { rank, points, toNext, ladder } = standing || {};
  if (!Number.isFinite(rank) || rank <= 1 || !Number.isFinite(toNext) || toNext <= 0) return null;
  if (rank === 2) return 1;
  if (!Number.isFinite(points)) return null;
  const row = Array.isArray(ladder) ? ladder.find((r) => Number(r?.points) === points + toNext) : null;
  const place = Number(row?.place);
  return Number.isFinite(place) && place >= 1 && place < rank ? place : null;
}

/** "62nd place", or "the next place up" when the number cannot be proved (placeAbove). */
export const placeAboveWords = (standing) => {
  const place = placeAbove(standing);
  return place ? `${ordinal(place)} place` : 'the next place up';
};

/**
 * "14 points to 62nd": the points to share the place above (the page's existing figures), naming the place only when
 * placeAbove proves it, else "14 points to the next place up". None at first place, or unknown.
 */
export function gapLine(standing) {
  const { rank, toNext } = standing || {};
  if (!Number.isFinite(rank) || rank <= 1 || !Number.isFinite(toNext) || toNext <= 0) return null;
  const place = placeAbove(standing);
  return `${count(toNext)} ${toNext === 1 ? 'point' : 'points'} to ${place ? ordinal(place) : 'the next place up'}`;
}

/**
 * The ladder's rows: [{ kind: 'place', place, points, mocks, you, share, gap }] and, when you are below the ten,
 * { kind: 'gap', places, text } then your own row. `share` is points over the largest total shown (one scale, never
 * below 0.02 so a row always has a mark). Equal totals share a place: your row in the ten is the one with your place,
 * your total and your mock count (a level student's row would print their mocks as yours). When none matches, you are
 * level with the last of the ten but listed after them: your own row follows the ten. No ladder (fewer than 20 ranked): null.
 */
export function ladderRows(standing) {
  const ladder = Array.isArray(standing?.ladder) ? standing.ladder : null;
  if (!ladder || !ladder.length) return null;
  const { rank, points, tests } = standing;
  const known = Number.isFinite(points);
  const youAt = known ? ladder.findIndex((r) => r.place === rank && r.points === points && Number(r.mocks) === Number(tests)) : -1;
  const max = Math.max(1, ...ladder.map((r) => r.points), known ? points : 0);
  const share = (p) => Math.max(0.02, Math.min(1, p / max));
  const gap = gapLine(standing);
  const rows = ladder.map((r, i) => ({ kind: 'place', place: r.place, points: r.points, mocks: r.mocks, you: i === youAt, share: share(r.points), gap: i === youAt ? gap : null }));
  if (youAt < 0 && known) {
    // The ten rows are ten students; everyone else ahead of you is in the gap (the page's existing "52 more places").
    const between = rank - 1 - ladder.length;
    if (between > 0) rows.push({ kind: 'gap', places: between, text: `${count(between)} more ${between === 1 ? 'place' : 'places'}` });
    rows.push({ kind: 'place', place: rank, points, mocks: tests, you: true, share: share(points), gap });
  }
  return rows;
}

/**
 * The figures beside the rank, each said once on the page: with the ladder, your total points and mocks are on your row,
 * so only the average stays here; without it, all three. `next` is the sentence about the place above, only when no
 * ladder row carries it (or at first place, which has no gap to show).
 */
export function heroFigures(standing, rows) {
  const onLadder = Array.isArray(rows) && rows.some((r) => r.you);
  const figs = [];
  if (!onLadder) figs.push({ key: 'mocks', label: 'Mocks', value: count(standing.tests) });
  figs.push({ key: 'average', label: 'Average score', value: `${count(standing.average)}%` });
  if (!onLadder && standing.points != null) figs.push({ key: 'points', label: 'Total points', value: count(standing.points) });
  const next = standing.toNext == null ? null : standing.rank === 1 ? 'first' : onLadder ? null : 'gap';
  return { figs, next };
}
