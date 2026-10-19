"use client";
// The den's one-time moments on the web (MOB-BUILD-SPEC-V3 5.3 K1 to K4, 5.6 M8 to M11), played in the spec's order
// (quest done, week stitched, reveal, milestone), one per open, each once. Each is a full-screen layer over the page with a
// visible Skip and a close; any skip lands the end state in 200 ms. A moment is marked seen (POST /api/mob/seen) only
// after it has fully shown or been skipped. No sunburst, no rays, no rarity colour (F6); the parcel's warm leak is a
// plain radial light. Mobi appears at most once per moment. Reduced motion: 120 ms fades, order and words kept.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { MOB_ITEMS } from '@/lib/mob/folds.mjs';
import { DenCopy, FOLD_LINES, denError, foldName } from '@/lib/mob/v3/denCopy.mjs';
import { FoldFigure, FoldHead } from './FoldFigure';
import { Pennant } from './DenStage';
import { SHELF_HREF } from './denRoutes';

const SHOW_MS = { quest_done: 1900, stitch: 2000, reveal: 2000, chain: 2000 };

function Heads({ members }) {
  return (
    <ul className="den-k__heads">
      {(members || []).map((m, i) => (
        <li key={m.memberId} style={{ '--i': i }}>
          <FoldHead fold={m.fold} name={m.name} colour={m.colour} size={48} />
          <span>{m.you ? DenCopy.you : m.name}</span>
        </li>
      ))}
    </ul>
  );
}

function QuestDone({ v3, mobName, onNext, next }) {
  const q = v3.quest || {};
  const weeks = v3.mobChain?.weeks ?? 0;
  const parcel = q.parcel;
  const opens = next && next.kind === 'reveal';
  return (
    <>
      <p className="den-k__count"><b>{q.answered}</b> {DenCopy.questTail(q.answered, q.target)}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="den-k__seal" src="/mob/art/stamp-seal.webp" alt="" width={200} height={200} decoding="async" />
      <h2 className="den-k__title" id="den-k-title">{DenCopy.questDone}</h2>
      <p className="den-k__line">{DenCopy.questDoneLine(mobName, q.answered, q.target, weeks)}</p>
      <Heads members={v3.members} />
      {parcel && parcel.kind !== 'stitch' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="den-k__parcel" src="/mob/art/parcel-sealed.webp" alt="" width={120} height={120} decoding="async" />
      ) : null}
      <div className="den-k__keys">
        <button type="button" className="btn-volt md den-key" onClick={onNext}>{opens ? DenCopy.openParcel : DenCopy.seePennant}</button>
      </div>
    </>
  );
}

function Stitched({ v3, mobName, onDone }) {
  const weeks = v3.mobChain?.weeks ?? 0;
  const hit = MOB_ITEMS.find((x) => x.at === weeks);
  return (
    <>
      <div className="den-k__pennant"><Pennant weeks={weeks} size={110} /></div>
      <p className="den-k__big"><b>{weeks}</b> <span>{DenCopy.weeksInARow(weeks)}</span></p>
      <p className="den-k__line">{DenCopy.stitchedLine(mobName, weeks, (v3.members || []).length)}</p>
      <Heads members={v3.members} />
      {hit ? (
        <div className="den-k__reward">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hit.item === 'desk_bell' ? <img src="/mob/art/hybrid-deskbell.webp" alt="" width={56} height={56} className="den-k__bell" /> : null}
          <span><b>{DenCopy.rewardFor(hit.item)}</b><span>{DenCopy.staysOnShelf}</span></span>
        </div>
      ) : null}
      <div className="den-k__keys"><button type="button" className="btn-volt md den-key" onClick={onDone}>{DenCopy.backToDen}</button></div>
    </>
  );
}

function Reveal({ fold, mobName, run, onDone }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const playAs = async () => {
    setBusy(true);
    setError(null);
    const r = await run('/api/mob/profile', { fold, finish: 'plain' }, { method: 'PUT', name: 'profile' });
    setBusy(false);
    if (!r.ok) { setError(denError(r)); return; }
    onDone(true);
  };
  return (
    <>
      <p className="den-k__eyebrow">{DenCopy.newOnShelf}</p>
      <div className="den-k__parcelbox" aria-hidden="true">
        <span className="den-k__leak" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="den-k__p den-k__p--sealed" src="/mob/art/parcel-sealed.webp" alt="" width={280} height={280} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="den-k__p den-k__p--pop" src="/mob/art/parcel-pop.webp" alt="" width={280} height={280} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="den-k__p den-k__p--open" src="/mob/art/parcel-open.webp" alt="" width={280} height={280} />
        <span className="den-k__riser"><FoldFigure fold={fold} pose="cheer" size={200} large /></span>
      </div>
      <h2 className="den-k__title den-k__title--fold" id="den-k-title">{foldName(fold)}</h2>
      <p className="den-k__line den-k__line--lead">{FOLD_LINES[fold]}</p>
      <p className="den-k__line">{DenCopy.revealFact(mobName, fold)}</p>
      <div className="den-k__keys den-k__keys--two">
        <button type="button" className="mob-key den-key" onClick={() => { onDone(false); router.push(SHELF_HREF); }}>{DenCopy.seeShelf}</button>
        <button type="button" className="btn-volt md den-key" onClick={playAs} disabled={busy}>{DenCopy.playAs(fold)}</button>
      </div>
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </>
  );
}

