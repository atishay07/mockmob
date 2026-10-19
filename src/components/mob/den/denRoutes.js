// Where the den's keys go on the website. The game URLs come from the play owner's one contract (gameHref in
// MobGame.jsx, built in playModel.mjs so the den does not pull the game's code):
//   Play <name>'s sprint  -> /mob/game/<id>?play=1     See the podium so far -> ?view=podium
//   Fix it together       -> ?view=fix                  Moments -> ?view=moments        Close or back -> /mob
import { gameHref as playHref } from '../v3/play/playModel.mjs';

export const GAME_BASE = '/mob/game';
/** The run. With play=1 the clock starts at once (the den's "Play <name>'s sprint" and "Play it now" keys). */
export const gameHref = (id) => playHref(id, 'run', '?play=1');
/** The game's card without starting the clock ("Play later" on a live room). */
export const gameCardHref = (id) => playHref(id, 'run');
export const podiumHref = (id) => playHref(id, 'podium');
export const momentsHref = (id) => playHref(id, 'moments');
export const fixHref = (id) => playHref(id, 'fix');
export const DEN_HREF = '/mob';
export const CHAIN_HREF = '/mob/chains';
export const MOB_CHAIN_HREF = '/mob/chains?tab=mob';
export const SHELF_HREF = '/mob/shelf';
export const SUBJECTS_HREF = '/onboarding?edit=true&back=/mob';
