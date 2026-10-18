// The credits page's words, kept pure so a test can hold them to the release gates (data/capabilities.js).
// Written replies run on runtimeAi; only new top-ups run on aiCommerce. A closed top-up checkout must never read as
// "replies are paused" while replies are live (release 9 audit, MEDIUM truth finding).

/** The sentence after the monthly allowance line, by what is actually open. */
// checkoutOpen is the wallet's selling switch, walletCommerceOpen() (release 10 verifier M7): the order route sells on it alone.
// packsHere says whether this page lists the packs too; when it does not, the wallet is where they are bought.
export function aiCreditsStatusLine({ checkoutOpen, repliesOpen, packsHere = true }) {
  if (checkoutOpen) return packsHere ? 'You can buy more below.' : 'You can buy more on your wallet.';
  if (repliesOpen) return 'New top-ups are paused for now. Your monthly credits work, and credits you bought are kept.';
  return 'Written replies and new top-ups are paused for now. Credits you already have are kept.';
}

/** How credits work, as three ruled rows. While top-ups are paused they speak only about credits already bought. */
export function aiCreditsRules(checkoutOpen) {
  return [
    ['Monthly credits spend first', checkoutOpen ? 'The credits included with Free or Pro are used before any you bought.' : 'The credits included with Free or Pro are used before any you bought earlier.'],
    [checkoutOpen ? 'Purchased credits never expire' : 'Credits you already bought never expire', 'They stay in your account until you use them.'],
    ['Separate from Pro', checkoutOpen ? 'Buying credits does not change your plan, and Pro does not use them up.' : 'Credits you bought earlier did not change your plan, and Pro does not use them up.'],
  ];
}

/**
 * The signed-in balance as rows that add up to the figure shown (release 10 verifier M7): the free credits left this month and
 * the credits held (bought, earned or given; users.credit_balance and bonus credits), which stay until they are used.
 * Null when the wallet is not known.
 */
export function aiCreditsBreakdown(wallet) {
  if (!wallet?.known || !Number.isFinite(wallet.total)) return null;
  const free = Number.isFinite(wallet.includedRemaining) ? wallet.includedRemaining : 0;
  const held = Math.max(0, wallet.total - free);
  return [
    { key: 'total', label: 'Your balance', figure: wallet.total, note: 'Credits' },
    { key: 'free', label: 'Free this month', figure: free, note: Number.isFinite(wallet.includedMonthlyCredits) ? `of ${wallet.includedMonthlyCredits}, used first` : 'used first' },
    { key: 'held', label: 'Held credits', figure: held, note: 'stay until you use them' },
  ];
}

/** The page's questions, by whether selling is open (walletCommerceOpen). */
export function aiCreditsFaqs(checkoutOpen) {
  return [
    {
      q: 'Do my credits expire?',
      a: 'Credits you hold, bought or earned, stay in your account until you spend them. Only the free credits go back to the monthly amount on the 1st.',
    },
    {
      q: 'Which credits are used first?',
      a: 'The free credits for this month are used first. Credits you hold are used after them.',
    },
    {
      q: 'Is Pro separate?',
      a: checkoutOpen
        ? 'Yes. Pro is billed separately from credits. With Pro, practice needs no credits, so credits go to Ask Mobi.'
        : 'Yes. Pro is billed separately from credits. New top-ups are paused for now, and credits you hold are kept.',
    },
  ];
}
