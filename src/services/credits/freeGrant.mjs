// The AI credits Free gets each month, for pages that only show the number (the home page's Ask Mobi line and its FAQ answer).
// Its own module with no imports: the wallet (aiCreditWallet.js) is server-only and loads the database client, so the home page
// never imports it for one number. data/tests/home_next_1120.test.mjs holds this equal to the wallet's AI_FREE_MONTHLY_CREDITS.
export const AI_FREE_MONTHLY_CREDITS = 50;
