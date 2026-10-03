// This installed Razorpay SDK accepts a boolean as its second argument.
// On rejection, only a fetched terminal state can confirm that renewals ended.
export async function cancelMonthlyRenewal(subscriptions, subscriptionId) {
  try {
    return await subscriptions.cancel(subscriptionId, true);
  } catch (error) {
    let current;
    try { current = await subscriptions.fetch(subscriptionId); } catch { throw error; }
    if (current?.id === subscriptionId && ['cancelled', 'completed'].includes(current.status)) return current;
    throw error;
  }
}
