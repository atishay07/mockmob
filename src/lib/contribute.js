// CONTRIBUTE_ENABLED: the writing side of the old community idea (Contribute, My uploads, the Practice "Add a question"
// panel and the vote arrows). Default OFF (COMMUNITY-1018, owner answer of 18 Oct 2026): the features are hidden, never
// deleted. Their routes, tables and files stay, and setting CONTRIBUTE_ENABLED=true brings every one of them back.
// Read on the server only (the (app) layout hands the answer to the browser through ContributeFlagProvider).
export const contributeEnabled = () => process.env.CONTRIBUTE_ENABLED === 'true';

// What the two write endpoints answer while the flag is off: a clear 403 with a stable code, never a 404 or a silent drop.
export const CONTRIBUTIONS_PAUSED = Object.freeze({
  code: 'contributions_paused',
  message: 'Question contributions are paused for now. Everything you sent earlier is kept.',
});
export const contributionsPausedResponse = () => Response.json({ error: CONTRIBUTIONS_PAUSED.message, code: CONTRIBUTIONS_PAUSED.code }, { status: 403 });
