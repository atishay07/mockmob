"use client";
// A Mob v3 game on the web: the run (R1 to R6), the podium (R7), everyone's moment (R8) and Fix it together (R9).
// One page, /mob/game/[id], with ?view=podium|moments|fix; ?play=1 starts the run straight away (the den's
// "Play Riya's sprint" key links there). Without it, a game you have not played shows its card first, so an old
// link never starts your clock by itself.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mobGameApi } from './playApi';
import GameRun from './GameRun';
import Podium from './Podium';
import Moments from './Moments';
import FixTogether from './FixTogether';
import { RunHead } from './GameRun';
import { COPY, GAME_VIEWS, gameHref } from './playModel.mjs';
import { liveRoomFor } from '../live/liveModel.mjs';
import LiveRoom from '../live/LiveRoom';
import './play.css';
import '../../mob.css';

// The URL contract lives in playModel.mjs (pure, so the den can link without pulling the game's code); re-exported here.
export { GAME_VIEWS, gameHref };

export default function MobGame({ gameId, view = 'run', autoStart = false, hrefFor = null, denHref = '/mob', openChannel = undefined }) {
  const [game, setGame] = useState(null);
  const [mob, setMob] = useState({ name: null, me: null, members: [] });
  // How the run view plays: 'pending' until the game (and, for a live room, the den's live flag) is known, then
  // 'live' (the room: lobby, countdown, live ruler) or 'run' (anytime). Decided once, so it never flips mid-run.
  const [runMode, setRunMode] = useState('pending');
  const firstGame = useRef(null);
  const denLive = useRef(undefined); // undefined until the den view answers; then { enabled } or null

  // Live only when the server says so (v3.live.enabled, MOB_LIVE_ENABLED) and the room is in its lobby or first
  // 30 seconds. An anytime game never waits for the den. Called from the fetches' replies, never during render.
  const decide = useCallback(() => {
    const g = firstGame.current;
    if (!g) return;
    if (g.mode !== 'live') { setRunMode((m) => (m === 'pending' ? 'run' : m)); return; }
    if (denLive.current === undefined) return;
    const serverNow = Date.parse(g.serverNow) + (Date.now() - g.receivedAt);
    const on = liveRoomFor(g, serverNow, denLive.current?.enabled === true);
    setRunMode((m) => (m === 'pending' ? (on ? 'live' : 'run') : m));
  }, []);

  const hrefs = useMemo(() => {
    const h = hrefFor || ((v) => gameHref(gameId, v));
    return { den: denHref, run: h('run'), podium: h('podium'), moments: h('moments'), fix: h('fix') };
  }, [gameId, hrefFor, denHref]);

  const onGame = useCallback((g) => setGame(g), []);

  // The game's title and Mob for every screen; on the run view it also decides live or anytime.
  useEffect(() => {
    let on = true;
    mobGameApi.game(gameId)
      .then((d) => {
        if (!on) return;
        firstGame.current = { ...d.game, receivedAt: Date.now() };
        setGame((g) => g || d.game);
        decide();
      })
      .catch(() => { if (on) setRunMode((m) => (m === 'pending' ? 'run' : m)); });
    return () => { on = false; };
  }, [gameId, view, decide]);

  // Your Fold, your colour and the Mob's name come from the den view (never anyone's plan).
  const mobId = game?.mobId;
  useEffect(() => {
    if (!mobId) return undefined;
    let on = true;
    fetch(`/api/mob?mob=${encodeURIComponent(mobId)}`, { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        const v3 = d?.mob?.v3;
        denLive.current = v3?.live || null;
        if (v3) {
          const me = (v3.members || []).find((m) => m.you) || null;
          setMob({ name: v3.name?.text || d.mob.subjectName || null, me: me ? { fold: me.fold, colour: me.colour, name: me.name } : null, members: v3.members || [] });
        }
        decide();
      })
      .catch(() => { if (on) { denLive.current = null; decide(); } });
    return () => { on = false; };
  }, [mobId, decide]);

  const v = GAME_VIEWS.includes(view) ? view : 'run';
  const playAnytime = useCallback(() => setRunMode('anytime'), []);

  return (
    <div className="mp-page" data-view={v}>
      {v === 'run' && runMode === 'pending' ? (
        <section className="mp-run mp-run--loading" aria-busy="true"><RunHead title="" sub={COPY.runLoading} hrefs={hrefs} /><div className="mp-ruler mp-skel" aria-hidden="true" /><p className="mp-sr" role="status">{COPY.runLoading}</p></section>
      ) : null}
      {v === 'run' && runMode === 'live' ? (
        <LiveRoom game={game} members={mob.members} me={mob.me} hrefs={hrefs} onGame={onGame} onAnytime={playAnytime} {...(openChannel ? { openChannel } : {})} />
      ) : null}
      {v === 'run' && (runMode === 'run' || runMode === 'anytime') ? <GameRun key={`${gameId}:${runMode}`} gameId={gameId} autoStart={autoStart || runMode === 'anytime'} me={mob.me} hrefs={hrefs} onGame={onGame} /> : null}
      {v !== 'run' && !game ? (
        <section className="mp-run" aria-busy="true"><RunHead title={COPY.runLoading} sub="" hrefs={hrefs} /><div className="mp-skel mp-skel--rows" aria-hidden="true" /></section>
      ) : null}
      {v === 'podium' && game ? <Podium gameId={gameId} game={game} hrefs={hrefs} /> : null}
      {v === 'moments' && game ? <Moments gameId={gameId} game={game} mobName={mob.name} hrefs={hrefs} /> : null}
      {v === 'fix' && game ? <FixTogether gameId={gameId} game={game} mobName={mob.name} hrefs={hrefs} /> : null}
    </div>
  );
}
