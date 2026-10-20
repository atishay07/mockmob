"use client";
// A Mob live room on the website (Phase B): lobby, countdown, the live ruler race, a friend finishing, then the
// hand-off to the podium. Shown only when the server says live is on (v3.live.enabled) and the game is a live room
// still in its lobby or its first 30 seconds (liveRoomFor). Everything else plays as an anytime game.
//
// The channel is an adapter: Supabase Realtime on the real page (liveChannel.js), the fake hub in the dev preview and
// the tests. The page sends presence only; every mark it shows is the API's; broadcasts carry no names or marks.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { mobGameApi } from '../play/playApi';
import GameRun from '../play/GameRun';
import { errorSentence } from '../play/playModel.mjs';
import { FORMAT_COPY, isRace, raceMinutes } from '../play/formats.mjs';
import { LIVE_COPY, everyoneDone, initialRoom, inRoom, liveRacers, lobbySeats, memberMap, stillPlaying } from './liveModel.mjs';
import { createRoomController } from './roomDriver.mjs';
import { openSupabaseRoom } from './liveChannel';
import { LiveCountdown } from './LiveCountdown';
import { LiveLobby, LiveNotice, LobbyStage } from './LiveLobby';
import './live.css';

const TOAST_MS = 2800;
const WIPE_WINDOW_MS = 60_000;

