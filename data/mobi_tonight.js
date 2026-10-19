// "What should I revise tonight?" (C-dec 3 item 2, 20 Oct 2026): free, read from the record, no model call. It replaced a
// 1-credit written paragraph. Pure, so data/tests/mobi_tonight.test.mjs pins it; the chat route reads the parts and calls it.
//
// The pack: the chapters that cost the most marks, the rules the student kept from their own repairs, the traps that catch
// them most, and how many Revise cards are due. Every line is read from the record; a part with nothing to read is left out.

import { practiceLink } from './mobi_standing.js';

const TONIGHT = /\b(revise|revision|last look)\b.*\b(tonight|today|now)\b|\btonight\b.*\brevise\b/i;

/** True for "What should I revise tonight?" and its plain variants (so the old app's text is free too). */
export const asksTonight = (text) => TONIGHT.test(String(text || ''));

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const dayWord = (now = new Date()) => {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(now));
  return hour >= 17 || hour < 4 ? 'tonight' : 'today';
};

/**
 * @param insights   computePrepOSInsights output
 * @param rules      [{ text, chapter }] from the rule book (the student's own repairs), newest first
 * @param traps      buildTrapsMeet(...).rows
 * @param reviseDue  number of Revise cards due today
 */
export function tonightPack({ insights = null, rules = [], traps = [], reviseDue = 0, now = new Date() } = {}) {
  const when = dayWord(now);
  const ranked = insights?.state === 'ready' ? insights.chapters?.ranked || [] : [];
  const chapters = ranked.slice(0, 2).map((c) => ({ subject: c.subject, subjectName: c.subjectName, chapter: c.chapter, lost: c.open }));
  const kept = (rules || []).map((r) => (typeof r === 'string' ? r : r?.text)).filter((t) => typeof t === 'string' && t.trim()).slice(0, 5);
  const top = (traps || []).filter((t) => t && t.caught > 0).slice(0, 3).map((t) => ({ trapType: t.trapType, phrase: t.label, caught: t.caught, chances: t.of }));
  const due = Math.max(0, Number(reviseDue) || 0);

  const lines = [];
  if (due) lines.push(`Start with Revise: ${plural(due, 'card is', 'cards are')} due. They are your own past mistakes, asked again.`);
  if (chapters.length) lines.push(`Then ${chapters.map((c) => `${c.chapter} (${c.lost} marks lost)`).join(' and ')}, where your answers cost you the most.`);
  if (kept.length) lines.push(`Read the ${plural(kept.length, 'rule')} you kept from your repairs: ${kept.map((t) => `"${t.replace(/[.\s]+$/, '')}"`).join('; ')}.`);
  if (top.length) lines.push(`Watch for ${top.map((t) => `${t.phrase.toLowerCase()} (it caught you ${t.caught} of ${t.chances} times)`).join(', ')}.`);
  const empty = !lines.length;
  const reply = empty
    ? `There is nothing in your record to revise ${when} yet. Finish one practice set and Mobi builds this from your own answers.`
    : `For ${when}, from your own record:\n${lines.join('\n')}\nThat is enough for one sitting.`;

  const actions = [];
  if (due) actions.push({ label: 'Open Revise', type: 'navigate', route: '/review/revise' });
  if (chapters[0]) actions.push({ label: `Practise ${chapters[0].chapter}`, type: 'navigate', route: practiceLink(chapters[0].subject, chapters[0].chapter) });
  if (empty) actions.push({ label: 'Start a practice set', type: 'navigate', route: '/dashboard?mode=quick' });
  return { reply, actions, tonight: { when, chapters, rules: kept, traps: top, reviseDue: due, line: empty ? null : lines[0] } };
}