function Milestone({ chain, days, onDone }) {
  const n = days || chain.days;
  const reward = (chain.milestones || []).find((m) => m.at === n)?.reward;
  const ticks = Math.min(n, 14);
  return (
    <>
      <div className="den-k__arc" aria-hidden="true">
        {Array.from({ length: ticks }, (_, i) => {
          const a = Math.PI * (1 - i / Math.max(1, ticks - 1));
          return <span key={i} className="den-k__tick" style={{ '--i': i, left: `${50 + Math.cos(a) * 44}%`, top: `${78 - Math.sin(a) * 66}%` }} />;
        })}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="den-k__mobi" src="/brand/mascot/celebrating.webp" alt="" width={72} height={72} onError={(e) => { e.currentTarget.hidden = true; }} />
      </div>
      <p className="den-k__big den-k__big--stamp"><b>{n}</b> <span>{DenCopy.daysInARow(n)}</span></p>
      <p className="den-k__line">{DenCopy.milestoneLine({ ...chain, days: n })}</p>
      {reward === 'rest_pass' ? <p className="den-k__chip">{DenCopy.aRestPass}</p> : null}
      <div className="den-k__keys"><button type="button" className="btn-volt md den-key" onClick={onDone}>{DenCopy.backToDen}</button></div>
    </>
  );
}

export function DenMoments({ queue, v3, chain, mobName, run, reload }) {
  // "Open the parcel" (K2) leads straight into the reveal (K4) when the parcel holds a Fold; the stitch follows it.
  const parcelFold = ['fold', 'item'].includes(v3.quest?.parcel?.kind);
  const ordered = parcelFold && queue.some((m) => m.kind === 'quest_done') && queue.some((m) => m.kind === 'reveal')
    ? [...queue.filter((m) => m.kind === 'quest_done'), ...queue.filter((m) => m.kind === 'reveal'), ...queue.filter((m) => m.kind !== 'quest_done' && m.kind !== 'reveal')]
    : queue;
  const playable = ordered.filter((m) => (m.kind === 'chain' ? Boolean(chain) : true));
  const [index, setIndex] = useState(0);
  const [skippedKey, setSkippedKey] = useState(null);
  const [shownKey, setShownKey] = useState(null);
  const [gone, setGone] = useState(false);
  const closeRef = useRef(null);
  const m = playable[index] || null;

  // Let the den enter first (M1, 1100 ms), then the moment.
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 1150); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!m || !ready) return undefined;
    const t = setTimeout(() => setShownKey(m.key), SHOW_MS[m.kind] || 2000);
    closeRef.current?.focus({ preventScroll: true });
    return () => clearTimeout(t);
  }, [m, ready]);

  const seen = useCallback((key) => run('/api/mob/seen', { keys: [key] }, { name: 'seen' }), [run]);
  const next = useCallback(async () => {
    if (!m) return;
    await seen(m.key);
    if (index + 1 < playable.length) setIndex(index + 1);
    else { setGone(true); reload?.(); }
  }, [m, index, playable.length, seen, reload]);
  const close = useCallback(async () => {
    if (m) await seen(m.key);
    setGone(true);
    reload?.();
  }, [m, seen, reload]);
  const skipped = Boolean(m) && skippedKey === m.key;
  const shown = Boolean(m) && (shownKey === m.key || skipped);
  const skip = () => { if (m) { setSkippedKey(m.key); setShownKey(m.key); } };

  useEffect(() => {
    if (!m || gone || !ready) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [m, gone, ready, close]);

  if (!m || gone || !ready) return null;
  const body = m.kind === 'quest_done' ? <QuestDone v3={v3} mobName={mobName} next={playable[index + 1]} onNext={next} />
    : m.kind === 'stitch' ? <Stitched v3={v3} mobName={mobName} onDone={next} />
      : m.kind === 'reveal' ? <Reveal fold={m.fold} mobName={mobName} run={run} onDone={() => next()} />
        : <Milestone chain={chain} days={m.days} onDone={next} />;
  // A portal to <body>: the moment covers the whole app, header and tab bar included (a full-screen route in the app).
  return createPortal(
    <div className="den-k" role="dialog" aria-modal="true" aria-labelledby="den-k-title" data-kind={m.kind} data-skipped={skipped || undefined} data-shown={shown || undefined}>
      <span className="den-k__lamp" aria-hidden="true" />
      <div className="den-k__chrome">
        <button ref={closeRef} type="button" className="den-tool den-k__close" aria-label={DenCopy.close} onClick={close}><X size={20} aria-hidden="true" /></button>
        {!shown ? <button type="button" className="den-k__skip" onClick={skip}>{DenCopy.skip}</button> : <span />}
      </div>
      <div className="den-k__body" key={m.key}>
        {m.kind === 'chain' ? <h2 className="sr-only" id="den-k-title">{DenCopy.daysInARow(m.days)}</h2> : null}
        {m.kind === 'stitch' ? <h2 className="sr-only" id="den-k-title">{DenCopy.weeksInARow(v3.mobChain?.weeks ?? 0)}</h2> : null}
        {body}
      </div>
    </div>,
    document.body,
  );
}

export default DenMoments;