export default function LiveRoom({ game, members, me, hrefs, onGame, onAnytime, openChannel = openSupabaseRoom, api = mobGameApi }) {
  const [state, setState] = useState(() => initialRoom({ hostId: game.host?.memberId ?? null }));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const ctl = useRef(null);
  const membersRef = useRef(members);

  useEffect(() => {
    const c = createRoomController({
      gameId: game.id, mobId: game.mobId, members: membersRef.current,
      api: { ticket: api.ticket, start: api.roomStart, cancel: api.roomCancel, sticker: api.sticker, presence: api.roomPresence },
      openChannel, onChange: (next) => { setState(next); setNow(c.serverNow()); },
    });
    ctl.current = c;
    c.connect();
    return () => { c.close(); if (ctl.current === c) ctl.current = null; };
  }, [game.id, game.mobId, api, openChannel]);

  // The lobby's clock lines (host stepped away, closes at) read the server's time.
  useEffect(() => {
    const t = setInterval(() => setNow(ctl.current ? ctl.current.serverNow() : Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Each tap in the lobby keeps the seat (10 quiet minutes drop it).
  useEffect(() => {
    if (state.phase !== 'lobby') return undefined;
    const touch = () => ctl.current?.touch();
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch);
    return () => { window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch); };
  }, [state.phase]);

  // A friend's finish toast leaves after 2.8 s.
  const firstToast = state.toasts[0];
  useEffect(() => {
    if (!firstToast) return undefined;
    const t = setTimeout(() => ctl.current?.dispatch({ type: 'toast-gone', id: firstToast.id }), TOAST_MS);
    return () => clearTimeout(t);
  }, [firstToast]);

  const act = useCallback(async (name, fn) => {
    setBusy(name);
    setError(null);
    try { await fn(); } catch (e) { setError(errorSentence(e)); } finally { setBusy(null); }
  }, []);

  const byId = useMemo(() => memberMap(members), [members]);
  const hostName = game.host?.you ? 'You' : (byId.get(state.hostId)?.name || game.host?.name || '');
  const serverNow = useCallback(() => (ctl.current ? ctl.current.serverNow() : Date.now()), []); // for the countdown's ticker only
  const isHost = Boolean(state.youId) && state.youId === state.hostId;
  const seats = lobbySeats(state, members);
  const onStickerGone = useCallback((id) => ctl.current?.dispatch({ type: 'sticker-gone', id }), []);
  const onAnswered = useCallback((n, done) => ctl.current?.answered(n, done), []);
  const count = game.count || 5;
  const racersFor = useCallback((you) => liveRacers(state, members, count, you), [state, members, count]);
  const [countGone, setCountGone] = useState(false);
  const onCountGo = useCallback(() => ctl.current?.go(), []);
  const onCountOver = useCallback(() => { ctl.current?.go(); setCountGone(true); }, []);
  const heads = seats.here.map((h) => ({ memberId: h.memberId, name: h.name, fold: h.fold, colour: h.colour }));
  const [wipe] = useState(() => Boolean(game.host?.you) && Date.now() - Date.parse(game.openedAt) < WIPE_WINDOW_MS);

  // The countdown stays one element from room.start to 600 ms after Go, across the hand-off to the run underneath.
  const counting = state.phase === 'countdown' || (state.phase === 'live' && state.counted && !countGone);
  const withCount = (main) => (
    <>
      {main}
      {counting && state.startsAt ? <LiveCountdown startsAt={state.startsAt} serverNow={serverNow} heads={heads} count={count} onGo={onCountGo} onOver={onCountOver} line={isRace(game) ? FORMAT_COPY.raceRule(raceMinutes(game)) : null} /> : null}
    </>
  );

  const anytime = (
    <button type="button" className="btn-volt md mp-key-primary" data-page-primary="" onClick={onAnytime}>{LIVE_COPY.playItNow}</button>
  );
  const den = <Link className="mp-link" href={hrefs.den}>{LIVE_COPY.backToDen}</Link>;

  switch (state.phase) {
    case 'connecting':
      return (
        <section className="lv-lobby" aria-busy="true">
          <LiveHeadOnly game={game} hrefs={hrefs} />
          <LobbyStage seats={{ here: [], open: Math.min(5, Math.max(2, members.length)) }} skeleton />
          <p className="mp-sr" role="status">{LIVE_COPY.opening}</p>
        </section>
      );
    case 'off':
      return <LiveNotice game={game} me={me} hrefs={hrefs} line={state.notice || LIVE_COPY.busy} primary={anytime} secondary={den} />;
    case 'fallback':
      return <LiveNotice game={game} me={me} hrefs={hrefs} line={LIVE_COPY.busy} primary={anytime} secondary={den} />;
    case 'failed':
      return (
        <LiveNotice game={game} me={me} hrefs={hrefs} title={LIVE_COPY.loadFailed} line={state.notice}
          primary={<button type="button" className="btn-volt md mp-key-primary" data-page-primary="" onClick={() => ctl.current?.rejoin()}>{LIVE_COPY.tryAgain}</button>} secondary={den} />
      );
    case 'away':
      return (
        <LiveNotice game={game} me={me} hrefs={hrefs} line={LIVE_COPY.away}
          primary={<button type="button" className="btn-volt md mp-key-primary" data-page-primary="" onClick={() => ctl.current?.rejoin()}>{LIVE_COPY.rejoin}</button>}
          secondary={<Link className="mp-link" href={hrefs.den}>{LIVE_COPY.playLater}</Link>} />
      );
    case 'cancelled':
      return (
        <LiveNotice game={game} me={me} hrefs={hrefs}
          line={state.cancelledBy && state.cancelledBy === state.youId ? LIVE_COPY.youCancelled(game.closesAt, now) : LIVE_COPY.cancelled(hostName, game.closesAt, now)}
          primary={anytime} secondary={den} />
      );
    case 'live': {
      const names = stillPlaying(state, members);
      const toastName = firstToast ? byId.get(firstToast.m)?.name : null;
      const live = {
        sub: LIVE_COPY.inRoom(inRoom(state).size),
        racersFor,
        caption: state.busy ? LIVE_COPY.busyRun : LIVE_COPY.rulerCaption,
        busy: state.busy,
        toast: toastName ? { key: firstToast.id, text: LIVE_COPY.friendFinished(toastName) } : null,
        podiumOpen: state.busy || everyoneDone(state) || names.length === 0,
        stillPlayingLine: names.length ? LIVE_COPY.stillPlaying(names) : null,
        onAnswered,
      };
      return withCount(<GameRun key={`live:${game.id}`} gameId={game.id} autoStart me={me} hrefs={hrefs} onGame={onGame} live={live} />);
    }
    case 'countdown': {
      return withCount(
        <section className="lv-lobby is-counting">
          <div inert className="lv-lobby__under">
            <LiveHeadOnly game={game} hrefs={hrefs} />
            <LobbyStage seats={seats} />
          </div>
        </section>,
      );
    }
    default:
      return (
        <>
          <LiveLobby
            game={game} seats={seats} state={state} isHost={isHost} hostName={hostName} now={now} hrefs={hrefs} busy={busy} wipe={wipe}
            onReady={() => act('ready', async () => { const ok = await ctl.current?.ready(); if (!ok) throw Object.assign(new Error('ready'), { code: null }); })}
            onStart={() => act('start', () => ctl.current?.start())}
            onSticker={(k) => act('sticker', () => ctl.current?.sticker(k))}
            onStickerGone={onStickerGone}
            onCloseRoom={() => act('cancel', () => ctl.current?.cancel())}
          />
          {error ? <p className="mp-toast lv-error" role="alert">{error}</p> : null}
        </>
      );
  }
}

function LiveHeadOnly({ game, hrefs }) {
  return (
    <div className="mp-head">
      <Link className="mp-icon" href={hrefs.den} aria-label={LIVE_COPY.backToDen}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </Link>
      <div className="mp-head__text">
        <h1 className="mp-head__title">{LIVE_COPY.roomTitle(game)}</h1>
        <p className="mp-head__sub"><span className="lv-dot" aria-hidden="true" />{LIVE_COPY.roomSub(game)}</p>
      </div>
    </div>
  );
}
