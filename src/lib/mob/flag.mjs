// The Mob's on/off switch for the one place that must answer before a page renders (src/proxy.js). Pure: no I/O.
// MOB_ENABLED is 'true' or the Mob does not exist: the page answers a real 404, like /join and every /api/mob route.
export const MOB_PATHS = Object.freeze(['/mob', '/mob/']);
export const mobPageOff = (pathname, env = process.env) => env.MOB_ENABLED !== 'true' && MOB_PATHS.includes(pathname);
