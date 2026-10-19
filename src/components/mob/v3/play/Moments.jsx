"use client";
// R8, everyone's moment (Arena S15, F3). One row per player with a positive moment from a fixed list. The trap card
// appears only after the game closes and says "most of you", never a count; before close the card says when the
// answers open. A preset sticker row; no free text between members.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { mobGameApi } from './playApi';
import { FoldHead, PlayFold } from './PlayFold';
import { RunHead } from './GameRun';
import { COPY, STICKERS, errorSentence, momentSentence } from './playModel.mjs';

export function StickerRow({ mobId, gameId, onSent }) {
  const [busy, setBusy] = useState(null);
  const [sent, setSent] = useState(null);
  const send = async (kind) => {
    if (busy || !mobId) return;
    setBusy(kind);
    try { await mobGameApi.sticker(mobId, gameId, kind); setSent(kind); onSent?.(COPY.stickerSent); } catch (e) { onSent?.(errorSentence(e)); } finally { setBusy(null); }
  };
  return (
    <div className="mp-stickers">
      <p className="mp-label">{COPY.sendSticker}</p>
      <ul className="mp-stickers__row">
        {STICKERS.map((s, i) => (
          <li key={s.kind}>
            <button type="button" className={`mp-sticker${sent === s.kind ? ' is-sent' : ''}`} style={{ '--tilt': `${[-2, 1.5, -1, 2][i]}deg` }} onClick={() => send(s.kind)} disabled={Boolean(busy)} aria-label={`Send the sticker ${s.label}`}>
              <StickerMark kind={s.kind} />{s.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StickerMark({ kind }) {
  const paths = {
    nice_one: <path d="M4 10.5l3.5 3.5L16 5.5" />,
    so_close: <><circle cx="10" cy="10" r="6" /><circle cx="10" cy="10" r="2.2" /></>,
    teach_me: <path d="M3.5 6.5L10 3.5l6.5 3L10 9.5 3.5 6.5zM6 8v4.2c1.2 1.3 2.6 1.8 4 1.8s2.8-.5 4-1.8V8" />,
    again: <path d="M15.5 8.5A6 6 0 1 0 15 13M15.5 4v4.5H11" />,
  };
  return <svg className="mp-sticker__mark" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

export default function Moments({ gameId, game, mobName, hrefs }) {
  const [podium, setPodium] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let on = true;
    mobGameApi.podium(gameId).then((d) => {
      if (!on) return;
      setPodium(d);
      if (!d.soFar && d.trap) mobGameApi.review(gameId).then((r) => { if (on) setReview(r); }).catch(() => {});
    }).catch((e) => { if (on) setError(e); });
    return () => { on = false; };
  }, [gameId]);
  useEffect(() => {
    if (!toast) return undefined;
    const h = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(h);
  }, [toast]);

  const title = COPY.gameTitle(game);
  if (error) {
    return (
      <section className="mp-mom">
        <RunHead title={title} sub="" hrefs={hrefs} />
        <div className="mp-card mp-card--center" role="alert"><h2 className="mp-h2">{errorSentence(error)}</h2><div className="mp-keys"><Link className="mp-key" href={hrefs.den}>{COPY.backToDen}</Link></div></div>
      </section>
    );
  }
  if (!podium) {
    return (
      <section className="mp-mom" aria-busy="true">
        <RunHead title={title} sub="" hrefs={hrefs} />
        <div className="mp-skel mp-skel--rows" aria-hidden="true" />
      </section>
    );
  }
  const now = Date.now();
  const byId = new Map((podium.places || []).map((p) => [p.memberId, p]));
  const count = game?.count || 5;
  const closed = !podium.soFar;
  const trap = closed ? podium.trap : null;
  const trapNumber = trap ? trap.number ?? trap.q + 1 : null;
  const fix = review?.trap?.fix;
  const mob = mobName || COPY.yourMob;
  return (
    <section className="mp-mom">
      <RunHead title={title} sub={closed ? COPY.finalLabel : COPY.soFar} hrefs={hrefs} />
      <h2 className="mp-h1">{COPY.momentsTitle}</h2>
      <ul className="mp-moments">
        {(podium.moments || []).map((m, i) => {
          const p = byId.get(m.memberId) || {};
          const name = p.you ? 'You' : p.name || '';
          return (
            <li key={`${m.memberId}-${i}`} className="mp-moment" style={{ '--i': i }}>
              <FoldHead fold={p.fold} size={44} name={name} colour={p.colour} />
              <p><b>{name}:</b> {momentSentence(m, count)}</p>
            </li>
          );
        })}
      </ul>

      {trap ? (
        <article className="mp-card mp-trap">
          <span className="mp-trap__corner" aria-hidden="true" />
          <h3 className="mp-h3">{COPY.trapCardTitle}</h3>
          <p className="mp-line">{COPY.trapCaught(trapNumber)}</p>
          <ol className="mp-steps">
            <li><b>{COPY.stepNow.split(':')[0]}</b><span>{COPY.stepNow.split(': ').slice(1).join(': ')}</span></li>
            {fix?.check?.opensAt ? <li><b>{COPY.stepCheck(fix.check.opensAt).split(':')[0]}</b><span>{COPY.stepCheck(fix.check.opensAt).split(': ').slice(1).join(': ')}</span></li> : null}
          </ol>
          {fix?.fixed ? (
            <div className="mp-trap__progress">
              <span className="mp-crane" aria-hidden="true"><PlayFold fold="crane" size={52} silhouette /></span>
              <div>
                <span className="mp-segs" aria-hidden="true">{Array.from({ length: fix.fixed.of }, (_, i) => <i key={i} className={i < fix.fixed.count ? 'is-on' : ''} />)}</span>
                <p className="mp-hint">{COPY.trapProgress(mob, fix.fixed.count, fix.fixed.of)}</p>
              </div>
            </div>
          ) : null}
        </article>
      ) : !closed ? (
        <article className="mp-card mp-trap mp-trap--open">
          <span className="mp-trap__corner" aria-hidden="true" />
          <p className="mp-line">{COPY.answersOpenAt(podium.closesAt || game?.closesAt, now)}</p>
        </article>
      ) : null}

      <StickerRow mobId={game?.mobId} gameId={gameId} onSent={setToast} />

      <div className="mp-keys mp-keys--end">
        {trap ? <Link className="btn-volt md mp-key-primary" data-page-primary="" href={hrefs.fix}>{COPY.fixTogether(trapNumber)}</Link> : <Link className="btn-volt md mp-key-primary" data-page-primary="" href={hrefs.den}>{COPY.backToDen}</Link>}
      </div>
      {toast ? <p className="mp-toast" role="status">{toast}</p> : null}
    </section>
  );
}
