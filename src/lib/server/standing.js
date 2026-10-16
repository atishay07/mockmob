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
    you: { rank: ahead + 1, of: list.length, tests, average: tests ? Math.round(points / tests) : 0 },
    window: STANDING_WINDOW,
  };
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
