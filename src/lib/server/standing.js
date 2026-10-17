// A student's own standing on the practice points board, and nothing else about anyone else.
// The ranking source (Database.getLeaderboard -> mm_leaderboard) is every recorded attempt, all time: one
// row per student with at least one attempt, ordered by total points. This module reduces that list to the
// caller's own position. No name, image or user id of any other student leaves it.

export const STANDING_WINDOW = 'all time';

// Rank is competition ranking: 1 + the number of students with strictly more points, so equal totals share
// a rank and nobody is placed behind a tie by accident of ordering.
export function standingFor(rows, userId) {
  const list = Array.isArray(rows) ? rows : [];
  if (!userId) return { you: null, window: STANDING_WINDOW };
  const mine = list.find((row) => row && row.userId === userId);
  if (!mine) return { you: null, window: STANDING_WINDOW };
  const points = Number(mine.totalScore) || 0;
  const tests = Number(mine.tests) || 0;
  let ahead = 0;
  for (const row of list) if ((Number(row?.totalScore) || 0) > points) ahead += 1;
  return {
    you: { rank: ahead + 1, of: list.length, tests, average: tests ? Math.round(points / tests) : 0, points },
    window: STANDING_WINDOW,
    board: boardFor(list, points),
  };
}

// The board around the caller, with nobody in it identifiable (W-055: the richer board, privacy-safe): no name, id, image
// or row of anyone else, only places and counts.
//   toNext   points the caller needs to share the next place up (0 when first)
//   top      the share of ranked students at or above the caller, as a whole percent ("top 7%")
//   ladder   the top 10 places as { place, points, mocks } (anonymous), and only on a board of at least LADDER_MIN students,
//            so no small group can be read off it
//   spread   how many students' average points per mock fall in each band of 10, for the same reason only on a big board
export const LADDER_MIN = 20;
export const LADDER_SIZE = 10;

export function boardFor(list, points) {
  const totals = list.map((row) => Number(row?.totalScore) || 0);
  const above = totals.filter((t) => t > points);
  const toNext = above.length ? Math.min(...above) - points : 0;
  const top = list.length ? Math.max(1, Math.ceil(((above.length + 1) / list.length) * 100)) : 100;
  if (list.length < LADDER_MIN) return { toNext, top, ladder: null, spread: null };
  const sorted = [...list].map((row) => ({ points: Number(row?.totalScore) || 0, mocks: Number(row?.tests) || 0 })).sort((x, y) => y.points - x.points);
  const ladder = [];
  for (let i = 0; i < Math.min(LADDER_SIZE, sorted.length); i += 1) {
    const ahead = sorted.filter((r) => r.points > sorted[i].points).length;
    ladder.push({ place: ahead + 1, points: sorted[i].points, mocks: sorted[i].mocks });
  }
  const spread = Array.from({ length: 10 }, (_, k) => ({ from: k * 10, to: k * 10 + 9, students: 0 }));
  for (const r of sorted) {
    const avg = r.mocks ? r.points / r.mocks : 0;
    const k = Math.max(0, Math.min(9, Math.floor(avg / 10)));
    spread[k].students += 1;
  }
  return { toNext, top, ladder, spread };
}

// How many live questions the three most active contributors have, as bare counts. The rows carry an
// uploader id only so they can be grouped; the result has no id, name or image.
export function topContributorCounts(rows, limit = 3) {
  const counts = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = row?.uploaded_by || row?.author_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.values()].sort((a, b) => b - a).slice(0, limit).map((count) => ({ count }));
}
