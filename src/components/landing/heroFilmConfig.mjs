// The hero film's files and chapters (round 9, 9 Nov 2026; HeroFilm.jsx, hero-film.css). Plain data and two pure helpers,
// so the tests can run them. The film is the walkthrough with a hook (Hero16 in the promo-film project): muted first,
// looped, ten player chapters: the hook, then the study loop (fix, learn, ask, revise, test again), the plan, friends and
// what Pro holds (owner, 9 Nov ~4 am: visitors half-trust us already; build trust, show all we offer).

// The ten player chapters. `start` is the first frame of the chapter's picture in seconds, copied from the film's
// out/hero/chapters.json (Hero16 plan of 9 Nov, 66.967 s; no runtime fetch).
export const FILM_CHAPTERS = Object.freeze([
  Object.freeze({ id: 'score', name: 'Your score', start: 0 }),
  Object.freeze({ id: 'repair', name: 'Mistake Repair', start: 13.933 }),
  Object.freeze({ id: 'learn', name: 'Learn', start: 18.75 }),
  Object.freeze({ id: 'askmobi', name: 'Ask Mobi', start: 23.033 }),
  Object.freeze({ id: 'keycards', name: 'Key cards', start: 28.4 }),
  Object.freeze({ id: 'mocks', name: 'Mocks', start: 32.683 }),
  Object.freeze({ id: 'exam', name: 'Exam screen', start: 39.1 }),
  Object.freeze({ id: 'plan', name: 'Plan and colleges', start: 43.933 }),
  Object.freeze({ id: 'mob', name: 'The Mob', start: 50.35 }),
  Object.freeze({ id: 'value', name: 'What you get', start: 56.25 }),
]);

export const FILM = Object.freeze({
  label: 'MockMob walkthrough, 67 seconds',
  poster: '/video/hero-v2-poster.webp',
  // 30 fps H.264 + AAC, faststart; new names so no cache keeps the launch teaser.
  sources: Object.freeze({ 480: '/video/hero-v2-480.mp4', 720: '/video/hero-v2-720.mp4', 1080: '/video/hero-v2-1080.mp4' }),
  width: 1280,
  height: 720,
  visibleShare: 0.5,
  chapters: FILM_CHAPTERS,
});

// The file the frame needs: its rendered width in device pixels (the ratio capped at 2), up to 640 -> 480p, up to
// 1100 -> 720p, else 1080p. Data Saver always takes 480p.
export function pickSource(cssWidth, dpr, saveData) {
  if (saveData) return FILM.sources[480];
  const px = (Number(cssWidth) || 0) * Math.min(Number(dpr) || 1, 2);
  if (px <= 640) return FILM.sources[480];
  if (px <= 1100) return FILM.sources[720];
  return FILM.sources[1080];
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
