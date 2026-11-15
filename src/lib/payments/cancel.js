// This installed Razorpay SDK accepts a boolean as its second argument.
// On rejection, only a fetched terminal state can confirm that renewals ended.
// Account cancels at the end of the paid month. Account deletion and a full refund (M2, M4, audit 15 Nov 2026) pass
// atCycleEnd: false: no access is left to keep, and Razorpay can refuse a cycle-end cancel while a renewal is retrying.
export async function cancelMonthlyRenewal(subscriptions, subscriptionId, { atCycleEnd = true } = {}) {
  try {
    return await subscriptions.cancel(subscriptionId, atCycleEnd);
  } catch (error) {
    let current;
    try { current = await subscriptions.fetch(subscriptionId); } catch { throw error; }
    if (current?.id === subscriptionId && ['cancelled', 'completed'].includes(current.status)) return current;
    throw error;
  }
}
