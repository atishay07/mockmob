// The hero film's files and chapters (round 9, 9 Nov 2026; HeroFilm.jsx, hero-film.css). Plain data and two pure helpers,
// so the tests can run them. The film is the walkthrough with a hook (Hero16 in the promo-film project): muted first,
// looped, nine player chapters (v10, 23 Nov 2026). r4 (owner, 9 Nov ~10:40 am): a short narrated walkthrough, straight to the point, seven
// numbered features after klayprep's grammar, each readable muted.

// The nine player chapters (v10, 23 Nov 2026, owner LK431: the film rebuilt after its first 24 seconds, then "Yes, you can switch
// it to live"). `start` is the first frame of the chapter's picture in seconds, copied from the film's
// out/hero/v10/chapters.json (Hero16v10, 65.883 s; no runtime fetch). The film has eleven pictures; the bar holds nine 24 px
// segments on a 360 px phone (measured: ten ran 12 px into the sound key), so Learn (5.2 s) and Key cards (3.7 s) share one
// chapter, and the CUET 2026 coverage runs on into the fifteen subjects and the sign-up card as one.
// 26 Nov 2026: v12 (Hero16v12, 76.6 s) is v10 with the coverage line in the owner's own words ("Two in every three questions were
// already covered on MockMob last year, but we didn't stop there. For CUET 2027, we built the rest. Now, almost every single question
// is there on MockMob."); every chapter start is v10's, the coverage chapter runs longer. Roll-back to v10: the hero-v10-* files
// are kept in public/video (config in git at 458481e2b).
// Rollback to v5 (53 s, nine chapters, hero-v5-* files, still in public/video): the v5 block in git history (main 557db4105).
export const FILM_CHAPTERS = Object.freeze([
  Object.freeze({ id: 'start', name: 'Start', start: 0 }),
  Object.freeze({ id: 'mocks', name: 'Mocks', start: 10.567 }),
  Object.freeze({ id: 'lab', name: 'Mistake Lab', start: 16.983 }),
  Object.freeze({ id: 'learn', name: 'Learn and Key cards', start: 23.683 }),
  Object.freeze({ id: 'askmobi', name: 'Ask Mobi', start: 32.567 }),
  Object.freeze({ id: 'daily', name: 'Daily Five', start: 37.183 }),
  Object.freeze({ id: 'plan', name: 'Plan and colleges', start: 43.433 }),
  Object.freeze({ id: 'mob', name: 'The Mob', start: 47.567 }),
  Object.freeze({ id: 'proof', name: 'CUET coverage', start: 51.183 }),
]);

export const FILM = Object.freeze({
  label: 'MockMob walkthrough, 77 seconds',
  poster: '/video/hero-v12-poster.webp',
  // 30 fps H.264 + AAC, faststart; new names so no cache keeps the launch teaser.
  sources: Object.freeze({ 480: '/video/hero-v12-480.mp4', 720: '/video/hero-v12-720.mp4', 1080: '/video/hero-v12-1080.mp4' }),
  width: 1280,
  height: 720,
  visibleShare: 0.5,
  chapters: FILM_CHAPTERS,
});

// The file the frame needs: its rendered width in device pixels (the ratio capped at 2), up to 640 -> 480p, up to
// 1100 -> 720p, else 1080p. Data Saver always takes 480p. So does a weak device (21 Nov 2026, owner LK353: the yardstick is
// a Rs 15,000 Chromebook or phone): the site's own lite flag (html[data-lite], set in layout.js for 4 GB of memory or less,
// or few cores) took the 720p file on a 390 px phone at 2x (v10: 7.9 MB, against 4.5 MB for 480p).
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
