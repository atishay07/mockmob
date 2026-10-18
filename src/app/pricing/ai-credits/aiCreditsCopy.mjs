// The AI credits page's words, kept pure so a test can hold them to the release gates (data/capabilities.js).
// Written replies run on runtimeAi; only new top-ups run on aiCommerce. A closed top-up checkout must never read as
// "replies are paused" while replies are live (release 9 audit, MEDIUM truth finding).

/** The sentence after the monthly allowance line, by what is actually open. */
export function aiCreditsStatusLine({ checkoutOpen, repliesOpen }) {
  if (checkoutOpen) return 'You can buy more below.';
  if (repliesOpen) return 'New top-ups are paused for now. Your monthly credits work, and credits you bought are kept.';
  return 'Written replies and new top-ups are paused for now. Credits you already have are kept.';
}

/** How AI credits work, as three ruled rows. While top-ups are paused they speak only about credits already bought. */
export function aiCreditsRules(checkoutOpen) {
  return [
    ['Monthly credits spend first', checkoutOpen ? 'The credits included with Free or Pro are used before any you bought.' : 'The credits included with Free or Pro are used before any you bought earlier.'],
    [checkoutOpen ? 'Purchased credits never expire' : 'Credits you already bought never expire', 'They stay in your account until you use them.'],
    ['Separate from Pro', checkoutOpen ? 'Buying AI credits does not change your plan, and Pro does not use them up.' : 'Credits you bought earlier did not change your plan, and Pro does not use them up.'],
  ];
}
