"use client";
// The Mob's comparison (SOCIAL-SPEC section 15). Free: the teaser (where the Mob split, one line) and one free
// side-by-side. Pro: the side-by-side every week. What a student may open is decided on the server (/api/mob/compare);
// this file only draws what it was given and says plainly what is waiting behind Pro.
//   - Sharing is reciprocal and the student's own choice (rule 14): on by default inside the Mob (17 Oct CTO decision),
//     one switch turns it off, and it says who sees what. Members who keep their answers private are counted, never named (P6). Nothing ranks anyone (P5).
//   - One primary action per state (rule 7): the key here is outlined; the page's volt stays on the paper itself.
//   - The Pro line says what Pro adds and never counts down, discounts or shames (T005, T009).
import Link from 'next/link';
import { ToggleRow } from '@/components/ui/controls/ToggleRow';
import { initialOf, resultHref } from '@/lib/mob/model.mjs';
import { changedLabel, countLabel, secLabel, verdictWord, weekLabel } from './mobFormat';

export const SHARE_LABEL = 'Share my score and answers with my Mob';
export const SHARE_HINT = 'On by default. Members who share see what each other picked, how long it took and how they scored, only inside this Mob, never a ranking. Turn it off to keep yours to yourself.';
export const LOCKED_NOTE = 'The full side-by-side is included with Pro: who picked what, who changed an answer, and how long each question took.';

/** The teaser, and the one key that opens the side-by-side when this plan may. `compare` is the view's summary. */
export function CompareCard({ compare, busy = false, opening = false, onOpen, onShare, subtitle = null, notice = null, headingId = 'mob-compare-h', openId }) {
  if (!compare) return null;
  const { access, youShare, needsShare, teaser } = compare;
  const shareRow = !youShare && access !== 'locked' ? (
    <ToggleRow checked={false} onChange={() => onShare(true)} disabled={busy} label={SHARE_LABEL} hint={SHARE_HINT} />
  ) : null;
  let note = null;
  if (access === 'offer') note = needsShare ? (youShare ? 'Your first side-by-side is free. It opens once another member shares their answers.' : 'Your first side-by-side is free. Share your answers to open it.') : 'Your first side-by-side is free.';
  if (access === 'sample') note = 'This is your free first side-by-side, so it stays open for this week.';
  if (access === 'locked') note = LOCKED_NOTE;
  const canOpen = access === 'full' || access === 'sample' || (access === 'offer' && !needsShare);
  return (
    <section className="glass mob-card mob-compare mk-rise" aria-labelledby={headingId}>
      <h2 id={headingId} className="mob-h3">{subtitle ? `Compare: ${subtitle}` : 'Compare with your Mob'}</h2>
      {teaser ? <p className="mob-compare__teaser">{teaser.text}</p> : <p className="mob-note">{youShare ? 'Your answers are shared. Comparing opens when another member shares theirs.' : 'Share your answers to compare this paper with your Mob.'}</p>}
      {note ? <p className="mob-note">{note}</p> : null}
      {shareRow}
      {canOpen || access === 'locked' ? (
        <div className="mob-actions mob-actions--row">
          {canOpen ? <button type="button" id={openId} className="mob-key" onClick={onOpen} disabled={opening} aria-busy={opening || undefined}>{opening ? 'Opening' : 'See the side-by-side'}</button> : null}
          {access === 'locked' ? <Link className="mob-key" href="/pricing" data-pro-feature="mob">See Pro</Link> : null}
        </div>
      ) : null}
      <p className="mob-notice" role="status" aria-live="polite">{notice || ''}</p>
    </section>
  );
}

const Row = ({ m, you }) => (
  <li className="mob-pickrow" data-you={you || undefined}>
    <span className="mob-disc" data-colour={m.colour} aria-hidden="true">{initialOf(m.name)}</span>
    <span className="mob-pickrow__who">
      <b>{you ? 'You' : m.name}</b>
      <span>{[m.changed > 0 ? changedLabel(m.changed) : null, m.seconds !== null && m.seconds !== undefined ? secLabel(m.seconds) : null].filter(Boolean).join('. ')}</span>
    </span>
    <span className="mob-pickrow__pick" data-verdict={m.right === true ? 'right' : m.right === false ? 'wrong' : 'none'}>
      <b>{m.picked || 'None'}</b>
      <span>{verdictWord(m)}</span>
    </span>
  </li>
);

