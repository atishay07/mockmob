// The result share card (F-C, 15 Nov 2026): the lines of the picture a student can share after a finished set. The picture
// is drawn in the browser on a canvas (ShareResult.jsx), never on the server: the Next.js in use has an open advisory on
// server-drawn share images that take request values, so nothing here reaches a route.
//
// Every line comes from what the result page already computed (analysis.marks, costliestLine, tomorrowLine, the paper's own
// time and date); nothing new is claimed. The student picks what shows:
//   Show my score  on: the score the CUET way (+5 / -1) with its total, right / wrong / blank, the costliest-chapter line.
//                  off: "10 questions done" and a chapter line that names no marks.
//   Show my name   the first name only (src/lib/displayName.mjs); off, and not offered, when the account has no name.
// A paper with nothing answered has no card (shareable() is false), so a blank paper is never shared.
// Pure: no DOM, no React, so shareCardModel.test.mjs holds it.
import { paperKind, shortDuration } from '../../../data/result_next_move.mjs';

export const CARD_W = 1080;
export const CARD_H = 1350;
export const SITE_LINE = 'mockmob.in';
export const PLAIN_LINK = 'https://www.mockmob.in';

export const SHARE_COPY = Object.freeze({
  open: 'Share your result',
  title: 'Share your result',
  lead: 'A picture of this set to send to friends. Choose what it shows.',
  score: 'Show my score',
  scoreHint: 'Off: the card says how many questions you did, not your marks.',
  name: 'Show my name',
  nameHint: (first) => `Your first name, ${first}.`,
  noName: 'Your account has no name yet. Add one in Account to show it.',
  share: 'Share',
  save: 'Save image',
  cancel: 'Cancel',
  drawing: 'Drawing your card',
  drawFailed: 'The card could not be drawn in this browser. Try again, or take a screenshot of your result.',
  retry: 'Try again',
  // Said when the download starts; the browser, not this page, knows when it has landed.
  saved: 'The image is downloading.',
  copied: 'This browser cannot share. The text and link are copied, so you can paste them.',
  shareFailed: 'The share sheet did not open. Save the image and send it from your gallery.',
  shareTitle: 'My MockMob result',
  textPlain: 'Practising for CUET on MockMob.',
});

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const minus = (n) => (n < 0 ? `−${-n}` : String(n));

/** Whether this paper may have a card: at least one question answered (a blank paper is never shared). */
export function shareable(marks) {
  if (!marks) return false;
  return Number(marks.right) + Number(marks.wrong) > 0;
}

/** "15 November 2026" in the device's calendar (or the given zone, for tests). Empty for an unknown date. */
export function dateInWords(at, { timeZone } = {}) {
  const t = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', ...(timeZone ? { timeZone } : {}) });
}

/** The result page's lines are said to the student ("the marks you missed"); on a card a friend reads, the "you" goes. */
export function neutralLine(line) {
  if (typeof line !== 'string' || !line.trim()) return null;
  return line.trim().replace(/ marks you missed\./, ' marks missed.').replace(/ marks you missed\b/, ' marks missed');
}

/**
 * The card's lines.
 *   subjectName  "Accountancy"
 *   mode         attemptMode(attempt)
 *   total        questions in the set
 *   marks        analysis.marks { scored, max, right, wrong, blank }
 *   durationMs   the set's own time (analysis.timing.totalMs), or null
 *   completedAt  when the set was recorded
 *   finding      costliestLine(...) { line, chapter } or null
 *   tomorrow     tomorrowLine(...) or null
 *   firstName    shownFirstName(user.name, user.email) or null
 *   showScore, showName  the two switches
 * Returns null when the paper is not shareable.
 */
