// Where the den's keys go on the website. One place, so the integrator can point them at the game screens the other web
// Mob owners build (run, podium, moments, fix) without touching the den.
export const GAME_BASE = '/mob/game';
export const gameHref = (id) => `${GAME_BASE}/${encodeURIComponent(id)}`;
export const podiumHref = (id) => `${GAME_BASE}/${encodeURIComponent(id)}?view=podium`;
export const CHAIN_HREF = '/mob/chains';
export const MOB_CHAIN_HREF = '/mob/chains?tab=mob';
export const SHELF_HREF = '/mob/shelf';
export const SUBJECTS_HREF = '/onboarding?edit=true&back=/mob';
