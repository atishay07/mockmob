// "This database function is not there yet": remembered for a few minutes, per function name (review fix, 20 Oct 2026).
//
// The den asks for optional things whose migration may be applied after the code ships (Mob hours: mob_hours_head, mob_hours_rows; Fix it
// together: mob_den_fix). Until the migration is applied, each ask comes back "function not found". Asked on every den read that is two
// calls a den that always fail, on the busiest read of the app, so the first miss is remembered and the function is not asked for again for
// RETRY_MS: the same rule data/attempt_reads.js and data/attempt_question_ids.js use. The cost is the other direction: once the migration is
// applied, a running server notices within RETRY_MS (a server that has just started notices at once). No imports, so node:test drives it.
export const MISSING_RETRY_MS = 5 * 60 * 1000;

/** `now` is the service clock in ms. */
export function createMissingMemo({ now = Date.now, retryMs = MISSING_RETRY_MS } = {}) {
  const missedAt = new Map(); // function name -> ms of the miss
  return {
    /** True while the function is remembered as missing: do not ask. Forgets it once retryMs has passed, so the next ask goes through. */
    skip(name) {
      const at = missedAt.get(name);
      if (at === undefined) return false;
      if (now() - at < retryMs) return true;
      missedAt.delete(name);
      return false;
    },
    miss(name) { missedAt.set(name, now()); },
    /** The function answered: forget any older miss. */
    seen(name) { missedAt.delete(name); },
    size: () => missedAt.size,
  };
}
