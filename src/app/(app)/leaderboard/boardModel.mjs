// Leaderboard rows as words (web redesign W2.4). Pure; tested in boardModel.test.mjs.
// Practice rivals are simulated benchmarks and always say so; a missing name is "A student".

const whole = (v) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

export function boardRows(entries, userId) {
  const list = Array.isArray(entries) ? entries.filter((e) => e && e.userId) : [];
  return list.map((e, i) => {
    const you = Boolean(userId) && e.userId === userId;
    return {
      key: String(e.userId),
      place: i + 1,
      name: (typeof e.name === 'string' && e.name.trim()) || 'A student',
      kind: you ? 'You' : e.isSynthetic ? 'Practice rival' : 'Student',
      synthetic: Boolean(e.isSynthetic),
      you,
      mocks: whole(e.tests),
      points: whole(e.totalScore),
    };
  });
}

/** "You are 14th of 120 on this board." or null when the student is not on it. */
export function yourPlace(rows) {
  const me = rows.find((r) => r.you);
  if (!me) return null;
  return `You are ${ordinal(me.place)} of ${rows.length} on this board, with ${me.points} ${me.points === 1 ? 'point' : 'points'}.`;
}

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}
