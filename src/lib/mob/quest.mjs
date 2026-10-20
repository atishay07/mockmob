// The weekly quest (MOB-BUILD-SPEC-V3 2.2, 3.1 quest, C2; C-dec 2 item 5). Pure. Every question answered in a Mob game or
// paper counts, right or wrong; skips do not. The target is 15 per member who has not stepped out, at least 15. Ticks
// hold no user id, so leaving never lowers a quest (F8). Counters are true past the goal: 70 of 60 is 70.
export const PER_MEMBER = 15;
export const questTarget = (members, stepOuts = 0) => Math.max(PER_MEMBER, PER_MEMBER * (Math.max(0, Number(members) || 0) - Math.max(0, Number(stepOuts) || 0)));

const FORMAT_WORD = { sprint: 'sprint', round: 'round', rematch: 'rematch', race: 'race', mock: 'full mock' };
/** "Riya's sprint", "Your race", "Riya's full mock". A game is named by its host, never by who played it. */
export const gameTitle = (hostName, format, you = false) => `${you ? 'Your' : `${hostName || 'A friend'}'s`} ${FORMAT_WORD[format] || 'game'}`;

/**
 * The "What filled it" rows: by game or paper, never by person, never a count of people. rows: mob_quest_week by_source
 * ([{ source, source_id, answered }]); games: Map(gameId -> { hostName, format, hostIsYou }); extras: Map(id -> chapter).
 * Rows with the same label are summed; the most answered come first.
 */
export function questLabels(rows, { games = new Map(), extras = new Map() } = {}) {
  const out = [];
  const add = (label, n) => {
    const hit = out.find((r) => r.label === label);
    if (hit) hit.answered += n; else out.push({ label, answered: n });
  };
  for (const r of rows || []) {
    const n = Math.max(0, Number(r.answered) || 0);
    if (!n) continue;
    if (r.source === 'paper') add("This week's Mob paper", n);
    else if (r.source === 'extra') add(extras.get(r.source_id) ? `Extra paper on ${extras.get(r.source_id)}` : 'An extra paper', n);
    else if (r.source === 'game') {
      const g = games.get(String(r.source_id));
      add(g ? gameTitle(g.hostName, g.format, g.hostIsYou) : 'A Mob game', n);
    } else if (r.source === 'fix') add('Fix it together', n);
  }
  // Most first, then by name, so the list reads the same on every device.
  return out.sort((a, b) => b.answered - a.answered || a.label.localeCompare(b.label));
}

/** The quest block of the den view. q: mob_quest_week's answer. */
export function questView(q, { week, youSteppedOut = false, labels = [], parcel = null }) {
  const target = Number(q?.target) || PER_MEMBER;
  const answered = Math.max(0, Number(q?.answered) || 0);
  const doneAt = q?.done_at ? new Date(q.done_at).toISOString() : null;
  const sizedFor = Math.max(1, Math.round(target / PER_MEMBER));
  return { week, target, answered, done: Boolean(doneAt), doneAt, sizedFor, youSteppedOut, bySource: labels, parcel };
}