function Question({ q, mine, resultId, partial = false }) {
  const youRow = q.you ? { ...q.you, name: mine.name, colour: mine.colour } : null;
  return (
    <li className="mob-q" data-split={q.split || undefined} data-trap={q.trap ? '' : undefined}>
      <div className="mob-q__top">
        <b>Question {q.number}</b>
        <span className="mob-q__meta">
          {q.split ? <span className="mob-q__tag">Split</span> : null}
          {q.key ? <span>Answer {q.key}</span> : null}
        </span>
      </div>
      {q.stem ? <p className="mob-q__stem">{q.stem}</p> : null}
      <ul className="mob-q__rows" aria-label={`Picks for question ${q.number}`}>
        {youRow ? <Row m={youRow} you /> : null}
        {q.others.map((o) => <Row key={o.memberId} m={o} />)}
      </ul>
      {q.picks && q.picks.length ? <p className="mob-hint">{partial ? 'How you and the members who share picked' : 'How your Mob picked'}: {q.picks.map((p) => `${p.option || 'No answer'} ${p.count}`).join(', ')}.</p> : null}
      {q.trap ? (
        <div className="mob-q__trap">
          <p className="mob-note"><b>Your Mob&apos;s trap:</b> {q.trap.count} of {q.trap.of} picked {q.trap.option}. {q.trap.trapName ? `Trap: ${q.trap.trapName}.` : 'A common wrong pick.'}</p>
          {resultId ? <Link className="mob-key" href={`${resultHref(resultId)}#q-${q.number}`}>{q.you?.right ? `See why ${q.trap.option} is wrong` : 'Repair it'}</Link> : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The side-by-side itself: `data` is the compare payload. It replaces the Mob page's body until the student goes back,
 * so a phone gets the whole width for the rows.
 */
export function SideBySide({ data, mine, onBack, onShare, busy, headingRef }) {
  const title = data.kind === 'extra' ? `${data.chapter || 'Whole subject'}, ${countLabel(data.questions.length, 'question')}` : weekLabel(data.week);
  return (
    <section className="glass mob-card mob-sbs" aria-labelledby="mob-sbs-h">
      <header className="mob-sbs__head">
        <button type="button" className="mob-link" onClick={onBack}>Back to your Mob</button>
        <h2 id="mob-sbs-h" className="mob-h2" tabIndex={-1} ref={headingRef}>Side by side: {title}</h2>
        <p className="mob-note">{data.sat} of {data.size} sat.{data.hidden > 0 ? ` ${countLabel(data.hidden, 'member keeps', 'members keep')} their answers private.` : ''}</p>
        {data.teaser ? <p className="mob-compare__teaser">{data.teaser.text}</p> : null}
        {/* The paper is still open for the Mob (src/lib/mob/paperHold.mjs): picks and splits now, the answers when it closes. */}
        {data.held ? <p className="mob-note mob-sbs__held"><b>{data.held.short}</b> Until then you see what everyone picked and where you split, but not who was right.</p> : null}
        {data.access === 'sample' ? <p className="mob-note">This is your free first side-by-side. Pro opens it every week, with past weeks and extra papers.</p> : null}
        {!data.youShare ? (
          <ToggleRow checked={false} onChange={() => onShare(true)} disabled={busy} label={SHARE_LABEL}
            hint="You see what members who share picked, and they see yours. Never a ranking." />
        ) : null}
      </header>
      {data.questions.length ? (
        <ol className="mob-qs">
          {data.questions.map((q) => <Question key={q.id} q={q} mine={mine} resultId={data.yourResultId} partial={data.hidden > 0} />)}
        </ol>
      ) : <p className="mob-note">The questions of this paper are not available to show just now. Your result is still yours to open.</p>}
      <p className="mob-hint mob-sbs__foot">Seconds come from your device&apos;s own record of the paper. A question shows no time when the record did not keep one.</p>
    </section>
  );
}
