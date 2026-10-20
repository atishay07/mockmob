"use client";
// The Den on the website (MOB-BUILD-SPEC-V3 5.3 D1 to D6, D5, P1 to P4, SET, K1 to K5), drawn only when the server sends
// the `v3` block (MOB_V3_ENABLED). The app's own sentences (denCopy.mjs). Design notes:
//   - One volt thing per screen: the card's key (or, for a Mob of one, the WhatsApp invite).
//   - Paper, a seal, the lamp light, the one volt light and exam stationery on every view (spec 5.0).
//   - Nobody is shown as not having played (F2): the runs row lists finished runs with times, nothing else.
//   - No price and no plan in the Mob (F4): Pro words appear only when the server says billing is on.
//   - Nothing is shown as done before the server answers: writes keep the last good view until their reply.
//   - Stickers (M12): your send lifts off the key and flies to the spot over your Fold once the server has it; friends'
//     stickers rise over their Folds, each once per session. Sends are spaced 3 s apart; at most 3 show at once.
//   - Live: while the den is on screen and you are around (a touch, key or scroll in the last 5 minutes), it reads the Mob
//     again every 30 s and when the tab comes back, quietly, so new stickers, games and moments arrive without a reload.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Moon, Package } from 'lucide-react';
import { displayCode, inviteUrl, paperHref, resultHref } from '@/lib/mob/model.mjs';
import { DenCopy, DEN_STICKERS, MobTime, denError } from '@/lib/mob/v3/denCopy.mjs';
import { InviteRewardLine } from '@/components/referrals/InviteFriendCard';
import { denState, momentQueue, passNotice, questSegments, whatsAppHref, yourRunAt } from '@/lib/mob/v3/denModel.mjs';
import { RECEIVED_AFTER_MS, RECEIVED_STEP_MS, canSendSticker, freshReactions, pushVisible, reactionKey } from '@/lib/mob/v3/stickerFlights.mjs';
import { mobFetch } from '../useMob';
import { DenStage } from './DenStage';
import { PaperSticker, StickerFlyer } from './Stickers';
import { rememberDenShape } from './denShape';
import { FoldHead } from './FoldFigure';
import { FreeProSheet, PassMicSheet, PlayPicker, StartGameSheet } from './DenSheets';
import { DenMoments } from './DenMoments';
import { CHAIN_HREF, MOB_CHAIN_HREF, SHELF_HREF, gameCardHref, gameHref, podiumHref } from './denRoutes';
import { FORMAT_COPY, isMock, isRace } from '../v3/play/formats.mjs';
import './den.css';

const SEEN_KEY = 'mm:den:seen-notices';
const readSeen = () => { try { return JSON.parse(window.localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } };
const writeSeen = (keys) => { try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(keys.slice(-30))); } catch { /* shown again next time */ } };

// Friends' stickers fly once per browser session (a per-viewer convenience: a cleared store only flies them again).
const FLOWN_KEY = 'mm:den:flown-stickers';
const memoryFlown = new Set();
function flownSet() {
  try { for (const k of JSON.parse(window.sessionStorage.getItem(FLOWN_KEY) || '[]')) memoryFlown.add(k); } catch { /* memory only */ }
  return memoryFlown;
}
function markFlown(keys) {
  for (const k of keys) memoryFlown.add(k);
  try { window.sessionStorage.setItem(FLOWN_KEY, JSON.stringify([...memoryFlown].slice(-60))); } catch { /* memory only */ }
}
const prefersReduced = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced');
// Live reads: every 30 s while the den is visible and you touched the page in the last 5 minutes.
export const DEN_LIVE_MS = 30_000;
export const DEN_LIVE_IDLE_MS = 5 * 60_000;
let stickerIds = 0;

