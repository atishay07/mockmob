// Whole-bank reads (every question with every column, about 41 MB on 15 Oct 2026) run only on Vercel
// production, where the daily cron refreshes the public counts. Vercel only runs crons on production
// deployments. Local dev servers, agents, previews and test runs often point at the production database,
// so there the read is refused with one log line, and callers serve the stored counts instead.
// No 'server-only' import, so node:test and data/db.js can load it.
//
// Scripts have no VERCEL_ENV, so they use assertScriptFullBankRead: allowed against staging (or any project
// that is not production), and against production only with the explicit --allow-production flag, the same
// flag scripts/nta-index-build.mjs already uses for its production write.
import { pointsAtProduction } from './db_target.js';

export class FullBankReadBlocked extends Error {
  constructor(purpose) {
    super('FULL_BANK_READ_BLOCKED');
    this.name = 'FullBankReadBlocked';
    this.code = 'FULL_BANK_READ_BLOCKED';
    this.purpose = purpose;
  }
}

export function fullBankReadAllowed(env = process.env) {
  return env.VERCEL_ENV === 'production';
}

export function fullBankReadBlockedLine(purpose, env = process.env) {
  return `[full-bank-read] blocked: ${purpose} reads every question and runs only on Vercel production `
    + `(VERCEL_ENV=${env.VERCEL_ENV || 'unset'}). Serving the stored counts instead.`;
}

/** Throws FullBankReadBlocked (after one log line) unless this server is Vercel production. */
export function assertFullBankRead(purpose, { env = process.env, log = console.warn } = {}) {
  if (fullBankReadAllowed(env)) return;
  log(fullBankReadBlockedLine(purpose, env));
  throw new FullBankReadBlocked(purpose);
}

export const isFullBankReadBlocked = error => error?.code === 'FULL_BANK_READ_BLOCKED';

export const ALLOW_PRODUCTION_FLAG = '--allow-production';

export function scriptFullBankReadAllowed({ url, argv = process.argv, env = process.env } = {}) {
  return fullBankReadAllowed(env) || argv.includes(ALLOW_PRODUCTION_FLAG) || !pointsAtProduction(url);
}

export function scriptFullBankReadBlockedLine(purpose) {
  return `[full-bank-read] blocked: ${purpose} reads every question and the Supabase URL in use is the production project. `
    + 'Run it against staging (docs/brain/LOCAL-ENV-STAGING.md), or add --allow-production if the owner wants production read once.';
}

/** For scripts: throws FullBankReadBlocked (after one log line) when about to read the whole production bank from outside Vercel production. */
export function assertScriptFullBankRead(purpose, { url, argv = process.argv, env = process.env, log = console.error } = {}) {
  if (scriptFullBankReadAllowed({ url, argv, env })) return;
  log(scriptFullBankReadBlockedLine(purpose));
  throw new FullBankReadBlocked(purpose);
}
