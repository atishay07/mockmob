"use client";
// Your shelf on the web (MOB-BUILD-SPEC-V3 5.3 S1, 3.5). Every Fold is earned, none can be bought (F4): owned ones are
// coloured on a paper plinth, locked ones are a true silhouette with the rule and the server's real count ("1 of 3, in
// Chai Circle"). "Change" picks among owned Folds only (PUT /api/mob/profile). The Mob's den items follow.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DenCopy, FOLD_LINES, creaseLabel, denError, foldName, itemName } from '@/lib/mob/v3/denCopy.mjs';
import { MobDialog } from '../MobDialog';
import { mobFetch } from '../useMob';
import { FoldFigure } from './FoldFigure';
import { FoldPick } from './DenSheets';
import './den.css';

function Creases({ n }) {
  return <span className="den-crease" data-n={n} aria-label={creaseLabel(n)} role="img">{Array.from({ length: n }, (_, i) => <span key={i} />)}</span>;
}

export default function DenShelf({ user }) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [changing, setChanging] = useState(false);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const load = useCallback(async () => {
    const r = await mobFetch('/api/mob/shelf');
    setState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', data: null });
  }, []);
  useEffect(() => { if (user?.id) load(); }, [user?.id, load]);
  const shelf = state.data;
  const owned = (shelf?.folds || []).filter((f) => f.owned);
  const locked = (shelf?.folds || []).filter((f) => !f.owned);
  const seat = shelf?.seat?.fold;
  const foil = (shelf?.folds || []).find((f) => f.key === seat)?.finishes?.foil || owned[0]?.finishes?.foil;
  const sit = async () => {
    if (!pick || pick === seat) { setChanging(false); return; }
    setBusy(true);
    setNotice(null);
    const r = await mobFetch('/api/mob/profile', { method: 'PUT', body: { fold: pick, finish: shelf?.seat?.finish || 'plain' } });
    setBusy(false);
    if (!r.ok) { setNotice(denError(r)); return; }
    setState((s) => ({ ...s, data: { ...s.data, seat: { fold: r.data.fold, finish: r.data.finish } } }));
    setChanging(false);
    setNotice(DenCopy.foldChanged(foldName(r.data.fold)));
  };
  return (
    <div className="student-page student-page--mob">
      <section className="pr ov den-page">
        <header className="den-page__head">
          <Link href="/mob" className="mob-icon" aria-label={DenCopy.backToDen}><ArrowLeft size={20} aria-hidden="true" /></Link>
          <span>
            <h1 className="den-page__title">{DenCopy.shelfTitle}</h1>
            <p className="mob-hint">{DenCopy.shelfLead}</p>
          </span>
        </header>
        {state.status === 'loading' ? <p className="mob-hint" role="status">{DenCopy.shelfLoading}</p> : null}
        {state.status === 'error' ? <div role="alert"><p className="mob-note">{DenCopy.shelfFailed}</p><button type="button" className="mob-key" onClick={load}>{DenCopy.tryAgain}</button></div> : null}
        {shelf ? (
          <>
            <div className="den-seat-row">
              <FoldFigure fold={seat} size={44} name={foldName(seat)} />
              <b>{DenCopy.youPlayAs(foldName(seat))}</b>
              <button type="button" className="mob-key" onClick={() => { setPick(seat); setChanging(true); }}>{DenCopy.change}</button>
            </div>
            <p className="mob-notice den-notice-good" role="status" aria-live="polite">{notice || ''}</p>
            <section aria-labelledby="den-s1-yours">
              <h2 id="den-s1-yours" className="den-sheet__h">{DenCopy.shelfOwned}</h2>
              <ul className="den-shelfgrid">
                {owned.map((f) => (
                  <li key={f.key} className="den-plinth" data-seat={f.key === seat || undefined}>
                    <Creases n={f.folds} />
                    <FoldFigure fold={f.key} size={96} label={foldName(f.key)} />
                    <span className="den-plinth__base" aria-hidden="true" />
                    <b className="den-plinth__name">{foldName(f.key)}</b>
                    <span className="den-plinth__line">{FOLD_LINES[f.key]}</span>
                  </li>
                ))}
              </ul>
            </section>
            {locked.length ? (
              <section aria-labelledby="den-s1-earn">
                <h2 id="den-s1-earn" className="den-sheet__h">{DenCopy.shelfToEarn}</h2>
                <ul className="den-shelfgrid">
                  {locked.map((f) => (
                    <li key={f.key} className="den-plinth den-plinth--locked">
                      <Creases n={f.folds} />
                      <FoldFigure fold={f.key} size={96} locked />
                      <span className="den-plinth__base" aria-hidden="true" />
                      <span className="den-plinth__line">{DenCopy.lockedRule(f)}</span>
                      {f.need ? <span className="den-plinth__bar" aria-hidden="true"><span style={{ '--p': Math.min(1, (f.have || 0) / f.need) }} /></span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {foil ? (
              <section aria-labelledby="den-s1-finish">
                <h2 id="den-s1-finish" className="den-sheet__h">{DenCopy.finishes}</h2>
                <div className="den-finish">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mob/art/foil-seal.webp" alt="" width={44} height={44} className={foil.owned ? '' : 'is-locked'} />
                  <span>{foil.owned ? DenCopy.foilEarned : DenCopy.foilProgress(foil.have ?? 0, foil.need ?? 30)}</span>
                  <span className="den-plinth__bar" aria-hidden="true"><span style={{ '--p': Math.min(1, (foil.have || 0) / (foil.need || 30)) }} /></span>
                </div>
              </section>
            ) : null}
            {(shelf.mobItems || []).map((m) => (
              <section key={m.mobId} aria-labelledby={`den-s1-${m.mobId}`}>
                <h2 id={`den-s1-${m.mobId}`} className="den-sheet__h">{DenCopy.mobShelf(m.name)}</h2>
                <ul className="den-items">
                  {(m.items || []).map((it) => (
                    <li key={it.item} className="den-item" data-owned={it.owned || undefined}>
                      <b>{itemName(it.item)}</b>
                      <span className="mob-hint">{it.owned ? DenCopy.mobShelfOwned : DenCopy.mobShelfNext(it.have, it.need)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : null}
        {changing ? (
          <MobDialog open onClose={() => setChanging(false)} title={DenCopy.changeFoldTitle} labelId="den-s1-change">
            <FoldPick folds={owned.map((f) => f.key)} value={pick} onChange={setPick} name="den-seat" compact />
            <button type="button" className="btn-volt md den-sheet__key" disabled={busy || !pick} onClick={sit}>{DenCopy.sitAs(foldName(pick))}</button>
          </MobDialog>
        ) : null}
      </section>
    </div>
  );
}
