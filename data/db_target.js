// Which Supabase project a server or script is pointed at. No 'server-only' import and no other imports,
// so node:test, scripts and src/lib/supabase.js can all load it.
//
// Production is the project students use. Staging is its free-plan twin for local work. Both count against
// the same organisation's 5 GB monthly egress, so a developer machine that reads production wastes the
// students' allowance (16 Oct 2026: about 92% of whole-bank copies came from local machines). The rule is
// in docs/brain/LOCAL-ENV-STAGING.md: local .env.local files point at staging.
export const PRODUCTION_SUPABASE_REF = 'isrxrxzjocewrdureyhp';
export const STAGING_SUPABASE_REF = 'onwkqxmjqjrhfbjjdydu';

/** The project ref of a Supabase URL (the first label of its host), or '' when the value is not a URL. */
export function supabaseRef(url) {
  try {
    return new URL(String(url || '')).hostname.split('.')[0].toLowerCase();
  } catch {
    return '';
  }
}

export const pointsAtProduction = (url) => supabaseRef(url) === PRODUCTION_SUPABASE_REF;

/** The URL the website server uses (src/lib/supabase.js reads NEXT_PUBLIC_SUPABASE_URL). */
export const serverSupabaseUrl = (env = process.env) => env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';

/** True for anything that is not Vercel production (a dev server, a script, a preview, a test run) but talks to production. */
export function nonProductionUsesProduction(env = process.env) {
  return env.VERCEL_ENV !== 'production' && pointsAtProduction(serverSupabaseUrl(env));
}

export function productionFromOutsideLine(env = process.env) {
  return `[db-target] this server is not Vercel production (VERCEL_ENV=${env.VERCEL_ENV || 'unset'}) but its Supabase URL is the production project. `
    + 'Every read here spends the students\' egress allowance. Point .env.local at staging: docs/brain/LOCAL-ENV-STAGING.md.';
}

let warned = false;
/** One warning per process (never a throw: the owner may do this on purpose). Returns whether it warned. */
export function warnIfProductionFromOutside({ env = process.env, log = console.warn } = {}) {
  if (warned || !nonProductionUsesProduction(env)) return false;
  warned = true;
  log(productionFromOutsideLine(env));
  return true;
}
export function resetDbTargetWarning() { warned = false; }

/**
 * Which variables of an env file hold a production or staging project URL. Returns variable NAMES only: the
 * values (keys, secrets) are never copied out. Used by scripts/dev/env-targets.mjs.
 */
export function classifyEnvText(text) {
  const out = { production: [], staging: [] };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const name = line.slice(0, line.indexOf('=')).trim();
    const value = line.slice(line.indexOf('=') + 1);
    if (value.includes(PRODUCTION_SUPABASE_REF)) out.production.push(name);
    if (value.includes(STAGING_SUPABASE_REF)) out.staging.push(name);
  }
  return out;
}
