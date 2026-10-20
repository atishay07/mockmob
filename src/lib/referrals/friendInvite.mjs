// Friend referrals (owner D165, 20 Oct 2026): a referral gives BOTH the inviter and the friend +100 credits once the friend
// signs up AND finishes one practice of any length (D182, 20 Oct 2026, 5:45 pm IST: it was 5 answers at first); the Mob
// invite link is also the referral link. The rules that move credits live in the database
// (supabase/migrations/20261020130000_referrals.sql, the practice floor in 20261020150000_referral_any_practice.sql); this file holds the parts the website, the server and the
// app share: the code formats, the pending-invite cookie, the switch and every word a student reads. Pure: no I/O, no
// React, so data/tests/referrals_1020.test.mjs can hold it.
// Not the creator codes: those are ?ref= on /pricing in the mm_ref cookie (src/lib/server/sessionProxy.js). A friend invite
// has its own cookie (mm_invite), its own link (/r/<code>) and its own code shape (7 Crockford characters).
// Copy rules (owner UI standards): plain sentence case, no "!", no em dash, no middle dot; never a friend's name.

export const SITE = 'https://www.mockmob.in';
export const INVITE_COOKIE = 'mm_invite';
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const DEVICE_COOKIE = 'mm_dev';
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export const REFERRAL_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{7}$/;
export const MOB_CODE_RE = /^(?:[0-9A-HJKMNP-TV-Z]{6}|[0-9A-HJKMNP-TV-Z]{8})$/;
export const SOURCES = Object.freeze(['link', 'code', 'mob_invite']);
/** What the database pays and caps by default (referral_program); the server's status is the truth when it answers. */
export const DEFAULT_REWARD = 100;
export const DEFAULT_MONTHLY_CAP = 10;

/** The switch: REFERRALS_ENABLED=true turns capture, claims and every invite line on. Off by default. */
export function referralsLive(env = process.env) {
  return env?.REFERRALS_ENABLED === 'true';
}

/** A code as typed or pasted, read the Crockford way (O is 0, I and L are 1). Null unless it is a referral code (7 characters)
 *  or a Mob invite code (6 or 8). The database reads it the same way (mm_referral_normalise_code). */
export function normaliseInviteCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return REFERRAL_CODE_RE.test(code) || MOB_CODE_RE.test(code) ? code : null;
}

/** 'referral' | 'mob_invite' | null */
export function inviteKind(code) {
  if (REFERRAL_CODE_RE.test(code || '')) return 'referral';
  if (MOB_CODE_RE.test(code || '')) return 'mob_invite';
  return null;
}

