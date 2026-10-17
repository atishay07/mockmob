// What the Mob's entry lines say (MobEntry.jsx), as pure functions of the server's view, so node:test reads them
// (data/tests/mob_fix_1017.test.mjs). Relative imports only.
import { canAfford, costLine, nudgeLine, paperHref, paperLine, resultHref, ringLine } from '../../lib/mob/model.mjs';

/** The moment: a study week met, or 7 saved sessions. Returns the true reason in words, or null. */
export function inviteMoment(rhythm) {
  const counts = rhythm?.counts || {};
  if (Number(counts.weeksMet) >= 1) return 'You met your study goal for a week.';
  if (Number(counts.sessions) >= 7) return `You have saved ${Number(counts.sessions)} sessions.`;
  return null;
}

/** What one member's line says on each page, from the server's view. Null when there is nothing true to say. */
export function entryFor(where, data) {
  if (!data?.week) return null;
  const { week } = data;
  const several = (data.mobs || []).length > 1;
  const name = several ? `Your ${data.subjectName} Mob` : 'Your Mob';
  const open = !week.youSat && !week.closed && week.paper.blocked !== 'free_used' && canAfford(week.paper.cost);
  if (where === 'review') {
    if (!week.youSat) return null;
    if (data.trap) {
      const t = data.trap;
      const what = t.trapName ? ` Trap: ${t.trapName}.` : '';
      const you = t.youGotItRight ? 'You got it right.' : t.youPickedIt ? `You picked ${t.option} too.` : 'You did not pick it.';
      return { title: `${name}'s trap: question ${t.questionNumber}`, line: `${t.count} of ${t.of} picked ${t.option}.${what} ${you}`, href: week.yourResultId ? resultHref(week.yourResultId) : '/mob' };
    }
    const teaser = data.compare?.teaser?.text;
    return teaser ? { title: `${name}: ${ringLine(week.sat, week.size)}`, line: teaser, href: '/mob' } : null;
  }
  if (where === 'practice') {
    if (open) return { title: `Mob paper, ${data.subjectName}, ${paperLine()}`, line: `${ringLine(week.sat, week.size)}. ${costLine(week.paper.cost)}`.trim(), href: paperHref(data), key: 'Sit it' };
    if (week.youSat && week.yourResultId) return { title: `Mob paper, ${data.subjectName}: sat`, line: `${ringLine(week.sat, week.size)}.`, href: resultHref(week.yourResultId), key: 'See your answers' };
    return null;
  }
  // Today
  const received = data.nudge?.received ? nudgeLine(data.nudge.received.fromName) : null;
  if (open && week.size > 1) return { title: `${name}: ${ringLine(week.sat, week.size)}`, line: received || `This week's ${data.subjectName} paper: ${paperLine()}, no credits.`, href: paperHref(data), key: 'Sit it', ring: true };
  if (week.size === 1) return { title: `${name} is just you so far`, line: 'Send the link to a friend. The ring fills as you sit the same paper.', href: '/mob', key: 'Invite a friend' };
  return { title: `${name}: ${ringLine(week.sat, week.size)}`, line: week.youSat ? 'You sat this week\'s paper.' : week.closed ? 'This week\'s paper closed. The next one opens Monday.' : 'See where your Mob is this week.', href: '/mob', key: 'See your Mob', ring: true };
}
