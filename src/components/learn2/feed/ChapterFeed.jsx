'use client';
// The Explore chapter feed (DESIGN-SPEC A6, B 3.8): one item per screen, bounded, never an endless scroll.
//   A card      its front; tap the card (or Space) for NCERT's line; "Keep" adds it to Revise (Pro; Free within its open cards).
//               Nothing is scheduled unless it is kept.
//   A question  answered in place; a wrong answer shows the explanation and "The line you needed".
//   Next        swipe up, the Next key, the Down key or the wheel, at any time: no forced rating.
//   End         after the chosen time, the session end (GET /api/learn/runs/:id/end).
// A focus page, like the run: it draws over the whole shell (no tab row, no dock), with Close at the top. The first-run coach
// line sits between the card and the keys and goes as soon as the answer shows.
// 1440: a centred 560 px column, the keys 24 px under the item, with "Open the chapter" and the time left beside it.
// Data: POST /api/learn/runs with kind 'feed', POST .../answer (learn2/api.js). Answers log with flow_context 'learn' on the server.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, LoaderCircle, X } from 'lucide-react';
import { CardSource, InShort, NcertText } from '@/components/keycards/KeyCard';
import { cardFace, plural, splitBlanks } from '@/components/keycards/kinds';
import { refreshHome } from '@/components/keycards/api';
import { ncertFont } from '@/components/keycards/ncertFont';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { ErrorState } from '@/components/ui/Skeleton';
import { answerItem, runEnd, startRun } from '../api';
import { useLearnLinks } from '../links';
import '@/components/keycards/keycards.css';
import './feed.css';

const COACH = 'learn2.feed.coach.v1';
const seen = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const mark = (k) => { try { localStorage.setItem(k, '1'); } catch { /* shown again next time */ } };
/** Keep: the card joins Revise, nothing else is scheduled (POST /api/learn/runs/:id/rate with keep). 402 is a Free limit. */
async function keepCard(runId, itemId) {
  const res = await fetch(`/api/learn/runs/${encodeURIComponent(runId)}/rate`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, keep: true }) });
  if (!res.ok) { const e = new Error('keep'); e.status = res.status; throw e; }
  return res.json().catch(() => ({}));
}
const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const STEP_LETTERS = 'ABCDEF';
/** A stem that prints its steps inline, "(A) ... (B) ... (C) ...", as a lead line and a list (null when it does not). */
function splitSteps(body) {
  const text = String(body || '');
  const marks = [...text.matchAll(/\(([A-F])\)\s+/g)];
  if (marks.length < 3 || !marks.every((m, i) => m[1] === STEP_LETTERS[i])) return null;
  const lead = text.slice(0, marks[0].index).trim();
  const steps = marks.map((m, i) => text.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim().replace(/[;,]\s*$/, ''));
  return { lead, steps };
}
/** The option's words without the letter some questions print in front of them ("A Sacrifice ratio"). */
const optionText = (o) => String(o.text).replace(new RegExp('^' + o.key + '[\\s.):-]+'), '');

function Front({ card }) {
  return splitBlanks(cardFace(card).front).map((p, i) => (p.blank
    ? <span key={i} className="kc-gap" role="img" aria-label={`blank ${p.n}`} />
    : <span key={i}>{p.text}</span>));
}

function CardItem({ item, st, onReveal }) {
  const { card } = item;
  const { label } = cardFace(card);
  return (
    <article className="l2x-card" data-revealed={st.revealed || undefined} data-tap={st.revealed ? undefined : ''} onClick={(e) => { if (!st.revealed && !e.target.closest('button, a')) onReveal(); }} aria-label={`${label}: ${cardFace(card).front}`}>
      <p className="l2x-kind"><span>{label}</span>{card.importance === 'must' ? <span className="l2c-must">Must-know</span> : null}{st.kept ? <span className="l2c-in"><Check size={13} strokeWidth={2.6} aria-hidden="true" />In Revise</span> : null}</p>
      <h2 className="l2x-front"><Front card={card} /></h2>
      {st.revealed ? (
        <div className="l2x-answer">
          <NcertText card={card} />
          <CardSource card={card} />
          <InShort card={card} />
        </div>
      ) : null}
    </article>
  );
}

