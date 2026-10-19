"use client";
// A Mob v3 game on the web: the run (R1 to R6), the podium (R7), everyone's moment (R8) and Fix it together (R9).
// One page, /mob/game/[id], with ?view=podium|moments|fix; ?play=1 starts the run straight away (the den's
// "Play Riya's sprint" key links there). Without it, a game you have not played shows its card first, so an old
// link never starts your clock by itself.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mobGameApi } from './playApi';
import GameRun from './GameRun';
import Podium from './Podium';
import Moments from './Moments';
import FixTogether from './FixTogether';
import { RunHead } from './GameRun';
import { COPY } from './playModel.mjs';
import './play.css';
import '../../mob.css';

export const GAME_VIEWS = Object.freeze(['run', 'podium', 'moments', 'fix']);
export const gameHref = (id, view = 'run', extra = '') => `/mob/game/${encodeURIComponent(id)}${view === 'run' ? extra : `?view=${view}`}`;

export default function MobGame({ gameId, view = 'run', autoStart = false, hrefFor = null, denHref = '/mob' }) {
  const [game, setGame] = useState(null);
  const [mob, setMob] = useState({ name: null, me: null });

  const hrefs = useMemo(() => {
    const h = hrefFor || ((v) => gameHref(gameId, v));
    return { den: denHref, run: h('run'), podium: h('podium'), moments: h('moments'), fix: h('fix') };
  }, [gameId, hrefFor, denHref]);

  const onGame = useCallback((g) => setGame(g), []);

  // The game's title and Mob for the screens after the run.
  useEffect(() => {
    if (view === 'run') return undefined;
    let on = true;
    mobGameApi.game(gameId).then((d) => { if (on) setGame(d.game); }).catch(() => {});
    return () => { on = false; };
  }, [gameId, view]);

  // Your Fold, your colour and the Mob's name come from the den view (never anyone's plan).
  const mobId = game?.mobId;
  useEffect(() => {
    if (!mobId) return undefined;
    let on = true;
    fetch(`/api/mob?mob=${encodeURIComponent(mobId)}`, { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on || !d?.mob?.v3) return;
        const v3 = d.mob.v3;
        const me = (v3.members || []).find((m) => m.you) || null;
        setMob({ name: v3.name?.text || d.mob.subjectName || null, me: me ? { fold: me.fold, colour: me.colour, name: me.name } : null });
      })
      .catch(() => {});
    return () => { on = false; };
  }, [mobId]);

  const v = GAME_VIEWS.includes(view) ? view : 'run';
  return (
    <div className="mp-page" data-view={v}>
      {v === 'run' ? <GameRun key={gameId} gameId={gameId} autoStart={autoStart} me={mob.me} hrefs={hrefs} onGame={onGame} /> : null}
      {v !== 'run' && !game ? (
        <section className="mp-run" aria-busy="true"><RunHead title={COPY.runLoading} sub="" hrefs={hrefs} /><div className="mp-skel mp-skel--rows" aria-hidden="true" /></section>
      ) : null}
      {v === 'podium' && game ? <Podium gameId={gameId} game={game} hrefs={hrefs} /> : null}
      {v === 'moments' && game ? <Moments gameId={gameId} game={game} mobName={mob.name} hrefs={hrefs} /> : null}
      {v === 'fix' && game ? <FixTogether gameId={gameId} game={game} mobName={mob.name} hrefs={hrefs} /> : null}
    </div>
  );
}
