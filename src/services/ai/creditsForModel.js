// The credits figure Ask Mobi's model sees (STUDENT_CONTEXT_JSON). No 'server-only' and no alias imports on purpose:
// getStudentAIContext.js uses it and data/tests/one_balance_ship_together.test.mjs tests it.
//
// One credits balance (18 Oct 2026, D78): aiCredits.total is the student's ONE balance (free this month + bought + held
// users.credit_balance). The parts are named inside it and no second balance is sent beside it, so the model cannot add
// held credits to the total and count them twice.
export const ONE_BALANCE_NOTE = 'total is the one credits balance; includedRemaining, bonusCredits and heldCredits are parts of it, never add them to total';

/** The one credits balance as the model sees it: one total and its parts. `usageSnapshot` is getUsageSnapshot() output. */
export function oneBalanceForModel(usageSnapshot) {
  const w = usageSnapshot?.aiWallet;
  const int = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);
  if (!w) {
    return { total: int(usageSnapshot?.aiCreditBalance), includedRemaining: int(usageSnapshot?.includedAiCreditsRemaining), bonusCredits: 0, heldCredits: 0, resetAt: null, note: ONE_BALANCE_NOTE };
  }
  return {
    total: w.total ?? null,
    includedRemaining: w.includedRemaining ?? null,
    bonusCredits: w.bonusCredits ?? null,
    heldCredits: w.balanceCredits ?? null,
    resetAt: w.resetAt ?? null,
    state: w.state ?? null,
    note: ONE_BALANCE_NOTE,
  };
}

