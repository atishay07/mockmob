// Whole-bank reads (every question with every column, about 41 MB on 15 Oct 2026) run only on Vercel
// production, where the daily cron refreshes the public counts. Vercel only runs crons on production
// deployments. Local dev servers, agents, previews and test runs often point at the production database,
// so there the read is refused with one log line, and callers serve the stored counts instead.
// No 'server-only' import, so node:test and data/db.js can load it.

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