/** The quest strip: the parcel's silhouette, the true count (past the goal too, F8), 12 segments. Opens the Mob chain. */
export function QuestStrip({ quest, href }) {
  if (!quest) return null;
  const seg = questSegments(quest);
  const past = quest.answered > quest.target;
  const body = (
    <>
      <span className="den-quest__parcel" aria-hidden="true"><Package size={22} strokeWidth={1.6} /></span>
      <span className="den-quest__main">
        <span className="den-quest__top">
          <span className="den-quest__title">{DenCopy.questTitle}</span>
          <span className="den-quest__count">
            {past ? DenCopy.questCount(quest) : <><b>{quest.answered}</b> of {quest.target} questions</>}
          </span>
        </span>
        <span className="den-quest__bar" aria-hidden="true">
          {Array.from({ length: seg.n }, (_, i) => (
            <span key={i} className="den-quest__seg" data-full={i < seg.full || undefined} style={i === seg.full && seg.part > 0 ? { '--part': seg.part } : undefined} data-part={i === seg.full && seg.part > 0 || undefined} />
          ))}
        </span>
      </span>
    </>
  );
  return href
    ? <Link className="den-quest den-rise" style={{ '--d': '465ms' }} href={href} aria-label={`${DenCopy.questTitle}. ${DenCopy.questCount(quest)}.`}>{body}</Link>
    : <div className="den-quest den-rise" style={{ '--d': '465ms' }}>{body}</div>;
}

function StickerRow({ onSend, busy, sent }) {
  return (
    <div className="den-stickers" role="group" aria-label={DenCopy.stickerRowLabel}>
      {DEN_STICKERS.map((k) => (
        <button key={k} type="button" className="den-stickerkey" onClick={(e) => onSend(k, e.currentTarget)} disabled={busy === 'sticker'} aria-label={DenCopy.stickerLabel(k)} data-sent={sent === k || undefined}>
          <PaperSticker kind={k} />
        </button>
      ))}
    </div>
  );
}

/** The card under the room: the one game, or the quiet card, or the ask card (D1 to D4). */
function GameCard({ state, data, v3, now, onPicker, onStartGame, onAsk, onSticker, busy, sentSticker }) {
  const youId = data.you?.memberId;
  const g = state.game ? { ...state.game, youId } : null;
  const host = g ? (v3.members || []).find((m) => m.memberId === g.host?.memberId) : null;
  const paper = data.week;
  const paperLink = !paper.closed ? (paper.youSat
    ? (paper.yourResultId ? <Link className="mob-link" href={resultHref(paper.yourResultId)}>{DenCopy.seeMarks}</Link> : null)
    : <Link className="mob-link" href={paperHref(data)}>{DenCopy.sitPaper}</Link>) : null;
  const more = state.more > 0 ? <button type="button" className="mob-link" onClick={onPicker}>{DenCopy.moreOpen(state.more)}</button> : <button type="button" className="mob-link" onClick={onPicker}>{DenCopy.moreWays}</button>;

  if (state.kind === 'quiet' || state.kind === 'ask') {
    const ask = state.kind === 'ask';
    return (
      <section className="den-card den-rise" style={{ '--d': '420ms' }} aria-labelledby="den-card-h">
        <span className="den-card__corner" aria-hidden="true" />
        <h3 id="den-card-h" className="den-card__title">{ask ? DenCopy.askTitle : DenCopy.quietTitle}</h3>
        <p className="den-card__line">{ask ? DenCopy.askLine : DenCopy.quietLine}</p>
        <div className="den-card__keys">
          {ask
            ? <button type="button" className="btn-volt md den-key" data-page-primary="" onClick={(e) => onAsk(e.currentTarget)} disabled={busy === 'sticker'}>{DenCopy.askKey}</button>
            : <button type="button" className="btn-volt md den-key" data-page-primary="" onClick={onStartGame}>{DenCopy.startAGame}</button>}
          {paperLink}
        </div>
      </section>
    );
  }
  const title = state.kind === 'live' || state.kind === 'room_running' ? DenCopy.liveOpened(g) : state.kind === 'played' ? DenCopy.gameTitle(g) : DenCopy.openedA(g);
  let line = null;
  let key = null;
  let link = more;
  if (state.kind === 'open') {
    // A race starts on a 3, 2, 1 under its key; a full mock opens its card first (an hour-long paper never starts itself).
    line = isRace(g) ? FORMAT_COPY.raceOpenLine(g, now) : isMock(g) ? FORMAT_COPY.mockOpenLine(g, now) : DenCopy.openLine(g, now);
    key = isMock(g)
      ? <Link className="btn-volt md den-key" data-page-primary="" href={gameCardHref(g.id)}>{FORMAT_COPY.sitMock}</Link>
      : <Link className="btn-volt md den-key" data-page-primary="" href={gameHref(g.id)}>{DenCopy.playKey(g)}</Link>;
  } else if (state.kind === 'played') {
    const at = yourRunAt(g, youId);
    line = at ? DenCopy.playedAt(at, g.closesAt, now) : null;
    key = <Link className="btn-volt md den-key" data-page-primary="" href={podiumHref(g.id)}>{isMock(g) ? FORMAT_COPY.seeSheetsSoFar : DenCopy.seePodiumSoFar}</Link>;
  } else if (state.kind === 'live') {
    line = isRace(g) ? FORMAT_COPY.raceLiveLine(g) : DenCopy.liveLine(g);
    key = <Link className="btn-volt md den-key" data-page-primary="" href={gameCardHref(g.id)}>{DenCopy.joinRoom(g)}</Link>;
    link = <Link className="mob-link" href={gameCardHref(g.id)}>{DenCopy.playLater(g.closesAt, now)}</Link>;
  } else {
    line = DenCopy.roomStarted(g.room?.startsAt || g.openedAt, g.closesAt, now);
    key = <Link className="btn-volt md den-key" data-page-primary="" href={gameHref(g.id)}>{DenCopy.playItNow}</Link>;
  }
  const runs = state.kind === 'open' ? DenCopy.runsSoFar(g.runs, now) : null;
  return (
    <section className="den-card den-rise" style={{ '--d': '420ms' }} aria-labelledby="den-card-h">
      <span className="den-card__corner" aria-hidden="true" />
      <header className="den-card__head">
        {state.kind !== 'played' ? <FoldHead fold={host?.fold} name={g.host?.name} colour={host?.colour ?? 0} size={36} /> : null}
        <h3 id="den-card-h" className="den-card__title">{title}</h3>
      </header>
      {line ? <p className="den-card__line">{line}</p> : null}
      {runs ? <p className="den-card__runs">{runs}</p> : null}
      <div className="den-card__keys">
        {key}
        {state.kind === 'played' ? <StickerRow onSend={onSticker} busy={busy} sent={sentSticker} /> : null}
        {link}
      </div>
    </section>
  );
}

