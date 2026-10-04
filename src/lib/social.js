// Instagram content shown on the landing page. Edit this list to add or remove reels.
//
// To add one: open the reel on Instagram, copy the code from the address
// (instagram.com/<creator>/reel/CODE/ or instagram.com/reel/CODE/), and add a row.
// Posts are shown as cards; the Instagram embed loads only when a visitor presses play,
// so the page stays light and nothing is sent to Instagram before that.
//
// Only list creators who are happy to be shown. Do not add captions or claims the
// creator did not write. Every number below was read from the creator's public profile or
// reel page on STATS_AS_OF; refresh them together, never edit one in isolation. `about` is a
// paraphrase of the creator's own public bio. Leave a stat out rather than estimate it.
export const INSTAGRAM = Object.freeze({ handle: 'mockmob.in', url: 'https://www.instagram.com/mockmob.in/' });

export const STATS_AS_OF = '3 October 2026';

export const CREATOR_REELS = Object.freeze([
  {
    code: 'DX4Buebt9xI', kind: 'reel', creator: 'Garima Jain', handle: 'du__club', date: '2026-05-03',
    followers: 161411, also: { handle: 'garima.again', followers: 25273 },
    attribution: 'Collaboration with @garima.again and @mockmob.in',
    about: 'CUET, DU admissions and career guidance from your DU senior.',
    title: 'CUET Mocks + 10 Days Strategy', likes: 695,
  },
  {
    code: 'DXuRQXwkvJT', kind: 'reel', creator: 'Rahul Thapa', handle: 'rahul.guides', date: '2026-04-29',
    followers: 12662,
    about: 'Education creator on CUET and college admissions, helping students make better choices.',
    partnership: true,
  },
  {
    code: 'DYMzTYsyU3W', kind: 'reel', creator: 'Prathna Jain', handle: 'prathnajains23', date: '2026-05-11',
    followers: 188,
    about: 'Hansraj College student and creator at @boostprep.cuet, sharing last-minute CUET tips.',
  },
]);

// Owner-reported on 5 October 2026: the featured reels have roughly 100K+ views in total. Instagram
// does not expose a single sum we can read, so this is a floor the owner stated, not a computed value.
export const REEL_VIEWS_FLOOR = 100000;
export const REEL_VIEWS_AS_OF = '5 October 2026';

export const MOCKMOB_POSTS = Object.freeze([
  { code: 'DXsBiyhkz6V', kind: 'p', creator: 'MockMob', handle: 'mockmob.in', date: '2026-04-28' },
  { code: 'DXr9zpuk1TZ', kind: 'p', creator: 'MockMob', handle: 'mockmob.in', date: '2026-04-28' },
  { code: 'DXmwaENk-lB', kind: 'p', creator: 'MockMob', handle: 'mockmob.in', date: '2026-04-26' },
]);

/** Followers across linked public profiles; audiences may overlap. */
export const creatorReach = (item) => (item.followers || 0) + (item.also?.followers || 0);

/** Creators first, biggest audience first; MockMob's own posts follow. */
export const rankedReels = (creators = CREATOR_REELS, posts = MOCKMOB_POSTS) =>
  [...[...creators].sort((a, b) => creatorReach(b) - creatorReach(a)), ...posts];

/** Combined audience of the featured creators, for the summary line. */
export const combinedReach = (creators = CREATOR_REELS) => creators.reduce((sum, c) => sum + creatorReach(c), 0);

/** 25200 -> "25.2K", 161000 -> "161K", 188 -> "188". */
export function compactCount(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`;
}

export const permalink = (item) => `https://www.instagram.com/${item.kind === 'reel' ? 'reel' : 'p'}/${item.code}/`;
export const embedSrc = (item) => `${permalink(item)}embed`;

/** Likes and comments recorded on the featured reels (only counts we actually read). */
export const recordedEngagement = (items = CREATOR_REELS) => items.reduce((sum, i) => sum + (i.likes || 0) + (i.comments || 0), 0);

/** 695 -> 690, 1234 -> 1200: round down so the "+" in the label stays true. */
export function floorForPlus(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const step = n >= 10000 ? 1000 : n >= 1000 ? 100 : 10;
  return Math.floor(n / step) * step;
}
