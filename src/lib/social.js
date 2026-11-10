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
// Where Instagram shows a rounded figure ("208K"), store its floor (208000): igCount prints it back
// as Instagram showed it, never with more precision than was read. Under 10,000 Instagram shows the
// exact count ("8,814"), and so does the page.
// `featured`: the creators the page counts (the summary's followers figure, the hero's proof line and its
// three pictures). A reel without it is still shown in the strip, after the featured ones.
// `photo`: the creator's own Instagram profile picture (150x150, read from the public profile on
// STATS_AS_OF), in public/brand/creators/<handle>.jpg with a .webp copy; the page draws the webp.
export const INSTAGRAM = Object.freeze({ handle: 'mockmob.in', url: 'https://www.instagram.com/mockmob.in/' });

export const STATS_AS_OF = '10 November 2026';

export const CREATOR_REELS = Object.freeze([
  {
    code: 'DX4Buebt9xI', kind: 'reel', creator: 'Garima Jain', handle: 'du__club', date: '2026-05-03',
    followers: 208000, also: { handle: 'garima.again', followers: 28000 },
    attribution: 'Collaboration with @garima.again and @mockmob.in',
    about: 'CUET, DU admissions and career guidance from your DU senior.',
    // Likes read on 3 October 2026 and not re-read (a floor: a reel's likes only grow).
    title: 'CUET Mocks + 10 Days Strategy', likes: 695, views: 77400,
    featured: true, photo: '/brand/creators/du__club.webp',
  },
  {
    code: 'DX11ggsyKFf', kind: 'reel', creator: 'Radhika Gaur', handle: 'radhikagaur_055', date: '2026-05-02',
    followers: 8814,
    about: 'English faculty at Exampur for CBSE 10th, 12th and CUET UG, from Hansraj College, DU.',
    likes: 229, views: 17100,
    featured: true, photo: '/brand/creators/radhikagaur_055.webp',
  },
  {
    code: 'DXuRQXwkvJT', kind: 'reel', creator: 'Rahul Thapa', handle: 'rahul.guides', date: '2026-04-29',
    followers: 12000,
    about: 'Education creator on CUET and college admissions, helping students make better choices.',
    partnership: true, views: 5749,
    featured: true, photo: '/brand/creators/rahul.guides.webp',
  },
  {
    code: 'DYMzTYsyU3W', kind: 'reel', creator: 'Prathna Jain', handle: 'prathnajains23', date: '2026-05-11',
    followers: 180,
    about: 'Hansraj College student and creator at @boostprep.cuet, sharing last-minute CUET tips.',
    views: 1364,
    photo: '/brand/creators/prathnajains23.webp',
  },
]);

// Each reel's `views`: the owner's screenshot of the MockMob reels tab on Instagram, 10 November 2026 (Instagram
// shows them there; a reel page does not). The summary's "Reel views" is their sum (viewsFigure), no longer a floor
// the owner stated.
export const REEL_VIEWS_AS_OF = '10 November 2026';

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

/** The creators the summary counts: the reels marked `featured` that carry a follower count, in the order given. */
export const featuredCreators = (items = rankedReels()) => items.filter((item) => item.kind === 'reel' && item.featured === true && item.followers);

/**
 * The hero's three pictures, in the owner's order (10 Nov 2026: "Garima first, Radhika second, Rahul third ... the first
 * circle is the most recognisable and it's not cut out"): the first picture is the one drawn whole, on top of the stack, so
 * it is the creator a student is most likely to know. Only the hero's line reads this; the creators section keeps its own
 * order (biggest audience first). A featured creator not named here follows, in the order given.
 */
export const HERO_CREATOR_ORDER = Object.freeze(['du__club', 'radhikagaur_055', 'rahul.guides']);
export function heroCreators(creators = featuredCreators()) {
  const place = (c) => { const i = HERO_CREATOR_ORDER.indexOf(c.handle); return i < 0 ? HERO_CREATOR_ORDER.length : i; };
  return creators.map((c, i) => [c, i]).sort((a, b) => place(a[0]) - place(b[0]) || a[1] - b[1]).map(([c]) => c);
}

/** A total rounded down to the thousand, then "+", so the "+" stays true (199,534 is "199K+"); null under a thousand. */
function thousandsPlus(total) {
  const floor = Math.floor(total / 1000) * 1000;
  return floor > 0 ? `${compactCount(floor)}+` : null;
}

/**
 * The summary's "Combined followers" figure: the combined reach rounded down to the thousand, so the "+" stays true
 * (199,534 is "199K+"). The creators section (CreatorReels) and the hero's proof line (HeroProof) both draw it from here, so
 * the two never disagree. null when the rounded reach is under a thousand.
 */
export function followersFigure(creators = featuredCreators()) {
  return thousandsPlus(combinedReach(creators));
}

/** The views recorded on the reels (REEL_VIEWS_AS_OF), added up. */
export const reelViews = (items = CREATOR_REELS) => items.reduce((sum, item) => sum + (item.views || 0), 0);

/** The summary's "Reel views" figure: the reels' views added up, rounded down to the thousand the way the followers are. */
export function viewsFigure(items = CREATOR_REELS) {
  return thousandsPlus(reelViews(items));
}

/**
 * A creator's initials: the first letter of the first and the last word ("Garima Jain" is "GJ"), one grapheme each. `count`
 * 1 gives the first name's letter alone ("G"), for a mark too small to hold two.
 */
export function creatorInitials(name, count = 2) {
  const words = String(name || '').trim().split(/\s+/u).filter(Boolean);
  const segment = (word) => {
    if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)][0]?.segment || '';
    return Array.from(word)[0] || '';
  };
  return (words.length > 1 && count > 1 ? segment(words[0]) + segment(words.at(-1)) : segment(words[0] || '?')).toLocaleUpperCase();
}

/** 25200 -> "25.2K", 161000 -> "161K", 188 -> "188". */
export function compactCount(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`;
}

/**
 * A count the way Instagram prints it, so a figure is never shown with more precision than was read: exact under 10,000
 * (8814 -> "8,814", 180 -> "180"), from 10,000 the rounded "K" Instagram shows (12000 -> "12K", 77400 -> "77.4K", 208000 -> "208K").
 */
export function igCount(n) {
  if (!Number.isFinite(n)) return '';
  return n < 10000 ? n.toLocaleString('en-IN') : compactCount(n);
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