export function shareCard({
  subjectName = '', mode = null, total = 0, marks = null, durationMs = null, completedAt = null,
  finding = null, tomorrow = null, firstName = null, showScore = true, showName = true, timeZone,
} = {}) {
  if (!shareable(marks)) return null;
  const count = Number(total) || Number(marks.right) + Number(marks.wrong) + Number(marks.blank);
  const kind = paperKind(mode);
  const name = showName && typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null;
  const eyebrow = name ? `${name}’s ${kind}` : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  const subject = subjectName ? String(subjectName).trim() : '';
  const time = shortDuration(durationMs) || null;
  const date = dateInWords(completedAt, { timeZone }) || null;

  if (showScore) {
    const scored = Number(marks.scored) || 0;
    const line = neutralLine(finding?.line) || neutralLine(tomorrow);
    return {
      eyebrow,
      subject: subject ? `${subject}, ${plural(count, 'question')}` : plural(count, 'question'),
      score: { value: minus(scored), total: `/ ${marks.max} marks`, negative: scored < 0 },
      done: null,
      stats: [
        { label: 'Right', value: String(marks.right), note: `+${marks.right * 5}` },
        { label: 'Wrong', value: String(marks.wrong), note: marks.wrong ? `−${marks.wrong}` : '0' },
        { label: 'Blank', value: String(marks.blank), note: '0' },
        ...(time ? [{ label: 'Time', value: time, note: null }] : []),
      ],
      time, date, line, foot: SITE_LINE,
      alt: `Share card: ${[eyebrow, subject].filter(Boolean).join(', ')}, ${minus(scored)} of ${marks.max} marks, ${marks.right} right, ${marks.wrong} wrong, ${marks.blank} blank.`,
    };
  }
  // Score off: how much was done, and the chapter to work on next without a mark in it (a "12 of the 18 marks" line would
  // give the score back). A paper with nothing to work on says nothing more.
  const chapter = typeof finding?.chapter === 'string' && finding.chapter.trim() ? finding.chapter.trim() : null;
  return {
    eyebrow,
    subject: subject || null,
    score: null,
    done: `${plural(count, 'question')} done`,
    stats: time ? [{ label: 'Time', value: time, note: null }] : [],
    time, date, line: chapter ? `Next to work on: ${chapter}.` : null, foot: SITE_LINE,
    alt: `Share card: ${[eyebrow, subject].filter(Boolean).join(', ')}, ${plural(count, 'question')} done.`,
  };
}

/** The saved file's name: mockmob-accountancy-2026-11-15.png */
export function cardFileName({ subjectName = '', completedAt = null } = {}) {
  const slug = String(subjectName || 'result').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'result';
  const t = typeof completedAt === 'number' ? completedAt : Date.parse(completedAt);
  const day = Number.isFinite(t) ? new Date(t).toLocaleDateString('en-CA') : '';
  return `mockmob-${slug}${day ? `-${day}` : ''}.png`;
}

/**
 * What Share sends with the picture: the student's own invite link while invites are live (referralView from
 * src/lib/referrals/friendInvite.mjs, which says what both friends get), else the plain site link.
 * { title, text, url }; text already carries the link, since some apps drop `url` when a file is attached.
 */
export function shareMessage(invite = null) {
  if (invite && typeof invite.link === 'string' && invite.link && typeof invite.shareText === 'string') {
    return { title: SHARE_COPY.shareTitle, text: `${invite.shareText} ${invite.link}`, url: invite.link };
  }
  return { title: SHARE_COPY.shareTitle, text: `${SHARE_COPY.textPlain} ${PLAIN_LINK}`, url: PLAIN_LINK };
}

/** The card's colours, following the student's theme (the Arena's roles, arena.css; the logo dot as Logo.jsx sets it). */
export function cardPalette(theme = 'dark') {
  if (theme === 'light') {
    return { bg: '#f3efe6', ink: '#17150f', ink2: '#454036', ink3: '#655f53', line: '#d8d1c2', score: '#17150f', accent: '#526700', dot: '#9db400', bad: '#b0291f' };
  }
  return { bg: '#12110e', ink: '#f4f0e6', ink2: '#bdb6a6', ink3: '#a09989', line: '#312e27', score: '#d2f000', accent: '#d2f000', dot: '#d2f000', bad: '#ffa396' };
}

/**
 * Words to lines inside `maxWidth` with a measuring function (the canvas's measureText in the page, a fixed width per
 * character in tests). At most `maxLines`; the last kept line ends with an ellipsis when words are left over.
 */
export function wrapWords(text, maxWidth, measure, maxLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (let i = 0; i < words.length; i += 1) {
    const next = current ? `${current} ${words[i]}` : words[i];
    if (!current || measure(next) <= maxWidth) { current = next; continue; }
    lines.push(current);
    current = words[i];
    if (lines.length === maxLines) { current = ''; break; }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines || (lines.length === maxLines && lines.join(' ').split(/\s+/).length < words.length)) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && measure(`${last}…`) > maxWidth) last = last.replace(/\s*\S+$/, '');
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}
