// The hero film's files and chapters (round 9, 9 Nov 2026; v6 film 22 Nov 2026; HeroFilm.jsx, hero-film.css). Plain data and two pure helpers,
// so the tests can run them. The film is the walkthrough with a hook (Hero16 in the promo-film project): muted first,
// looped, nine player chapters. r4 (owner, 9 Nov ~10:40 am): a short narrated walkthrough, straight to the point, seven
// numbered features after klayprep's grammar, each readable muted.

// The ten player chapters (v6, 22 Nov 2026, owner LK368: "we have added many things, many features"): the opening, nine
// numbered tools as the product shows them today (Practise with NTA style, the Mistake Lab, Learn, Key cards, Ask Mobi with a
// photo, the Daily Five, Benchmarks, the Mob, DU Compass; the sign-up card plays inside the last one). `start` is the first frame
// of the chapter's picture in seconds, copied from the film's out/hero/v6/chapters.json (Hero16v6, 72.317 s; no runtime fetch).
// Rollback to v5 (53 s, nine chapters, hero-v5-* files, still in public/video): the v5 block in git history (main 6ad2c7f63).
export const FILM_CHAPTERS = Object.freeze([
  Object.freeze({ id: 'start', name: 'Start', start: 0 }),
  Object.freeze({ id: 'practise', name: 'Practise', start: 10.567 }),
  Object.freeze({ id: 'lab', name: 'Mistake Lab', start: 19.067 }),
  Object.freeze({ id: 'learn', name: 'Learn', start: 26.233 }),
  Object.freeze({ id: 'keycards', name: 'Key cards', start: 30.783 }),
  Object.freeze({ id: 'askmobi', name: 'Ask Mobi', start: 35.7 }),
  Object.freeze({ id: 'daily', name: 'Daily Five', start: 43.617 }),
  Object.freeze({ id: 'rival', name: 'Benchmarks', start: 49.917 }),
  Object.freeze({ id: 'mob', name: 'The Mob', start: 54.117 }),
  Object.freeze({ id: 'compass', name: 'DU Compass', start: 60.533 }),
]);

export const FILM = Object.freeze({
  label: 'MockMob walkthrough, 72 seconds',
  poster: '/video/hero-v6-poster.webp',
  // 30 fps H.264 + AAC, faststart; new names so no cache keeps the launch teaser.
  sources: Object.freeze({ 480: '/video/hero-v6-480.mp4', 720: '/video/hero-v6-720.mp4', 1080: '/video/hero-v6-1080.mp4' }),
  width: 1280,
  height: 720,
  visibleShare: 0.5,
  chapters: FILM_CHAPTERS,
});

// The file the frame needs: its rendered width in device pixels (the ratio capped at 2), up to 640 -> 480p, up to
// 1100 -> 720p, else 1080p. Data Saver always takes 480p. So does a weak device (21 Nov 2026, owner LK353: the yardstick is
// a Rs 15,000 Chromebook or phone): the site's own lite flag (html[data-lite], set in layout.js for 4 GB of memory or less,
// or few cores) took the 720p file (6.4 MB) on a 390 px phone at 2x, against 3.6 MB for 480p.
export function pickSource(cssWidth, dpr, saveData, lite = false) {
  if (saveData || lite) return FILM.sources[480];
  const px = (Number(cssWidth) || 0) * Math.min(Number(dpr) || 1, 2);
  if (px <= 640) return FILM.sources[480];
  if (px <= 1100) return FILM.sources[720];
  return FILM.sources[1080];
}

// A link the browser reports as 2G or 3G (Network Information API `effectiveType`; Chrome on Android has it, Safari and
// Firefox do not, and an unknown value is never called slow). There the film does not start by itself.
export function slowLink(effectiveType) {
  return effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';
}

// The chapter playing at `time` and how far through it the film is (0..1). `duration` ends the last chapter; before the
// film's length is known the last chapter's share is 0.
export function chapterAt(time, duration, chapters = FILM_CHAPTERS) {
  const t = Math.max(0, Number(time) || 0);
  let index = 0;
  for (let i = 1; i < chapters.length; i += 1) if (t >= chapters[i].start) index = i;
  const from = chapters[index].start;
  const to = index + 1 < chapters.length ? chapters[index + 1].start : Number(duration) || 0;
  const share = to > from ? Math.min(1, Math.max(0, (t - from) / (to - from))) : 0;
  return { index, share };
}
