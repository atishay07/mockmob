// The words of the account pop-over: the app's Account sheet (flutter_app/lib/features/account_sheet/account_copy.dart), said for
// the web. Sentence case, no exclamation marks, no em dashes. The web has no notification settings page yet, so that row is not shown.
export const ACCOUNT_POPOVER_COPY = Object.freeze({
  noName: 'Your account',
  planFree: 'Free',
  planPro: 'Pro',
  credits: 'Credits',
  appearance: 'Appearance',
  rowAccount: 'Name, sign-in and plan',
  rowPrivacy: 'Privacy',
  rowHelp: 'Help and about',
  rowContact: 'Write to us',
  contactAddress: 'support@mockmob.in',
  contactHref: 'mailto:support@mockmob.in?subject=MockMob%20help',
  signOut: 'Sign out',
});

/** "until 12 Nov", in India time; null when the date is missing or not a date. */
export function proUntilWords(iso) {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  return `until ${at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;
}
