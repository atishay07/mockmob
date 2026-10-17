"use client";
// "After this mock" on the result page: "Do these next" (up to 3 practice sets, each with its reason)
// and the SWOT for this mock. Every sentence and number comes from the server (data/mock_swot.js);
// this file lays out only the section headings and button labels below. Free: no model, no credit.
// On the 17 Oct result it sits inside the fold "After this mock: strengths, gaps and plan" (inFold): the fold names it,
// so its own title is left to screen readers, and the student-facing heading is plain words, not "SWOT" (F11; adoption 11).
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import './swot.css';

export const SWOT_UI_COPY = Object.freeze({
  title: 'After this mock',
  next: 'Do these next',
  swot: 'Strengths, gaps and risks',
  setUp: 'Set up',
  see: 'See',
  setUpLabel: (label) => `Set up, ${label}`,
  goTo: (n) => `Go to question ${n}`,
});

const reducedMotion = () => {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};
const seenKey = (attemptId) => `swot-seen:${attemptId}`;
function wasSeen(attemptId) {
  try { return window.sessionStorage.getItem(seenKey(attemptId)) === '1'; } catch { return false; }
}
function markSeen(attemptId) {
  try { window.sessionStorage.setItem(seenKey(attemptId), '1'); } catch { /* storage blocked: the entrance may play again, nothing else changes */ }
}

// The one authored moment: the first time this attempt's section is 30% in view, the plan rows and the
// four groups rise in turn. Later views, reduced motion and browsers without IntersectionObserver show
// everything at once. 'armed' hides the rows only until that first view.
function useFirstView(attemptId, active) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(() => {
    if (typeof window === 'undefined' || !active || !attemptId) return 'still';
    if (typeof IntersectionObserver === 'undefined' || reducedMotion() || wasSeen(attemptId)) return 'still';
    return 'armed';
  });
  useEffect(() => {
    if (phase !== 'armed') return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      // A section taller than the screen counts once it fills 30% of the screen.
      const enough = entry.intersectionRatio >= 0.3 || entry.intersectionRect.height >= window.innerHeight * 0.3;
      if (!enough) return;
      io.disconnect();
      markSeen(attemptId);
      setPhase(reducedMotion() ? 'still' : 'in');
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [phase, attemptId]);
  return [ref, phase];
}

function Tick() {
  return (
    <svg className="sw-tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path pathLength="1" d="M5 12.5 L10 17.5 L19 7" />
    </svg>
  );
}

function QuestionButtons({ numbers, onJump }) {
  if (!numbers?.length) return null;
  return (
    <div className="sw-see">
      <span className="sw-see__label">{SWOT_UI_COPY.see}</span>
      {numbers.map((n) => (
        <button key={n} type="button" onClick={() => onJump?.(n)} aria-label={SWOT_UI_COPY.goTo(n)}>Q{n}</button>
      ))}
    </div>
  );
}

// Pass 1018 (REVIEW-RESULT-1018 5.3): inside "After this mock" the SWOT reads under plain headings, in this order.
const PLAIN = { weakness: 'Costing you', strength: 'Working', opportunity: 'Room to grow', threat: 'Watch' };
const PLAIN_ORDER = ['weakness', 'strength', 'opportunity', 'threat'];

export default function SwotPanel({ swot, attemptId, onJump, inFold = false, plain = false }) {
  const ready = swot?.state === 'ready';
  const [ref, phase] = useFirstView(attemptId, ready);
  const uid = useId();
  if (!swot || typeof swot !== 'object' || swot.state === 'not_available') return null;
  if (!ready) {
    return swot.message ? (
      <section className="sw sw--note" aria-label={SWOT_UI_COPY.title}>
        <p className="sw-note">{swot.message}</p>
      </section>
    ) : null;
  }
  const plan = Array.isArray(swot.plan) ? swot.plan : [];
  // A quadrant whose only content is a pointer to the ledger above is left out: the ledger already says it.
  const kept = (Array.isArray(swot.quadrants) ? swot.quadrants : []).filter((q) => (Array.isArray(q.items) && q.items.length) || !/Where your marks went/.test(String(q.empty || '')));
  // Groups with findings come first, in SWOT order; an empty group is one quiet full-width line after them, so it never
  // leaves a tall empty cell beside a long one.
  const hasItems = (q) => Array.isArray(q.items) && q.items.length > 0;
  const ordered = plain ? [...kept].sort((a, b) => PLAIN_ORDER.indexOf(a.id) - PLAIN_ORDER.indexOf(b.id)) : kept;
  const quadrants = [...ordered.filter(hasItems), ...ordered.filter((q) => !hasItems(q))];
  const basis = swot.basis || null;
  const titleId = `${uid}-title`;

  return (
    <section ref={ref} className="sw" aria-labelledby={titleId} data-motion={phase} data-in-fold={inFold || undefined}>
      <h2 id={titleId} className={inFold ? 'sw-title mr-sr' : 'sw-title'}>{SWOT_UI_COPY.title}</h2>

      {plan.length ? (
        <div className="sw-block">
          <h3 className="sw-h3">{SWOT_UI_COPY.next}</h3>
          <ol className="sw-plan">
            {plan.map((p, i) => (
              <li key={p.id || i} className="sw-plan__row" data-first={i === 0 || undefined} style={{ '--i': i }}>
                <span className="sw-plan__n" aria-hidden="true">{i + 1}</span>
                <div className="sw-plan__text">
                  <p className="sw-plan__label">{p.label}</p>
                  {p.reason ? <p className="sw-plan__reason">{p.reason}</p> : null}
                  {p.later?.line ? <p className="sw-plan__later"><Tick />{p.later.line}</p> : null}
                </div>
                {p.href ? <Link className="sw-plan__go" href={p.href} aria-label={SWOT_UI_COPY.setUpLabel(p.label)}>{SWOT_UI_COPY.setUp}</Link> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {quadrants.length ? (
        <div className="sw-block">
          <h3 className="sw-h3">{SWOT_UI_COPY.swot}</h3>
          {basis?.line || basis?.heldLine ? (
            <div className="sw-basis">
              {basis.line ? <p>{basis.line}</p> : null}
              {basis.heldLine ? <p>{basis.heldLine}</p> : null}
            </div>
          ) : null}
          <div className="sw-grid">
            {quadrants.map((q, gi) => {
              const items = Array.isArray(q.items) ? q.items : [];
              const headId = `${uid}-${q.id}`;
              return (
                <section key={q.id} className="sw-q" data-q={q.id} data-empty={items.length ? undefined : ''} aria-labelledby={headId} style={{ '--i': plan.length + gi }}>
                  <h4 id={headId} className="sw-q__h">{plain ? PLAIN[q.id] || q.label : q.label}</h4>
                  {items.length ? (
                    <ul className="sw-items">
                      {items.map((item) => (
                        <li key={item.id} className="sw-item">
                          <p className="sw-item__title">{item.title}</p>
                          {item.detail ? <p className="sw-item__detail">{item.detail}</p> : null}
                          {item.note ? <p className="sw-item__note">{item.note}</p> : null}
                          <QuestionButtons numbers={item.questions} onJump={onJump} />
                        </li>
                      ))}
                    </ul>
                  ) : q.empty ? <p className="sw-empty">{q.empty}</p> : null}
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
