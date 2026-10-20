"use client";
// L1, the live lobby (spec 5.3 L1 with Live 08's stickers; F12: no code; 5.6 M2 go live, M12 stickers).
// The lamp-lit stage holds the Folds of members present, each with a paper tag (Host, Here or Ready), and an open
// seat outline for each member who is not here (the count only, never a name). Under it: the sticker row, the
// promise ("never what they picked"), then one volt key: "I'm ready" for a guest, "Start for everyone" for the host.
// Presence is shown only here and only as Host, Here and Ready. Nothing is shown as done before the server says so:
// "Waiting for Riya to start" appears only after the ready presence was accepted.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Hand, Send, Timer } from 'lucide-react';
import { PlayFold } from '../play/PlayFold';
import { RunHead } from '../play/GameRun';
import { LIVE_COPY, LOBBY_STICKERS, STICKER_HOLD_MS, STICKER_WORDS, lobbyClosesAt } from './liveModel.mjs';

const STILL_AFTER_MS = 10_000;
const STICKER_ICON = { good_luck: Hand, lets_go: Send, one_sec: Timer, ready: Check };

function StickerIcon({ k, size = 18 }) {
  const Icon = STICKER_ICON[k] || Hand;
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}

/** The stage: lamp, floor, Folds with tags, open seats, floating stickers. Used by the lobby and under the countdown. */
export function LobbyStage({ seats, stickers = [], onStickerGone, skeleton = false }) {
  const n = seats.here.length + seats.open;
  return (
    <div className={`lv-stage${skeleton ? ' is-skeleton' : ''}`} style={{ '--n': Math.max(1, n) }}>
      <div className="lv-stage__room" aria-hidden="true">
        <span className="lv-stage__cone" />
        <span className="lv-stage__lamp" />
        <span className="lv-stage__floor" />
      </div>
      <ul className="lv-seats" aria-label={LIVE_COPY.inRoom(seats.here.length)}>
        {seats.here.map((h, i) => (
          <li key={h.memberId} className={`lv-seat${h.you ? ' is-you' : ''}`} style={{ '--i': i, '--mp-c': `var(--mob-c${Number(h.colour) % 8 || 0})` }} aria-label={LIVE_COPY.hereLabel(h.name, h.tag)}>
            <span className="lv-seat__fig">
              {stickers.filter((s) => s.m === h.memberId).slice(-1).map((s) => (
                <Sticker key={s.id} sticker={s} onGone={onStickerGone} />
              ))}
              <span className="lv-seat__sway"><PlayFold fold={h.fold} size={112} name={h.name} colour={h.colour} /></span>
              <span className="lv-seat__shadow" aria-hidden="true" />
            </span>
            <span className="lv-seat__name">{h.name}</span>
            <span className={`lv-tag is-${h.tag}`} key={h.tag}>
              {h.tag === 'ready' ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <span className="lv-tag__dot" aria-hidden="true" />}
              {h.tag === 'host' ? LIVE_COPY.tagHost : h.tag === 'ready' ? LIVE_COPY.tagReady : LIVE_COPY.tagHere}
            </span>
          </li>
        ))}
        {Array.from({ length: seats.open }, (_, i) => (
          <li key={`open${i}`} className="lv-seat is-open" aria-label={i === 0 ? LIVE_COPY.seatsLabel(seats.open) : undefined} aria-hidden={i > 0 || undefined}>
            <span className="lv-seat__fig"><span className="lv-seat__outline" aria-hidden="true">+</span></span>
            <span className="lv-seat__name is-open" aria-hidden="true">{LIVE_COPY.openSeat}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sticker({ sticker, onGone }) {
  useEffect(() => {
    if (!onGone) return undefined;
    const t = setTimeout(() => onGone(sticker.id), STICKER_HOLD_MS);
    return () => clearTimeout(t);
  }, [sticker.id, onGone]);
  return (
    <span className="lv-sticker" role="status">
      <StickerIcon k={sticker.k} size={16} />
      {STICKER_WORDS[sticker.k]}
    </span>
  );
}

export function LiveLobby({ game, seats, state, isHost, hostName, now, hrefs, busy, onReady, onStart, onSticker, onStickerGone, onCloseRoom, wipe }) {
  const [asking, setAsking] = useState(false);
  // The sway stops 10 s after the last touch (spec 5.2) and starts again on the next one.
  const [still, setStill] = useState(false);
  useEffect(() => {
    let t = setTimeout(() => setStill(true), STILL_AFTER_MS);
    const wake = () => { clearTimeout(t); setStill(false); t = setTimeout(() => setStill(true), STILL_AFTER_MS); };
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  }, []);
  const youReady = state.readyAsked || state.presence.get(state.youId) === 'ready';
  const alone = seats.here.length <= 1;
  const hostAway = !isHost && state.hostId && state.seen.has(state.hostId) && !state.presence.has(state.hostId);
  const count = game?.count ?? 5;
  return (
    <section className="lv-lobby" aria-labelledby="lv-lobby-title" data-still={still || undefined}>
      {wipe ? <span className="lv-wipe" aria-hidden="true" /> : null}
      <RunHead title={<span id="lv-lobby-title">{LIVE_COPY.roomTitle(game)}</span>} sub={LIVE_COPY.roomSub(game)} live hrefs={hrefs} />
      <LobbyStage seats={seats} stickers={state.stickers} onStickerGone={onStickerGone} />
      <div className="lv-under">
        <div className="lv-stickers" role="group" aria-labelledby="lv-stickers-h">
          <p id="lv-stickers-h" className="mp-label">{LIVE_COPY.sendSticker}</p>
          <div className="lv-stickers__row">
            {LOBBY_STICKERS.map((k) => (
              <button key={k} type="button" className="lv-chip" onClick={() => onSticker(k)} disabled={busy === 'sticker'} aria-label={LIVE_COPY.stickerLabel(k)}>
                <StickerIcon k={k} />
                <span>{STICKER_WORDS[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mp-line lv-promise">{LIVE_COPY.sameStart(count)}</p>
        {hostAway ? <p className="lv-note" role="status">{LIVE_COPY.hostAway(hostName, lobbyClosesAt(game.openedAt), game.closesAt, now)}</p>
          : alone ? <p className="lv-note" role="status">{LIVE_COPY.onlyYou}</p> : null}
      </div>
      <div className="mp-dock lv-dock">
        {isHost ? (
          <>
            <button type="button" className="btn-volt md mp-key-primary lv-key" data-page-primary="" onClick={onStart} disabled={busy === 'start'} aria-busy={busy === 'start' || undefined}>
              {busy === 'start' ? LIVE_COPY.starting : LIVE_COPY.startForEveryone}
            </button>
            <p className="lv-dock__line">{LIVE_COPY.startLine}</p>
            <button type="button" className="mp-link" onClick={() => setAsking(true)}>{LIVE_COPY.closeRoom}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn-volt md mp-key-primary lv-key" data-page-primary="" onClick={onReady} disabled={youReady || busy === 'ready'} aria-busy={busy === 'ready' || undefined}>
              {youReady ? LIVE_COPY.waitingFor(hostName) : LIVE_COPY.imReady}
            </button>
            <Link className="mp-link" href={hrefs.den}>{LIVE_COPY.playLater}</Link>
          </>
        )}
      </div>
      {asking ? (
        <div className="mp-dialog" role="dialog" aria-modal="true" aria-labelledby="lv-close-title">
          <div className="mp-dialog__card">
            <h2 id="lv-close-title" className="mp-h2">{LIVE_COPY.closeRoomAsk}</h2>
            <p className="mp-line">{LIVE_COPY.closeRoomLine(game.closesAt, now)}</p>
            <div className="mp-keys mp-keys--row">
              <button type="button" className="btn-volt md mp-key-primary" onClick={() => setAsking(false)} autoFocus>{LIVE_COPY.keepRoom}</button>
              <button type="button" className="mp-key" onClick={() => { setAsking(false); onCloseRoom(); }} disabled={busy === 'cancel'}>{LIVE_COPY.closeRoom}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The room could not run live (closed, refused, busy, away or failed): one sentence and the way on. */
export function LiveNotice({ game, me, title, line, primary, secondary, hrefs }) {
  return (
    <section className="lv-lobby lv-lobby--notice">
      <RunHead title={LIVE_COPY.roomTitle(game)} sub={LIVE_COPY.roomSub(game)} hrefs={hrefs} />
      <div className="lv-stage lv-stage--quiet" style={{ '--n': 1 }}>
        <div className="lv-stage__room" aria-hidden="true">
          <span className="lv-stage__cone" />
          <span className="lv-stage__lamp" />
          <span className="lv-stage__floor" />
        </div>
        <div className="lv-quiet__fig" aria-hidden="true"><PlayFold fold={me?.fold} pose="think" size={112} name="You" colour={me?.colour ?? 0} /></div>
      </div>
      <div className="mp-card lv-notice">
        {title ? <h2 className="mp-h2">{title}</h2> : null}
        {line ? <p className="mp-line" role="status">{line}</p> : null}
        <div className="mp-keys">
          {primary}
          {secondary}
        </div>
      </div>
    </section>
  );
}
