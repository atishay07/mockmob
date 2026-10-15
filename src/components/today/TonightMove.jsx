"use client";

// Tonight's move: the one hero Today, the Start sheet and a result's last card share (plan 5.2).
// IA2 owns this file. The rules live in data/next_step_rules.mjs; this component only draws one move.
//
// Props (the contract IA0 set, with `aside`, `error` and `onRetry` added for Today):
//   move       nextMove() from data/next_step_rules.mjs, or null while loading. Shape:
//              { id, rule, label, title, detail, cost, primary: { label, href }, secondary?,
//                away: { days, line } | null, others: [{ id, title, label, href }], othersLabel,
//                more: { label, href } }
//   loading    true while the facts load: the same box as a skeleton (no layout shift)
//   error      true when the facts could not be read: the same box says so and offers a way on
//   onRetry    () => void, the Try again button of the error state
//   compact    true on the Start sheet and a result's last card: no away line, no "others", no aside
//   aside      optional node beside the text (Today's Mobi). Never laid over the text.
//   onPrimary  optional (move) => void, called before navigation (analytics, a guide stop)
//   headingLevel  2 by default; the title's heading level
//
// One primary per state. Everything else (the secondary link, "Something else instead") is quieter.
// Motion answers a tap: the list under "Something else instead" opens in 220 ms and the chevron turns;
// reduced motion (device or the student's setting) makes both instant.
import Link from 'next/link';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './today.css';

const PRACTICE = '/dashboard';

export default function TonightMove({ move = null, loading = false, error = false, onRetry = null, compact = false, aside = null, onPrimary = null, headingLevel = 2 }) {
  const [othersOpen, setOthersOpen] = useState(false);
  const uid = useId();
  const Heading = `h${Math.min(6, Math.max(2, headingLevel))}`;
  const cls = `tm${compact ? ' tm--compact' : ''}`;

  if (error) {
    return (
      <section className={`${cls} tm--error`} data-move="error" aria-labelledby={`${uid}-title`}>
        <div className="tm__main">
          <Heading id={`${uid}-title`} className="tm__title">Your earlier results are still there.</Heading>
          <p className="tm__detail" role="alert">Could not load a suggestion.</p>
          <div className="tm__actions">
            {onRetry && <button type="button" className="btn-volt md mk-press tm__primary" onClick={onRetry}>Try again</button>}
            <Link className="tm__alt" href={PRACTICE}>Choose practice</Link>
          </div>
        </div>
      </section>
    );
  }
  if (loading || !move) {
    return (
      <section className={`${cls} tm--loading`} aria-busy="true" aria-label="Loading your next step" data-move="loading">
        <div className="tm__main" aria-hidden="true">
          <i className="tm__sk tm__sk--label" />
          <i className="tm__sk tm__sk--title" />
          <i className="tm__sk tm__sk--line" />
          <i className="tm__sk tm__sk--btn" />
        </div>
      </section>
    );
  }
  const hasOthers = !compact && (move.others?.length > 0 || move.more);
  return (
    <section className={cls} data-move={move.id} aria-labelledby={`${uid}-title`}>
      <div className="tm__body">
        <div className="tm__main">
          {!compact && move.away && <p className="tm__away">{move.away.line}</p>}
          <p className="tm__label">{move.label}</p>
          <Heading id={`${uid}-title`} className="tm__title">{move.title}</Heading>
          {move.detail && <p className="tm__detail">{move.detail}</p>}
          {move.cost && <p className="tm__cost">{move.cost}</p>}
          <div className="tm__actions">
            <Link className="btn-volt md mk-press tm__primary" href={move.primary.href} onClick={() => onPrimary?.(move)}>{move.primary.label}</Link>
            {move.secondary && <Link className="tm__alt" href={move.secondary.href}>{move.secondary.label}</Link>}
          </div>
        </div>
        {!compact && aside ? <div className="tm__aside">{aside}</div> : null}
      </div>
      {hasOthers && (
        <div className="tm__others" data-open={othersOpen ? 'true' : 'false'}>
          <button type="button" className="tm__toggle" aria-expanded={othersOpen} aria-controls={`${uid}-others`} onClick={() => setOthersOpen((open) => !open)}>
            {move.othersLabel}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <div className="tm__drawer" id={`${uid}-others`} inert={!othersOpen}>
            <ul>
              {(move.others || []).map((other) => (
                <li key={other.id}><Link href={other.href}><span>{other.title}</span><small>{other.label}</small></Link></li>
              ))}
              {move.more && <li><Link href={move.more.href}><span>{move.more.label}</span></Link></li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
