// Account > Plan, the Google Play part (review 19 Oct night). Pure, so node:test checks it without a browser.
//
// A student can hold monthly Pro from Google Play (bought in the Android app) and a Razorpay monthly subscription (bought
// on the web) at the same time, for example after a failed Razorpay renewal while Razorpay keeps retrying. Google Play's
// renewal is managed in Google Play; Razorpay's can only be stopped here. So the card shows the Google Play part alone
// only while Razorpay can no longer charge, and otherwise shows both, with the Razorpay cancel key.
//
//   pro                 the account is Pro now
//   play                /api/auth/me playSubscription ({ active, autoRenewing, inGracePeriod, onHold }) or null
//   razorpayMayCharge   a Razorpay subscription is on record and its status is active or past_due (the cancel key shows)
//   cancelledNow        the Razorpay cancel was just accepted on this card (the session refresh may lag)
export function playPlanMode({ pro = false, play = null, razorpayMayCharge = false, cancelledNow = false } = {}) {
  const playRenewing = Boolean(pro && play?.active && play.autoRenewing && !play.inGracePeriod);
  const playRenewalOff = Boolean(pro && play?.active && play.autoRenewing === false);
  const playRetrying = Boolean(pro && play?.active && play.inGracePeriod);
  const playOnHold = Boolean(!pro && play?.onHold);
  const playShown = playRenewing || playRenewalOff || playRetrying || playOnHold;
  const both = playShown && (razorpayMayCharge || cancelledNow);
  return { playRenewing, playRenewalOff, playRetrying, playOnHold, playShown, both, playOnly: playShown && !both };
}