/** D5. The invite card: the WhatsApp share with the card image, and the code to copy. */
function InviteCard({ data, v3, mobName, run, busy, onNotice }) {
  const [invite, setInvite] = useState(data.invite?.code ? { ...data.invite, display: data.invite.display || displayCode(data.invite.code) } : null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const make = useCallback(async () => {
    setError(null);
    const r = await run('/api/mob/invite', {}, { name: 'invite' });
    if (!r.ok) { setError(denError(r)); return null; }
    const next = { ...r.data, display: r.data.display || displayCode(r.data.code) };
    setInvite(next);
    return next;
  }, [run]);
  const you = data.you?.name || DenCopy.you;
  const url = invite ? (invite.url || inviteUrl(invite.code)) : '';
  const share = invite ? DenCopy.inviteShare(you, mobName, data.subjectName, invite.display, url) : '';
  const copy = async () => {
    const inv = invite || (await make());
    if (!inv) return;
    try { await navigator.clipboard.writeText(inv.display || inv.code); setCopied(true); onNotice?.(DenCopy.codeCopied); } catch { setError(DenCopy.generic); }
  };
  if (data.invitesPaused) return <p className="mob-note den-one__paused">{DenCopy.invitesPaused}</p>;
  return (
    <section className="den-one den-rise" style={{ '--d': '420ms' }} aria-labelledby="den-one-h">
      <h3 id="den-one-h" className="den-one__title">{DenCopy.oneTitle}</h3>
      <p className="den-one__line">{DenCopy.oneLine}</p>
      <figure className="den-invite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="den-invite__art" src="/mob/art/group-desk.webp" alt="" width={600} height={400} decoding="async" />
        <figcaption className="den-invite__text">
          <b>{DenCopy.inviteCardTitle(you, mobName)}</b>
          <span>{invite ? DenCopy.inviteCardLine(data.subjectName, invite.display) : DenCopy.inviteCardLineNoCode(data.subjectName)}</span>
        </figcaption>
      </figure>
      <div className="den-card__keys">
        {invite ? (
          <a className="btn-volt md den-key" data-page-primary="" href={whatsAppHref(share)} target="_blank" rel="noopener noreferrer">{DenCopy.inviteWhatsApp}</a>
        ) : (
          <button type="button" className="btn-volt md den-key" data-page-primary="" onClick={make} disabled={busy === 'invite'}>{busy === 'invite' ? DenCopy.makingCode : DenCopy.inviteWhatsApp}</button>
        )}
        <button type="button" className="mob-key den-key" onClick={copy} disabled={busy === 'invite'}><Copy size={16} aria-hidden="true" />{DenCopy.copyCode}</button>
      </div>
      {invite ? <p className="den-one__code" aria-live="polite"><span className="den-code">{invite.display}</span>{copied ? <span className="mob-hint">{DenCopy.codeCopied}</span> : null}</p> : null}
      <p className="mob-hint">{DenCopy.inviteWorks}</p>
      {/* D165: the Mob invite link is also a friend invite (you both get 100 credits). Nothing while invites are off. */}
      <InviteRewardLine />
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </section>
  );
}

/** D5 below the invite: this week's paper and a sprint (your own ghost works later). */
function OneExtras({ data, onStartGame, canStart }) {
  const week = data.week;
  return (
    <section className="den-card den-card--plain den-rise" style={{ '--d': '465ms' }}>
      {!week.closed && !week.youSat ? (
        <div className="den-row">
          <span className="den-row__text"><span>{DenCopy.onePaper}</span></span>
          <Link className="mob-key den-row__key" href={paperHref(data)}>{DenCopy.sitIt}</Link>
        </div>
      ) : null}
      {canStart ? <button type="button" className="mob-link" onClick={onStartGame}>{DenCopy.startSprint}</button> : null}
    </section>
  );
}

export default function DenV3({ data, mob, toolsSlot = null, onOpenSettings, warm = false }) {
  const v3 = data.v3;
  const router = useRouter();
  const mobName = v3.name?.text || data.subjectName;
  const [now, setNow] = useState(() => Date.now());
  const [sheet, setSheet] = useState(null); // picker | start | mic | freepro
  const [preset, setPreset] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [sentSticker, setSentSticker] = useState(null);
  const [onStage, setOnStage] = useState([]); // stickers over the Folds now
  const [flyers, setFlyers] = useState([]); // your stickers on their way from the key
  const [announce, setAnnounce] = useState('');
  const lastSent = useRef(Number.NaN);
  const rootRef = useRef(null);
  const firstReactions = useRef(true);
  const [chain, setChain] = useState(null);
  const [seenNotices, setSeenNotices] = useState(() => (typeof window === 'undefined' ? [] : readSeen()));
  const toastTimer = useRef(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  // The personal chain, for the pass notice (K5) and the milestone moment (K1). A failed read shows neither.
  useEffect(() => {
    let alive = true;
    mobFetch('/api/me/chain').then((r) => { if (alive && r.ok) setChain(r.data); });
    return () => { alive = false; };
  }, [data.id]);
  const say = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const state = useMemo(() => denState(v3), [v3]);
  const moments = useMemo(() => momentQueue(v3.moments), [v3.moments]);
  const notice = passNotice(chain, seenNotices);
  const size = (v3.members || []).length;
  const s = v3.starts || {};
  const proNudges = Boolean(s.billingOn) && s.via !== 'pro';

  const youId = data.you?.memberId || null;
  // After the server has it: lift the sticker off the key and fly it to the spot over your Fold. With no key (a sheet
  // sent it) it rises over your Fold; with the room scrolled away it rises off the key instead.
  const fly = (kind, fromEl) => {
    const id = `s${++stickerIds}`;
    const anchor = youId ? rootRef.current?.querySelector(`.den-sticker-anchor[data-member="${CSS.escape(youId)}"]`) : null;
    const a = anchor?.getBoundingClientRect();
    const seen = a && a.top > 0 && a.bottom < window.innerHeight && a.left >= 0 && a.right <= window.innerWidth;
    // The end slots lean their stickers inwards (--sx in den.css); the flight lands where the sticker will stand.
    const sx = seen ? parseFloat(getComputedStyle(anchor.parentElement).getPropertyValue('--sx')) : NaN;
    const to = seen ? { x: a.left + a.width / 2, y: a.bottom, sx: Number.isFinite(sx) ? sx : -50 } : null;
    const k = fromEl?.isConnected ? fromEl.getBoundingClientRect() : null;
    // Reduced motion: no flight; it fades in over your Fold (120 ms), holds and fades out.
    if (to && prefersReduced()) {
      if (youId) setOnStage((list) => pushVisible(list, { id, memberId: youId, kind, mode: 'landed' }));
      return;
    }
    if (!k) {
      if (youId) setOnStage((list) => pushVisible(list, { id, memberId: youId, kind, mode: 'rise' }));
      return;
    }
    setFlyers((list) => [...list, { id, kind, from: { x: k.left + k.width / 2, y: k.bottom }, to }].slice(-3));
  };
  const landed = (f) => {
    setFlyers((list) => list.filter((x) => x.id !== f.id));
    if (youId) setOnStage((list) => pushVisible(list, { id: f.id, memberId: youId, kind: f.kind, mode: 'landed' }));
  };
  const stickerDone = useCallback((id) => setOnStage((list) => list.filter((x) => x.id !== id)), []);
  const sticker = async (kind, game = null, fromEl = null) => {
    // Spaced 3 s apart on this device: a tap inside the gap does nothing, with no error and no toast.
    const at = Date.now();
    if (!canSendSticker(lastSent.current, at)) return;
    const before = lastSent.current;
    lastSent.current = at;
    setError(null);
    const r = await mob.run('/api/mob/sticker', { kind, ...(game ? { game } : {}) }, { name: 'sticker' });
    if (!r.ok) { lastSent.current = before; setError(denError(r)); return; }
    setSentSticker(kind);
    setAnnounce(DenCopy.stickerSent);
    fly(kind, fromEl);
  };
  const openStart = (p = {}) => { setPreset(p); setSheet('start'); };
  const dismissNotice = () => {
    if (!notice) return;
    const next = [...seenNotices, notice.key];
    setSeenNotices(next);
    writeSeen(next);
    mob.run('/api/mob/seen', { keys: [notice.key] }, { name: 'seen' });
  };
  // Friends' stickers (M12): rise over the sender's Fold, hold 1.8 s, newest 3, those from the last 12 hours, each once
  // per session. On entering, they wait for the den's own entrance; later ones (a live read) fly at once.
  useEffect(() => {
    const ids = new Set((v3.members || []).map((m) => m.memberId));
    const fresh = freshReactions(v3.reactions, { youId, now: Date.now(), flown: flownSet(), memberIds: ids });
    const wait = firstReactions.current ? RECEIVED_AFTER_MS : 0;
    firstReactions.current = false;
    if (!fresh.length) return;
    markFlown(fresh.map(reactionKey));
    setOnStage((list) => fresh.reduce((acc, r, i) => pushVisible(acc, { id: `r${++stickerIds}`, memberId: r.memberId, kind: r.kind, mode: 'rise', delay: wait + i * RECEIVED_STEP_MS }), list));
  }, [v3.reactions, v3.members, youId]);

  // Live: quiet re-reads while the den is on screen and you are around; a failed read changes nothing on screen.
  const liveRead = mob.refresh;
  const several = (v3.members || []).length > 1;
  useEffect(() => {
    if (!several || !liveRead) return undefined;
    let touched = Date.now();
    const touch = () => { touched = Date.now(); };
    const tick = () => {
      if (document.visibilityState !== 'visible' || Date.now() - touched > DEN_LIVE_IDLE_MS) return;
      liveRead();
    };
    const back = () => { if (document.visibilityState === 'visible') { touch(); liveRead(); } };
    const t = setInterval(tick, DEN_LIVE_MS);
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch);
    window.addEventListener('scroll', touch, { passive: true });
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(t);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      window.removeEventListener('scroll', touch);
      document.removeEventListener('visibilitychange', back);
    };
  }, [several, liveRead]);

  // The den's shape for its skeleton next time (D6): what sits under the room, at this width. Per device, a convenience.
  useEffect(() => { rememberDenShape(rootRef.current); });

  return (
    <div className="den" data-den-state={state.kind} data-one={state.one || undefined} ref={rootRef}>
      <DenStage v3={v3} mobName={mobName} subtitle={DenCopy.denSubtitle(data.subjectName, size)} warm={warm}
        chainHref={CHAIN_HREF} mobChainHref={MOB_CHAIN_HREF} shelfHref={SHELF_HREF} onSettings={onOpenSettings}
        onOpenSeat={size < 5 ? () => document.getElementById('den-one-h')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
        stickers={onStage} onStickerDone={stickerDone} />
      {flyers.map((f) => (
        <StickerFlyer key={f.id} kind={f.kind} from={f.from} to={f.to} reduced={prefersReduced()}
          onLanded={() => landed(f)} onDone={() => setFlyers((list) => list.filter((x) => x.id !== f.id))} />
      ))}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      {notice ? (
        <div className="den-notice den-rise" style={{ '--d': '380ms' }} role="status">
          <Moon size={16} aria-hidden="true" className="den-notice__moon" />
          <span>{DenCopy.passNotice(MobTime.weekdayOfKey(notice.day), notice.days ?? chain?.days ?? 0)}</span>
          <button type="button" className="mob-link den-notice__ok" onClick={dismissNotice}>{DenCopy.close}</button>
        </div>
      ) : null}

      {state.one ? <InviteCard data={data} v3={v3} mobName={mobName} run={mob.run} busy={mob.busy} onNotice={say} /> : null}
      {state.one && !state.game ? (
        <OneExtras data={data} canStart={s.can} onStartGame={() => openStart({ format: 'sprint' })} />
      ) : (
        <GameCard state={state} data={data} v3={v3} now={now} busy={mob.busy} sentSticker={sentSticker}
          onPicker={() => setSheet('picker')} onStartGame={() => openStart({ format: 'sprint' })}
          onAsk={(el) => sticker('again', null, el)} onSticker={(k, el) => sticker(k, state.game?.id, el)} />
      )}

      <QuestStrip quest={v3.quest} href={MOB_CHAIN_HREF} />
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
      {toast ? <p className="den-toast" role="status" aria-live="polite">{toast}</p> : null}
      {toolsSlot}

      {sheet === 'picker' ? (
        <PlayPicker open onClose={() => setSheet(null)} data={data} v3={v3} now={now} mobName={mobName} busy={mob.busy} proNudges={proNudges}
          onStart={(p) => openStart(p)} onAsk={async () => { await sticker('again'); setSheet(null); }} onFreePro={() => setSheet('freepro')} />
      ) : null}
      {sheet === 'start' ? (
        <StartGameSheet open onClose={() => setSheet(null)} data={data} v3={v3} mobName={mobName} preset={preset} run={mob.run} busy={mob.busy}
          onPassMic={() => setSheet('mic')} onFreePro={() => setSheet('freepro')} proNudges={proNudges}
          onStarted={(game) => { setSheet(null); if (game?.id) router.push(gameCardHref(game.id)); else mob.load(); }} />
      ) : null}
      {sheet === 'mic' ? <PassMicSheet open onClose={() => setSheet(null)} v3={v3} mobName={mobName} run={mob.run} busy={mob.busy} onPassed={(t) => { setSheet(null); say(t); mob.load(); }} /> : null}
      {sheet === 'freepro' ? <FreeProSheet open onClose={() => setSheet(null)} /> : null}

      {moments.length ? <DenMoments key={moments[0].key} queue={moments} v3={v3} data={data} chain={chain} mobName={mobName} run={mob.run} reload={mob.load} /> : null}
    </div>
  );
}
