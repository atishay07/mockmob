'use client';
// The run's end (B-chapters 3.6 with DESIGN-SPEC A4): what happened in three numbers that count up, the result lines, the
// Revise pile fanned open with its return days, Mobi once with a reaction matched to the result, one volt lead key and three
// named options, each with its reason. Every word and number comes from GET /api/learn/runs/:id/end.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { isMotionReduced } from '@/lib/motion';
import { endAct, numberDetail } from './runMath';

/** A number that counts up from 0 in 400 ms after `delay` (B section 5); reduced motion shows it at once. */
function CountUp({ value, delay = 0 }) {
  const target = Math.max(0, Number(value) || 0);
  const [still] = useState(() => typeof window === 'undefined' || isMotionReduced());
  const [shown, setShown] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (still || !target) return undefined;
    let start = null;
    const tick = (now) => {
      if (start === null) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / 400));
      setShown(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, delay, still]);
  return <span className="lr-num__n">{still || !target ? target : shown}</span>;
}

function splitTitle(title) {
  const m = String(title || '').match(/^(.*?\bminutes? on)\s+(.+)$/i);
  return m ? { lead: m[1], name: m[2] } : { lead: null, name: title };
}

function Option({ option, links, primary = false }) {
  const href = option.href || (option.run ? links.run(option.run) : null);
  if (!href) return null;
  if (primary) {
    return (
      <div className="lr-lead">
        <Link className="kc-btn kc-btn--volt lr-lead__key" data-page-primary="" href={href}>{option.label}</Link>
        {option.evidence ? <p className="lr-lead__why">{option.evidence}</p> : null}
      </div>
    );
  }
  return (
    <li>
      <Link className="lr-opt-row" href={href}>
        <span className="lr-opt-row__main">
          <span className="lr-opt-row__label">{option.label}</span>
          {option.evidence ? <span className="lr-opt-row__why">{option.evidence}</span> : null}
        </span>
        <ChevronRight className="lr-opt-row__chev" size={18} strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </li>
  );
}

/** The Revise pile, fanned open: one small card per return day, its count on it, the day under it. */
function FannedPile({ groups }) {
  const list = (groups || []).filter((g) => Number(g?.count) > 0);
  if (!list.length) return null;
  const total = list.reduce((s, g) => s + Number(g.count), 0);
  return (
    <section className="lr-fan" aria-label={`${total} ${total === 1 ? 'card' : 'cards'} in Revise from this run`}>
      <p className="lr-fan__head"><b>{total}</b> {total === 1 ? 'card joined' : 'cards joined'} Revise</p>
      <ol className="lr-fan__cards" style={{ '--n': list.length }}>
        {list.map((g, i) => (
          <li key={`${g.label}-${i}`} className="lr-fan__card" style={{ '--i': i, '--r': `${(i - (list.length - 1) / 2) * 5}deg` }}>
            <span className="lr-fan__count">{g.count}</span>
            <span className="lr-fan__label">{g.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function RunEnd({ state, tally, kind = 'mix', closeHref, links, onRetry }) {
  const headRef = useRef(null);
  useEffect(() => { if (state.status === 'ready') headRef.current?.focus({ preventScroll: true }); }, [state.status]);
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="lr-skel lr-skel--end" aria-busy="true" aria-label="Adding up your run">
        <span className="skeleton lr-skel__top" />
        <span className="skeleton lr-skel__nums" />
        <span className="skeleton lr-skel__card" />
      </div>
    );
  }
  if (state.status === 'error' || !state.data) {
    return (
      <div className="kc-quiet-state lr-state" role="alert">
        <h1>Your run is saved</h1>
        <p>Its summary did not load. Every rating and answer is already in.</p>
        <div className="lr-state__keys">
          <button type="button" className="kc-btn kc-btn--volt" onClick={onRetry}>Try again</button>
          <Link className="kc-btn kc-btn--quiet" href={closeHref}>Back to the chapter</Link>
        </div>
      </div>
    );
  }
  const d = state.data;
  const { lead, name } = splitTitle(d.title);
  const n = d.numbers || {};
  // Mobi reacts to the result once (R6): a nod at 80 percent right or better, thinking after 3 or more missed cards.
  const act = endAct(tally);
  // One detail under each number (R6), so the numbers are not said twice: the server's numbers.detail, else its line for it.
  const lineFor = (label) => (d.lines || []).find((l) => String(l.label).toLowerCase() === label);
  const detail = (key, label) => n.detail?.[key] ?? numberDetail(lineFor(label));
  const nums = [
    { value: n.cards, label: Number(n.cards) === 1 ? 'card rated' : 'cards rated', detail: detail('cards', 'cards') },
    { value: n.questions, label: Number(n.questions) === 1 ? 'question answered' : 'questions answered', detail: detail('questions', 'questions') },
    { value: n.fixed, label: Number(n.fixed) === 1 ? 'mistake fixed' : 'mistakes fixed', detail: detail('fixed', 'mistakes') },
  ];
  // A cards-only run has no questions: its end does not show two zeros for them.
  const shown = kind === 'cards' && !Number(n.questions) && !Number(n.fixed) ? nums.slice(0, 1) : nums;
  const options = (d.options || []).slice(0, 3);
  return (
    <section className="lr-end" aria-labelledby="lr-end-h">
      <div className="lr-end__head">
        <h1 className="lr-end__title" id="lr-end-h" tabIndex={-1} ref={headRef}>
          {lead ? <span className="lr-end__lead">{lead}</span> : null}
          <span className="lr-end__name">{name}</span>
        </h1>
        <span className="lr-end__mobi"><MobiReact act={act} size={84} /></span>
      </div>
      <dl className="lr-nums">
        {shown.map((x, i) => (
          <div key={x.label} className="lr-num">
            <dt>{x.label}</dt>
            <dd>
              <CountUp value={x.value} delay={i * 60} />
              {x.detail ? <p className="lr-num__detail">{x.detail}</p> : null}
            </dd>
          </div>
        ))}
      </dl>
      {d.moved ? <p className="lr-moved">{d.moved}</p> : null}
      <FannedPile groups={d.revisePile} />
      {d.free?.text ? <p className="kc-fine lr-free">{d.free.text}</p> : null}
      <div className="lr-end__next">
        {d.lead ? <Option option={d.lead} links={links} primary /> : null}
        {options.length ? <ul className="lr-opt-rows">{options.map((o, i) => <Option key={`${o.label}-${i}`} option={o} links={links} />)}</ul> : null}
      </div>
      <Link className="kc-btn kc-btn--quiet lr-end__back" href={closeHref}>Back to the chapter</Link>
    </section>
  );
}
