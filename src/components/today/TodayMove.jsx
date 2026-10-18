"use client";
// Up next: the lead card on Today (TODAY-1018 sections 3 row 2, 6.1 and 6.2; the R3 anatomy kept, owner D1 to D3).
// One card that leads and is interactive:
//   overline and title, the subject object, the big number with its meaning;
//   the value line: what these questions cost the student (the record's own arithmetic) and the "about 12 min" token,
//   which opens the three lengths inline in the card (no sheet);
//   why, from the student's own record; one volt key with the minutes inside; the price before the press;
//   a split footer of two other moves (not cards inside the card): a tap swaps the lead live, and while the student's
//   pick is on the card the recommended move waits in the footer, marked Suggested;
//   "More ways to practise" opens every other way in (the R3 Something else sheet).
// The key is the viewport's one volt (data-page-primary steps the shell's Start key back to an outline).
import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronsUpDown, RotateCcw, Check, Repeat2, ChevronRight, Timer, Layers, ListChecks, MonitorCheck, Users, NotebookText, Brain, RefreshCw } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import MobiReact from '@/components/brand/MobiReact';
import { useCountUpState } from '@/lib/motion/useCountUp';
import { keepTogether } from '@/lib/today/move.mjs';
import { markLine, pathLeads, railCaption, railLine } from '@/lib/today/firstWeek.mjs';
import TodaySheet from './TodaySheet';
import { AuthContext } from '@/components/AuthProvider';
import { useWalletSummary } from '@/components/useWalletSummary';
import { usesLine } from '@/lib/creditCopy.mjs';
import AskMobiLink from '@/components/ai/AskMobiLink';
import { ENTRY_LABELS } from '@/components/ai/askContexts.mjs';

const subscribeOnline = (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };
const onlineNow = () => navigator.onLine !== false;

function BigNumber({ value }) {
  // The first landing climbs from 0 with the card (part of the page's one load moment); remembered for the visit, so a
  // return draws it at once; a swap rolls from the old number to the new one (380 ms, ease-out).
  const { value: rolled } = useCountUpState(value, { memoryKey: 'today-move-number', duration: 380, from: 0 });
  return <span className="tm__num"><span aria-hidden="true">{rolled}</span><span className="sr-only">{value}</span></span>;
}

// A repair move's price before the press: "Each repair uses 1 AI credit. You have 68." (unknown balance, no number).
function RepairPrice({ each }) {
  const auth = useContext(AuthContext);
  const wallet = useWalletSummary(auth?.user?.id, { reuseFresh: true });
  return <p className="tm__price">{usesLine({ what: 'Each repair', cost: each, pool: 'ai', balance: wallet.wallet?.known ? wallet.wallet.total : null })}</p>;
}

function Art({ move, failed }) {
  if (failed) return <span className="tm__art tm__art--mobi" aria-hidden="true"><MobiReact act="oops" size={96} /></span>;
  if (!move) return null;
  if (move.art === 'mobi') return <span className="tm__art tm__art--mobi" aria-hidden="true"><MobiReact act={move.mobiAct || 'hello'} size={96} /></span>;
  // Revise: the objects of the subjects whose questions come back today, most first (one, or a small stack of up to three).
  if (move.id === 'revise' && move.subjects?.length) {
    return (
      <span className="tm__art tm__art--stack" data-n={move.subjects.length} aria-hidden="true">
        {move.subjects.map((s, i) => <span key={s} className="tm__stack-i" style={{ '--k': i }}><SubjectObject id={s} size={move.subjects.length === 1 ? 112 : [96, 64, 56][i]} lit={i === 0} life={false} framed={false} /></span>)}
      </span>
    );
  }
  // The subject's object is alive here (the brand's ObjectLife: a slow breath and a lean toward the pointer), the page's
  // one living object; reduced motion keeps the still picture.
  if (move.subject) return <span className="tm__art" key={move.subject} aria-hidden="true"><SubjectObject id={move.subject} size={112} lit life framed={false} /></span>;
  return <span className="tm__glyph" aria-hidden="true">{move.id === 'done' ? <Check size={36} strokeWidth={1.5} /> : <RotateCcw size={34} strokeWidth={1.5} />}</span>;
}

