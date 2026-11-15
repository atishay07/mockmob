// "Resume your paper" (15 Nov 2026, bugs-core B2b). A practice paper lives on the device until it is sent, so a paper left
// by the phone's Back, a closed tab or another app is found again here: this user's drafts that can still be sent, with what
// the row on Practice and Today needs. Pure; src/components/practice/ResumePaper.jsx reads storage and draws the row.
import { answeredCount, draftFate, isPaperDraftKey } from './draft.mjs';

/** Only the runner's own address may come back out of storage as a link. */
const safeHref = (href) => typeof href === 'string' && /^\/test\?[^\s<>"']*$/.test(href) && href.length < 4000;

/**
 * The papers this user can still go back to, soonest deadline first. `entries` is [key, value] pairs from storage (see
 * storedDrafts in draft.mjs). Each: { key, href, subject, mode, answered, total, endsAt, state, msLeft }, where state is
 * 'running' (time left) or 'sending' (time is up and the answers are not sent: opening it sends them, inside the upload grace or,
 * B8, as a late paper for 7 days after the timer).
 */
export function livePapers(entries, userId, now) {
  const out = [];
  for (const [key, raw] of entries || []) {
    if (!isPaperDraftKey(key, userId)) continue;
    let saved = null;
    try { saved = JSON.parse(raw); } catch { continue; }
    const fate = draftFate(saved, now);
    if (fate !== 'live' && fate !== 'grace' && fate !== 'late') continue;
    const paper = saved.paper;
    if (!paper || !safeHref(paper.href)) continue;
    out.push({
      key,
      href: paper.href,
      subject: String(paper.subject || ''),
      mode: String(paper.mode || ''),
      answered: answeredCount(saved.answers),
      total: saved.questions.length,
      endsAt: saved.endsAt,
      state: fate === 'live' ? 'running' : 'sending',
      msLeft: Math.max(0, saved.endsAt - now),
    });
  }
  return out.sort((a, b) => a.endsAt - b.endsAt);
}

/** "12 min left", "Under 1 min left": whole minutes, never rounded up past what the timer shows. */
export function timeLeftWords(msLeft) {
  if (!(msLeft >= 60000)) return 'Under 1 min left';
  return `${Math.floor(msLeft / 60000)} min left`;
}

/** The row's words: { title, line, key, label } (label is the whole row read aloud). */
export function resumeCopy(paper) {
  const title = [paper.subject, paper.mode].filter(Boolean).join(', ') || 'Your paper';
  const done = `${paper.answered} of ${paper.total} answered`;
  if (paper.state === 'sending') {
    const line = `${done}. Time is up: open it to send your answers.`;
    return { title, line, key: 'Send', label: `${title}. ${line} Send.` };
  }
  const left = timeLeftWords(paper.msLeft);
  const line = `${done}, ${left.charAt(0).toLowerCase()}${left.slice(1)}`;
  return { title, line, key: 'Resume', label: `Resume ${title}. ${line}.` };
}