function LineYouNeeded({ line }) {
  const [open, setOpen] = useState(false);
  const card = line?.card;
  if (!card) return null;
  if (line.locked) {
    return (
      <section className="kc-line l2x-line" aria-label="The line you needed">
        <div className="kc-line__head"><h3 className="kc-line__title">The line you needed</h3></div>
        <p className="l2x-expl">{line.text}</p>
        <div className="kc-line__foot"><button type="button" className="kc-btn kc-btn--line kc-btn--small" onClick={(e) => openUpgrade({ trigger: 'keycards', opener: e.currentTarget })}>See Pro</button></div>
      </section>
    );
  }
  const shown = !line.collapsed || open;
  return (
    <section className="kc-line l2x-line" aria-label="The line you needed">
      <div className="kc-line__head">
        <h3 className="kc-line__title">The line you needed</h3>
        {line.collapsed ? <button type="button" className="kc-btn kc-btn--quiet l2x-seeline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide the line' : 'See the line'}</button> : null}
      </div>
      {shown ? <><NcertText card={card} className="kc-ncert--compact" /><CardSource card={card} /></> : null}
    </section>
  );
}

function QuestionItem({ item, st, onChoose }) {
  const q = item.question;
  const res = st.answer?.res;
  const chosen = st.answer?.choice;
  const mistake = item.mistake;
  const steps = splitSteps(q.body);
  return (
    <article className="l2x-q" aria-label="Question">
      {item.origin === 'mistake' && mistake ? <p className="l2x-kind"><span>You missed this in {mistake.where} on {mistake.when}</span></p> : <p className="l2x-kind"><span>Question</span></p>}
      {steps ? (
        <>
          {steps.lead ? <h2 className="l2x-qbody">{steps.lead}</h2> : null}
          <ol className="l2x-steps" aria-label={steps.lead ? undefined : 'The steps'}>{steps.steps.map((t, i) => <li key={i}><b aria-hidden="true">{STEP_LETTERS[i]}</b><span>{t}</span></li>)}</ol>
        </>
      ) : <h2 className="l2x-qbody">{q.body}</h2>}
      <ul className="l2x-opts" role="group" aria-label="Choose one answer">
        {q.options.map((o, i) => {
          const isChosen = chosen === o.key;
          const isRight = res && res.key === o.key;
          const state = !res ? (st.answer?.pending && isChosen ? 'pending' : undefined) : isRight ? 'right' : isChosen ? 'wrong' : 'rest';
          return (
            <li key={o.key}>
              <button type="button" className="l2x-opt" data-state={state} disabled={Boolean(res) || Boolean(st.answer?.pending)} aria-pressed={isChosen || undefined} onClick={() => onChoose(o.key)}>
                <span className="l2x-opt__k" aria-hidden="true">{LETTERS[i] || o.key}</span>
                <span className="l2x-opt__t">{optionText(o)}</span>
                {state === 'pending' ? <LoaderCircle className="kc-spin" size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
                {state === 'right' ? <Check size={18} strokeWidth={2.6} aria-label="Right answer" /> : null}
                {state === 'wrong' ? <X size={18} strokeWidth={2.6} aria-label="Your answer" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {res ? (
        <div className="l2x-result" role="status">
          <p className="l2x-verdict" data-ok={res.correct || undefined}>{res.correct ? (res.fixedText || 'Right.') : `Not quite. The answer is ${LETTERS[q.options.findIndex((o) => o.key === res.key)] || res.key}.`}</p>
          {res.explanation ? <p className="l2x-expl">{res.explanation}</p> : null}
          {res.line ? <LineYouNeeded line={res.line} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function EndScreen({ end, links, chapterKey, minutes }) {
  const go = (a) => (a.run ? (a.run.kind === 'feed' ? links.feed(a.run.chapterKey || chapterKey, a.run.minutes || minutes) : links.run(a.run)) : a.href || links.chapter(chapterKey));
  const n = end.numbers || {};
  return (
    <section className="l2x-end" aria-labelledby="l2x-end-h">
      <h2 className="l2x-end__title" id="l2x-end-h" role="status">{end.title}</h2>
      <dl className="kc-counts l2x-counts">
        {[['Cards', n.cards], ['Questions', n.questions], ['Fixed', n.fixed]].filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {end.lines?.length ? <ul className="l2x-end__lines">{end.lines.map((l) => <li key={l.label}><b>{l.label}</b><span>{l.text}</span></li>)}</ul> : null}
      {end.revisePile?.length ? <p className="l2x-end__pile">{end.revisePile.map((r) => `${r.count} ${r.label}`).join(', ')}</p> : null}
      {end.moved ? <p className="l2x-end__pile">{end.moved}</p> : null}
      <div className="l2x-end__keys">
        {end.lead ? <Link className="kc-btn kc-btn--volt" href={go(end.lead)}>{end.lead.label}</Link> : null}
        {(end.options || []).map((o) => <Link key={o.label} className="kc-btn kc-btn--line" href={go(o)}>{o.label}</Link>)}
      </div>
      {end.lead?.evidence ? <p className="kc-fine">{end.lead.evidence}</p> : null}
    </section>
  );
}

// The feed is a focus page above the whole shell (no tab row, no dock), so it renders into the body. The shell's tokens live on
// <html>, so Night and Day still apply. The page behind is not locked (that would drop its scrollbar and move everything at 1440);
// the feed is its own scroll area with overscroll contained.
const noop = () => () => {};
export default function ChapterFeed(props) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? createPortal(<Feed {...props} />, document.body) : null;
}

function Feed({ chapterKey, minutes = 10 }) {
  const links = useLearnLinks();
  const router = useRouter();
  const [load, setLoad] = useState({ status: 'loading', run: null });
  const [at, setAt] = useState(0);
  const [list, setList] = useState([]);
  const [states, setStates] = useState({});
  const [end, setEnd] = useState(null);
  const [coach, setCoach] = useState(false);
  const [keepError, setKeepError] = useState(null);
  const stage = useRef(null);
  const gesture = useRef(null);
  const lock = useRef(0);

  const begin = useCallback(async () => {
    setLoad({ status: 'loading', run: null });
    setAt(0); setStates({}); setEnd(null);
    try {
      const run = await startRun({ chapterKey, minutes, kind: 'feed', leaveOut: ['lesson'] });
      setList(run.items || []);
      setLoad({ status: 'ready', run });
    } catch {
      setLoad({ status: 'error', run: null });
    }
  }, [chapterKey, minutes]);
  useEffect(() => { queueMicrotask(begin); }, [begin]);
  useEffect(() => { queueMicrotask(() => setCoach(!seen(COACH))); }, []);

  const run = load.run;
  const items = useMemo(() => list.filter((i) => i.type === 'card' || i.type === 'question'), [list]);
  const total = items.length;
  const item = items[at];
  const st = (item && states[item.id]) || {};
  const patch = useCallback((id, p) => setStates((s) => ({ ...s, [id]: { ...(s[id] || {}), ...p } })), []);

  // The session end, once every item has gone by.
  useEffect(() => {
    if (!run || !total || at < total || end) return;
    let alive = true;
    runEnd(run.id).then((e) => { if (alive) setEnd(e); }).catch(() => { if (alive) setEnd({ title: `${minutes} minutes on ${run.chapter?.title || 'this chapter'}`, numbers: {}, lines: [], revisePile: [], lead: { label: 'Open the chapter', evidence: '', href: links.chapter(chapterKey) }, options: [] }); });
    return () => { alive = false; };
  }, [run, total, at, end, minutes, links, chapterKey]);

  const next = useCallback(() => {
    if (!run || at >= total) return;
    if (coach) { mark(COACH); setCoach(false); }
    setKeepError(null);
    setAt((n) => n + 1);
  }, [run, at, total, coach]);

  const reveal = useCallback(() => { if (item?.type === 'card' && !st.revealed) patch(item.id, { revealed: true }); }, [item, st.revealed, patch]);

  const keep = useCallback(async () => {
    if (!item || item.type !== 'card' || st.kept || st.keeping) return;
    patch(item.id, { keeping: true });
    setKeepError(null);
    try {
      await keepCard(run.id, item.id);
      patch(item.id, { kept: true, keeping: false });
      refreshHome();
    } catch (e) {
      patch(item.id, { keeping: false });
      if (e.status === 402) openUpgrade({ trigger: 'keycards' });
      else setKeepError('That card was not kept. Try again.');
    }
  }, [item, run, st.kept, st.keeping, patch]);

  const choose = useCallback(async (key) => {
    if (!item || item.type !== 'question' || st.answer) return;
    patch(item.id, { answer: { choice: key, pending: true } });
    try {
      const res = await answerItem(run.id, { itemId: item.id, choice: key });
      patch(item.id, { answer: { choice: key, res } });
      if (res.reinsert?.item) setList((l) => { const next = [...l]; next.splice(Math.min(res.reinsert.at, next.length), 0, res.reinsert.item); return next; });
    } catch {
      patch(item.id, { answer: null });
      setKeepError('That answer was not saved. Try again.');
    }
  }, [item, st.answer, run, patch]);

  // A new result (the verdict, the explanation, the line you needed) comes into view above the keys.
  const answered = Boolean(st.answer?.res);
  useEffect(() => {
    if (!answered) return;
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* smooth */ }
    // The pick the student made is the top row in view (their own answer first, then the right one and the explanation below it).
    const t = setTimeout(() => {
      const mine = document.querySelector('.l2x-opt[data-state="wrong"]') || document.querySelector('.l2x-opt[data-state="right"]');
      (mine || document.querySelector('.l2x-result'))?.scrollIntoView({ block: mine ? 'start' : 'nearest', behavior: still ? 'auto' : 'smooth' });
    }, 120);
    return () => clearTimeout(t);
  }, [answered, item?.id]);

  // Keys: Space shows the line, Down moves on, K keeps, 1 to 4 or A to D choose.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || !item || end) return;
      const onButton = e.target?.tagName === 'BUTTON' || e.target?.tagName === 'A';
      if (item.type === 'card' && (e.key === ' ' || e.key === 'Enter') && !st.revealed && !onButton) { e.preventDefault(); reveal(); return; }
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key.toLowerCase() === 'n' && !onButton)) { e.preventDefault(); next(); return; }
      if (item.type === 'card' && e.key.toLowerCase() === 'k' && st.revealed) { e.preventDefault(); keep(); return; }
      if (item.type === 'question' && !st.answer) {
        const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
        if (i >= 0 && item.question.options[i]) { e.preventDefault(); choose(item.question.options[i].key); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, st.revealed, st.answer, end, next, reveal, keep, choose]);

  // The wheel moves on at 1440 (one step per gesture); a swipe up moves on on a phone.
  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (window.innerWidth < 1100 || Math.abs(e.deltaY) < 40 || e.target.closest?.('textarea')) return;
      const now = Date.now();
      if (now < lock.current) return;
      if (e.deltaY > 0) { lock.current = now + 900; e.preventDefault(); next(); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [next, load.status]);

  const onDown = (e) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button, a, input, textarea')) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, t: e.timeStamp, live: false };
  };
  const onMove = (e) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x; const dy = e.clientY - g.y;
    if (!g.live) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { gesture.current = null; return; }
      if (dy < -8 && Math.abs(dy) > Math.abs(dx) * 1.4) { g.live = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* optional */ } } else return;
    }
    // Up follows the finger a little; down (or the wrong way) gives 0.35.
    const y = dy < 0 ? Math.max(dy * 0.7, -140) : dy * 0.35;
    e.currentTarget.style.setProperty('--l2x-y', `${y}px`);
    e.currentTarget.dataset.drag = '';
  };
  const onUp = (e) => {
    const g = gesture.current;
    gesture.current = null;
    const node = e.currentTarget;
    if (!g?.live) return;
    const dy = e.clientY - g.y;
    const v = dy / Math.max(1, e.timeStamp - g.t);
    delete node.dataset.drag;
    node.style.setProperty('--l2x-y', '0px');
    if (dy < -72 || v < -0.6) next();
  };

  const left = Math.max(0, total - at);
  const minsLeft = total ? Math.max(1, Math.round((minutes * left) / total)) : 0;
  const title = run?.chapter?.title || '';

  if (load.status === 'loading') {
    return <div className={`kc l2x ${ncertFont.variable}`}><div className="l2x-grid"><div className="l2x-col"><div className="l2x-skel" role="status" aria-label="Starting the feed"><span className="skeleton l2x-skel__h" /><span className="skeleton l2x-skel__card" /><span className="skeleton l2x-skel__key" /></div></div></div></div>;
  }
  if (load.status === 'error' || !run) {
    return <div className={`kc l2x ${ncertFont.variable}`}><div className="l2x-grid"><div className="l2x-col"><header className="l2x-head"><div className="l2x-top"><button type="button" className="l2x-close" onClick={() => (window.history.length > 1 ? router.back() : router.push(links.chapter(chapterKey)))}><X size={18} strokeWidth={2.2} aria-hidden="true" />Close</button></div></header><ErrorState title="The feed did not start" message="Check your connection and try again." onRetry={begin} /></div></div></div>;
  }
  if (!total) {
    return (
      <div className={`kc l2x ${ncertFont.variable}`}>
        <div className="l2x-grid"><div className="l2x-col"><div className="l2x-empty"><h2>Nothing to run in this chapter yet.</h2><p>Its cards and questions are still being checked. Your other chapters have a feed.</p><Link className="kc-btn kc-btn--line" href={links.chapter(chapterKey)}>Open the chapter</Link></div></div></div>
      </div>
    );
  }

  const done = at >= total;
  const kind = item?.type;
  const primary = kind === 'card' ? (st.revealed ? 'next' : 'show') : (st.answer?.res ? 'next' : null);
  return (
    <div className={`kc l2x ${ncertFont.variable}`}>
      <div className="l2x-grid">
        <div className="l2x-col" ref={stage}>
          <header className="l2x-head">
            <div className="l2x-top">
              <button type="button" className="l2x-close" onClick={() => (window.history.length > 1 ? router.back() : router.push(links.chapter(chapterKey)))}><X size={18} strokeWidth={2.2} aria-hidden="true" />Close</button>
              <p className="l2x-title">{title}</p>
              <p className="l2x-pos" aria-live="polite">{done ? `${total} of ${total}` : `${at + 1} of ${total}`}</p>
            </div>
            <div className="kc-progress l2x-progress" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, (done ? total : at) / total)})` }} /></div>
          </header>

          {done ? (
            end ? <EndScreen end={end} links={links} chapterKey={chapterKey} minutes={minutes} /> : <div className="l2x-skel" role="status" aria-label="Finishing"><span className="skeleton l2x-skel__card" /></div>
          ) : (
            <>
              <div className="l2x-swipe" key={item.id} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                {kind === 'card' ? <CardItem item={item} st={st} onReveal={reveal} /> : <QuestionItem item={item} st={st} onChoose={choose} />}
              </div>
              <div className="l2x-foot">
              {coach && at === 0 && !st.revealed && !st.answer ? <p className="l2x-coach">{kind === 'card' ? 'Tap the card to see the NCERT line. ' : ''}Swipe up for the next one, or tap Next.</p> : null}
              <div className="l2x-keys">
                {kind === 'card' ? (
                  <>
                    {st.revealed ? (
                      st.kept
                        ? <span className="l2x-kept" role="status"><Check size={16} strokeWidth={2.4} aria-hidden="true" />In Revise</span>
                        : <button type="button" className="kc-btn kc-btn--line" onClick={keep} disabled={st.keeping}>{st.keeping ? 'Keeping' : 'Keep'}<kbd className="kc-kbd" aria-hidden="true">K</kbd></button>
                    ) : null}
                    {primary === 'show' ? <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={reveal}>Show answer<kbd className="kc-kbd" aria-hidden="true">Space</kbd></button> : null}
                    {primary === 'next' ? <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={next}>Next<kbd className="kc-kbd" aria-hidden="true">Down</kbd></button> : null}
                    {primary === 'show' ? <button type="button" className="kc-btn kc-btn--quiet" onClick={next}>Next</button> : null}
                  </>
                ) : (
                  <>
                    {primary === 'next' ? <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={next}>Next<kbd className="kc-kbd" aria-hidden="true">Down</kbd></button> : <button type="button" className="kc-btn kc-btn--quiet" onClick={next}>Skip this one</button>}
                  </>
                )}
              </div>
              {keepError ? <p className="kc-err" role="alert">{keepError}</p> : null}
              </div>
            </>
          )}
        </div>
        <aside className="l2x-side" aria-label="This feed">
          <Link className="l2x-side__link" href={links.chapter(chapterKey)}>Open the chapter</Link>
          {!done ? <p className="l2x-side__t">{plural(left, 'item')} left, about {minsLeft} min</p> : null}
        </aside>
      </div>
    </div>
  );
}