// Each way in carries its own picture (release 10, F5: rows that look pressable): the paper's subject object for a repair, else the
// app's icon for the mode (one lucide family, as Glyph's APP_ICONS), and a chevron that says the row opens.
const ALT_ICONS = { quick: Timer, another: Layers, mock: ListChecks, nta: MonitorCheck, mob: Users, review: NotebookText, revise: Brain, repair: RefreshCw };

function AltTile({ item }) {
  if (item.subject) return <span className="tsh__tile tsh__tile--obj" aria-hidden="true"><SubjectObject id={item.subject} size={36} life={false} framed={false} /></span>;
  const Icon = ALT_ICONS[item.id] || Layers;
  return <span className="tsh__tile" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>;
}

function SomethingElse({ open, onClose, items, when = 'tonight' }) {
  return (
    <TodaySheet open={open} onClose={onClose} id="tm-else" title="More ways to practise" lede={`Pick what fits ${when}. Each one opens straight in.`}>
      <ul className="tsh__list">
        {items.map((a) => (
          <li key={a.id}>
            <Link className="tsh__row" href={a.href} onClick={onClose}>
              <AltTile item={a} />
              <span className="tsh__row-t"><b>{a.title}</b><span>{a.reason}</span></span>
              <ChevronRight className="tsh__chev" size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </TodaySheet>
  );
}

// The swap hint (release 10, owner D90: a first-time student "won't know what cards actually do"): until the student has swapped
// once, at most 3 visits, the two choices nudge up twice 1.2 s after the card lands, their edges drawn, like a first-run card hint.
export const SWAP_HINT_KEY = 'mm:today-swap-hint:v1';
const hintVisits = () => { try { const v = window.localStorage.getItem(SWAP_HINT_KEY); return v === 'done' ? Infinity : Number(v) || 0; } catch { return Infinity; } };
const countHint = (n) => { try { window.localStorage.setItem(SWAP_HINT_KEY, String(n)); } catch { /* this visit only */ } };
export const swapLearned = () => { try { window.localStorage.setItem(SWAP_HINT_KEY, 'done'); } catch { /* it may nudge again */ } };

const say = (s, current) => (s === 'saving' ? 'Saving…' : s === 'saved' ? 'Saved.' : s === 'local' ? 'Kept on this device for today.' : s === 'failed' ? `Not saved, so it stays at ${current} minutes.` : '');

/**
 * `phase`: 'loading' | 'failed' | 'ready'. `lead`: the move on the card (leadOf, fitted to the chosen length).
 * `choices`: the two other moves (pickChoices). `picked`: the lead is the student's pick. `out`: the swap is fading out.
 * `lengths`: [{ n, line }] when a length changes the move, else null. `chosen`: the chosen length.
 */
export default function TodayMove({ phase, lead, choices = [], picked = false, out = false, swapDir = 'r', enter = null, onPick, lengths = null, chosen = null, onChoose, saving = '', alternatives = [], word = 'Tonight’s move', slow = false, triedAt = '', onRetry, askContext = null, path = null, onPlan }) {
  const online = useSyncExternalStore(subscribeOnline, onlineNow, () => true);
  const [sheet, setSheet] = useState(false);
  const [lenOpen, setLenOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [mark, setMark] = useState(null); // the rail's tapped mark (its day), or null for the caption
  const hasChoices = phase === 'ready' && choices.length > 0;
  useEffect(() => {
    if (!hasChoices) return undefined;
    const seen = hintVisits();
    if (seen >= 3) return undefined;
    let off = 0;
    const t = window.setTimeout(() => {
      countHint(seen + 1);
      setHint(true);
      off = window.setTimeout(() => setHint(false), 900);
    }, 1200);
    return () => { window.clearTimeout(t); window.clearTimeout(off); };
  }, [hasChoices]);

  if (phase === 'loading') {
    return (
      <section className="tm tm--wait" aria-busy="true" aria-label={`Loading ${word.toLowerCase()}`}>
        <span className="tm__sk tm__sk--a" /><span className="tm__sk tm__sk--b" /><span className="tm__sk tm__sk--c" /><span className="tm__sk tm__sk--d" /><span className="tm__sk tm__sk--key" />
        {slow ? (
          <p className="tm__slow" role="status">Still loading. Your connection looks slow. <button type="button" className="tm__inline" onClick={onRetry}>Try again</button></p>
        ) : null}
      </section>
    );
  }

  if (phase === 'failed') {
    return (
      <section className="tm tm--failed" aria-labelledby="tm-title">
        <div className="tm__top">
          <div className="tm__head"><p className="tm__over">Up next</p><h2 id="tm-title" className="tm__title">{word} did not load</h2></div>
          <Art failed />
        </div>
        <p className="tm__why">MockMob did not answer, so {word.toLowerCase()} could not be worked out. Your papers and mistakes are safe; Review still opens them.</p>
        {triedAt ? <p className="tm__note" role="status">Tried again at {triedAt}. Still not loading.</p> : null}
        <button type="button" className="tm__key" data-page-primary onClick={onRetry}><RotateCcw size={18} strokeWidth={2} aria-hidden="true" />Try again</button>
        <div className="tm__or tm__or--one"><Link className="tm__choice" href="/dashboard"><span className="tm__choice-t">Practise anyway</span><span className="tm__choice-v">Pick a subject and a length yourself</span></Link></div>
      </section>
    );
  }

  const m = lead;
  const offline = !online;
  const minutes = m.key?.minutes || null;
  const current = chosen || minutes || 10;
  const subject = m.subjectName || '';
  // The first week (release 8): the rail under the overline draws the path's seven steps, each ticked when done, with the day numbers
  // under the marks and one line that names today's step and the next (F18, release 9). The overline says the day only when the card
  // shows today's step; a check, a session waiting or the student's pick says "Up next", and the line names the step that waits.
  // With the day in the overline the subject object and the title already say the subject, so the overline stays one line.
  const week = pathLeads(path, m, { picked });
  const over = m.id === 'done' ? 'Today' : picked ? 'Up next, your pick' : week ? `Day ${path.day} of your first week` : 'Up next';
  const caption = path?.day ? railCaption(path, week) : '';
  const isPlan = m.key?.action === 'plan';
  const heading = `${over}${subject && !week ? `, ${subject}` : ''}: ${m.title}${m.number != null ? `, ${m.number} ${m.label}` : ''}`;
  // The reason line carries one link. With "Why this?" there, the move's own link ("See all 6 mistakes" on a returning card) moves to
  // the card's footer beside More ways to practise, so the two never read as one phrase ("See all 6 Why this?"); a link to the record
  // page is "Why this?" itself.
  const moved = Boolean(askContext && m.link && !m.link.href.startsWith('/mentor'));
  const price = m.aiEach && m.open > 0 ? <RepairPrice each={m.aiEach} /> : m.priceLine ? <p className="tm__price">{m.priceLine}</p> : m.free ? <p className="tm__price">Free. No credits.</p> : null;

  return (
    <section className="tm" data-move={m.id} aria-labelledby="tm-title">
      <h2 id="tm-title" className="sr-only">{heading}</h2>
      {path?.day ? <p className="sr-only">{railLine(path)}{caption && !week ? ` ${caption}` : ''}</p> : null}
      <div className="tm__body" data-out={out || undefined} data-dir={swapDir} data-in={enter || undefined} aria-live="polite">
        <div className="tm__top" aria-hidden="true">
          <div className="tm__head">
            <p className="tm__over">{picked ? <>Up next, <b>your pick</b></> : over}{subject && !week ? `, ${subject}` : ''}</p>
            {path?.day ? (
              <>
                {/* Release 10 (N1, #7): from 1024 px each mark is named (Start, Revise, Aim...); on a phone each mark is a tap target
                    (28 x 44) that says its own line in place of the caption. The words reach a screen reader once, in the line above. */}
                <ol className="tm__rail">
                  {path.steps.map((s, i) => (
                    <li key={s.id} className="tm__step" data-state={s.state} data-day={s.day} data-short={s.short} data-early={s.early || undefined} data-picked={mark === s.day || undefined} style={{ '--i': i }}>
                      {s.state === 'done' ? <svg viewBox="0 0 24 24" focusable="false"><path d="M6.5 12.5l3.6 3.6 7.4-8.2" pathLength="1" /></svg> : null}
                      <button type="button" className="tm__step-hit" tabIndex={-1} onClick={() => setMark((d) => (d === s.day ? null : s.day))} />
                    </li>
                  ))}
                </ol>
                {caption || mark ? <p className="tm__path" key={mark || 'caption'}>{mark ? markLine(path, path.steps.find((s) => s.day === mark)) : caption}</p> : null}
              </>
            ) : null}
            <p className="tm__title">{m.title}</p>
          </div>
          <Art move={m} />
        </div>
        {m.number != null ? (
          <p className="tm__figure" aria-hidden="true"><BigNumber value={m.number} /><span className="tm__label">{m.label}</span></p>
        ) : null}
        {m.stake || minutes ? (
          <div className="tm__value">
            {m.stake ? <span><b>{m.stake.value}</b> {m.stake.word}</span> : null}
            {minutes && lengths ? (
              <button type="button" className="tm__token" aria-expanded={lenOpen} aria-controls="tm-lengths" onClick={() => setLenOpen((v) => !v)}>
                about {minutes} min<ChevronsUpDown size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : minutes ? <span>about <b>{minutes}</b> min</span> : null}
          </div>
        ) : null}
        {lengths ? (
          <div className="tm__lengths" id="tm-lengths" data-open={lenOpen || undefined}>
            <div>
              <div className="tm__len-row" role="radiogroup" aria-label="How long do you have?">
                {lengths.map((l) => (
                  <button key={l.n} type="button" role="radio" aria-checked={current === l.n} className="tm__len" tabIndex={lenOpen ? 0 : -1} disabled={saving === 'saving'} onClick={() => onChoose?.(l.n)}>
                    <b>{l.n} min</b><span>{l.line}</span>
                  </button>
                ))}
              </div>
              <p className="tm__len-status" role="status">{say(saving, current)}</p>
            </div>
          </div>
        ) : null}
        {/* "Why this?" (ASK-MOBI-1018, owner D36) sits beside the reason line and opens Mobi already on this step, with the reason
            and the plan's record facts answered free. It follows the lead, so a swapped card asks about the swapped move. It takes
            the place of a link to the record page, so the card never carries two ways to ask why. */}
        <p className="tm__why">{keepTogether(m.why)}{m.link && !askContext ? <> <Link className="tm__inline" href={m.link.href}>{m.link.label}</Link></> : null}{askContext ? <> <AskMobiLink context={askContext} variant="inline" className="tm__inline">{ENTRY_LABELS.today}</AskMobiLink></> : null}</p>
        {offline && !isPlan ? <p className="tm__note" role="status">Needs a connection to start.</p> : null}
        {isPlan ? (
          <button type="button" className="tm__key" data-page-primary aria-haspopup="dialog" onClick={onPlan}>{m.key.label}</button>
        ) : offline ? (
          <span className="tm__key" aria-disabled="true" role="link">{m.key.label}{minutes ? <span className="tm__key-len">{minutes} min</span> : null}</span>
        ) : (
          <Link className="tm__key" data-page-primary href={m.key.href}>{m.key.label}{minutes ? <span className="tm__key-len">{minutes} min</span> : null}</Link>
        )}
        {price}
      </div>
      {choices.length ? (
        <div className="tm__or" role="group" aria-labelledby="tm-or-h" data-hint={hint || undefined}>
          <p className="tm__or-h" id="tm-or-h">Or make one of these your move</p>
          {choices.map((c, i) => (
            <button key={c.id} type="button" className="tm__choice" data-arrived={c.arrived || undefined} onClick={() => onPick?.(c.id, i)} aria-label={`${c.suggested ? 'Suggested. ' : ''}${c.choice.title}: ${c.choice.full || c.choice.value}. Make it your move.`}>
              <Repeat2 className="tm__choice-i" size={16} strokeWidth={1.75} aria-hidden="true" />
              {c.suggested ? <span className="tm__choice-s">Suggested</span> : null}
              <span className="tm__choice-t">{c.choice.title}</span>
              <span className="tm__choice-v">{c.choice.value}</span>
            </button>
          ))}
        </div>
      ) : null}
      {alternatives.length || moved ? (
        <div className="tm__more" data-split={moved && alternatives.length ? '' : undefined}>
          {moved ? <Link className="tm__all" href={m.link.href}>{m.link.label}</Link> : null}
          {alternatives.length ? <button type="button" aria-haspopup="dialog" onClick={() => setSheet(true)}>More ways to practise</button> : null}
        </div>
      ) : null}
      <SomethingElse open={sheet} onClose={() => setSheet(false)} items={alternatives} when={word.startsWith('Tonight') ? 'tonight' : 'today'} />
    </section>
  );
}