/** A code pulled out of whatever was pasted: a bare code, mockmob.in/r/<code>, mockmob.in/join/<code> or ?ref=<code>. */
export function codeFromInput(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const fromPath = /\/(?:r|join)\/([0-9A-Za-z -]{6,12})(?:[/?#]|$)/.exec(text);
  if (fromPath) return normaliseInviteCode(fromPath[1]);
  const fromQuery = /[?&]ref=([0-9A-Za-z-]{6,12})(?:[&#]|$)/.exec(text);
  if (fromQuery) return normaliseInviteCode(fromQuery[1]);
  return normaliseInviteCode(text);
}

export const referralLink = (code, origin = SITE) => `${origin}/r/${code}`;

export const ANDROID_PACKAGE = 'in.mockmob.app';

/** True for an Android browser (the user agent says Android). Only used to send a friend's link to the Play Store listing. */
export const isAndroidUserAgent = (ua) => typeof ua === 'string' && /android/i.test(ua.slice(0, 512));

/**
 * The Play Store listing with the invite in the Install Referrer (referrer=invite%3D<code>), so the app can read the code on
 * its first launch and claim it after sign-in. Null unless the code is a valid friend referral code (7 characters, read the
 * Crockford way); only the normalised code ever reaches the URL.
 */
export function playInviteUrl(rawCode) {
  const code = normaliseInviteCode(typeof rawCode === 'string' ? rawCode.slice(0, 16) : rawCode);
  if (!code || inviteKind(code) !== 'referral') return null;
  const query = new URLSearchParams({ id: ANDROID_PACKAGE, referrer: `invite=${code}` });
  return `https://play.google.com/store/apps/details?${query.toString()}`;
}

/** "K7P 2M9X": a 7-character code shown as 3 and 4, easier to read aloud. */
export const displayReferralCode = (code) => (typeof code === 'string' && code.length === 7 ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

/** The pending-invite cookie: "<code>.<source>.<unix seconds>". It is not secret and not trusted: the database checks the
 *  code, the account's age and its practice. The time is set by the server when the link is opened. */
export function encodeInviteCookie({ code, source = 'link', at = Date.now() } = {}) {
  const c = normaliseInviteCode(code);
  if (!c || !SOURCES.includes(source)) return null;
  const seconds = Math.floor(Number(at) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? `${c}.${source}.${seconds}` : null;
}

export function decodeInviteCookie(value) {
  const m = /^([0-9A-Z]{6,8})\.(link|code|mob_invite)\.(\d{9,11})$/.exec(String(value || ''));
  if (!m) return null;
  const code = normaliseInviteCode(m[1]);
  if (!code) return null;
  return { code, source: m[2], clickedAt: new Date(Number(m[3]) * 1000).toISOString() };
}

/**
 * Where GET /r/<code> sends a visitor. { code, to: 'play' | 'join' | 'signup', url } where url is the Play listing for 'play'
 * and null otherwise (the route builds the same-origin urls). 'play': an Android browser with a valid friend code while
 * invites are on. 'join': a Mob invite code pasted here (while on). 'signup': everyone else, as before. code is the
 * normalised code or null; nothing but it ever reaches a url.
 */
export function inviteLanding({ rawCode, userAgent = '', live = false } = {}) {
  const code = normaliseInviteCode(String(rawCode || '').slice(0, 16));
  if (!live || !code) return { code, to: 'signup', url: null };
  if (inviteKind(code) === 'mob_invite') return { code, to: 'join', url: null };
  const url = isAndroidUserAgent(userAgent) ? playInviteUrl(code) : null;
  return url ? { code, to: 'play', url } : { code, to: 'signup', url: null };
}

/**
 * Which pending invite a page visit leaves, or null for none. A typed code and a Mob invite are explicit choices and replace
 * an earlier passive link; a passive link (?ref=) never replaces one (the first friend who sent a link keeps it).
 * /pricing keeps ?ref= for creator codes, and /r/<code> is its own route, so neither is read here.
 */
export function captureFromVisit({ pathname = '/', ref = null, existing = null, now = Date.now() } = {}) {
  const join = /^\/join\/([^/?#]{4,24})\/?$/.exec(pathname);
  if (join) {
    const code = normaliseInviteCode(decodeURIComponent(join[1]));
    if (!code || inviteKind(code) !== 'mob_invite') return null;
    const had = decodeInviteCookie(existing);
    if (had && had.code === code) return null;
    return encodeInviteCookie({ code, source: 'mob_invite', at: now });
  }
  if (!ref || pathname === '/pricing' || pathname.startsWith('/pricing/') || pathname.startsWith('/r/')) return null;
  const code = normaliseInviteCode(String(ref));
  if (!code || inviteKind(code) !== 'referral') return null;
  if (decodeInviteCookie(existing)) return null;
  return encodeInviteCookie({ code, source: 'link', at: now });
}

// ---- words ---------------------------------------------------------------------------------------------------------------

const fmt = (n) => Number(n).toLocaleString('en-IN');
const whole = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : null;
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

export const REFERRAL_COPY = Object.freeze({
  title: (reward = DEFAULT_REWARD) => `Invite a friend, you both get ${fmt(reward)} credits`,
  how: (reward = DEFAULT_REWARD) => `Share your link. When your friend signs up with it and finishes one practice, you each get ${fmt(reward)} credits.`,
  cap: (cap = DEFAULT_MONTHLY_CAP) => `You can earn this for up to ${plural(cap, 'friend', 'friends')} a month.`,
  mobLine: (reward = DEFAULT_REWARD) => `This link is also a friend invite: when a new friend joins with it and finishes one practice, you each get ${fmt(reward)} credits.`,
  copy: 'Copy link',
  copied: 'Link copied',
  share: 'Share',
  shareText: (reward = DEFAULT_REWARD) => `Practise for CUET with me on MockMob. Sign up with my link and we both get ${fmt(reward)} credits when you finish one practice.`,
  codeLabel: 'Your invite code',
  loading: 'Reading your invites',
  failed: 'Your invites did not load. Try again shortly.',
  none: 'No friends have joined with your link yet.',
  paused: 'Invite rewards are paused for now. A friend who practises meanwhile is paid when they resume.',
  capReached: (cap = DEFAULT_MONTHLY_CAP, reward = DEFAULT_REWARD) => `You have reached ${plural(cap, 'friend', 'friends')} this month. Friends who join still get their ${fmt(reward)} credits.`,
  rules: 'An invite counts for a new account only, once per friend, and never for a second account on the same phone.',
  // Signup: a code typed by hand, and the line a friend's link leaves.
  signupField: 'Invite code (optional)',
  signupHint: 'From a friend or a Mob invite link.',
  signupBad: 'That code does not look right. Invite codes have 6, 7 or 8 letters and numbers.',
  signupSaved: 'Invite code saved. It is added when you sign up.',
  invitedBanner: (reward = DEFAULT_REWARD) => `A friend invited you. Finish one practice after you sign up and you both get ${fmt(reward)} credits.`,
  // The friend's own side, in their Wallet.
  invitedJoined: (reward = DEFAULT_REWARD) => `You joined with a friend's invite. Finish one practice and you both get ${fmt(reward)} credits.`,
  invitedRewarded: (reward = DEFAULT_REWARD) => `You and your friend each got ${fmt(reward)} credits for finishing one practice.`,
  // The Wallet's kept credits now: the old one-time 100 is gone for new accounts (D165).
  keptNote: 'Credits you earn or buy. They do not expire.',
  // Pricing.
  pricingWelcome: 'New accounts start with this month’s 50 free credits.',
  pricingInvite: (reward = DEFAULT_REWARD) => `Invite a friend and you both get ${fmt(reward)} credits once they finish a practice.`,
  // History lines (credit_transactions action 'referral').
  historyInviter: 'A friend you invited practised',
  historyFriend: 'Joined with a friend’s invite',
});

/**
 * The status as lines a student reads. status is GET /api/referrals' body (or null). Returns null when invites are off or the
 * status is unknown, so a caller shows nothing rather than a guess.
 * { title, how, cap, code, displayCode, link, summary, lines[], invited }
 */
export function referralView(status) {
  if (!status || status.live !== true || typeof status.code !== 'string') return null;
  const reward = whole(status.reward) || DEFAULT_REWARD;
  const cap = whole(status.monthlyCap) ?? DEFAULT_MONTHLY_CAP;
  const joined = whole(status.joined) ?? 0;
  const practised = whole(status.practised) ?? 0;
  const rewarded = whole(status.rewarded) ?? 0;
  const notCounted = whole(status.notCounted) ?? 0;
  const earned = whole(status.earned) ?? 0;
  const lines = [];
  let summary;
  if (joined === 0) summary = REFERRAL_COPY.none;
  else {
    const head = `${plural(joined, 'friend', 'friends')} joined, ${fmt(practised)} practised`;
    summary = rewarded > 0 && rewarded === practised ? `${head}: +${fmt(reward)} each.` : `${head}.`;
    if (earned > 0) lines.push(`You have earned ${plural(earned, 'credit', 'credits')} from invites.`);
    if (notCounted > 0) lines.push(`${plural(notCounted, 'invite', 'invites')} did not count toward your reward.`);
  }
  if (status.paused === true) lines.push(REFERRAL_COPY.paused);
  else if (status.capReached === true) lines.push(REFERRAL_COPY.capReached(cap, reward));
  const invited = status.invited && typeof status.invited === 'object'
    ? (status.invited.rewarded === true ? REFERRAL_COPY.invitedRewarded(reward) : status.invited.state === 'joined' ? REFERRAL_COPY.invitedJoined(reward) : null)
    : null;
  return {
    title: REFERRAL_COPY.title(reward),
    how: REFERRAL_COPY.how(reward),
    cap: REFERRAL_COPY.cap(cap),
    rules: REFERRAL_COPY.rules,
    code: status.code,
    displayCode: displayReferralCode(status.code),
    link: typeof status.link === 'string' ? status.link : referralLink(status.code),
    shareText: REFERRAL_COPY.shareText(reward),
    summary,
    lines,
    invited,
    reward,
  };
}
