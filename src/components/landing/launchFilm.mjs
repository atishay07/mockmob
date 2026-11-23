// The launch film's place on the home page (owner LK427, 23 Nov 2026: "This is good but this is not for the hero section. I
// don't know if we can incorporate it somewhere on the website or not. Let's see about that."). The film is cut 5j (82 s,
// narrated, real student clips), the one he called final. One key under the hero film opens it in a full-screen player.
// It is NOT on for visitors: the key is drawn hidden and shows only with /?film=1 (a preview he can open on his phone), until
// he says so; then NEXT_PUBLIC_LAUNCH_FILM=true at build time turns it on for everyone. Pure, so node --test can hold it.

/** The query that previews the key, in development and on the live site: /?film=1 */
export const FILM_PREVIEW_PARAM = 'film';
/** On for every visitor only when the build says so (the owner's switch). */
export const LAUNCH_FILM_ON = process.env.NEXT_PUBLIC_LAUNCH_FILM === 'true';

// The files carry the cut in their names, so a new cut is a new address (public/video).
export const LAUNCH_FILM = Object.freeze({
  seconds: 82,
  width: 1280,
  height: 720,
  poster: '/video/launch-5j-poster.webp',
  sources: Object.freeze({ full: '/video/launch-5j-720.mp4', lite: '/video/launch-5j-480.mp4' }),
});

export const LAUNCH_FILM_COPY = Object.freeze({
  key: `Watch the ${LAUNCH_FILM.seconds}-second launch film`,
  title: 'The MockMob launch film',
  close: 'Close the film',
});

/** Whether the key shows: the owner's switch, or the preview query (`search` is location.search). */
export function launchFilmShown({ on = LAUNCH_FILM_ON, search = '' } = {}) {
  if (on) return true;
  try { return new URLSearchParams(search).get(FILM_PREVIEW_PARAM) === '1'; } catch { return false; }
}

/** The file for this device: the lighter one on a weak device or when the reader asked to save data. */
export const launchFilmSource = ({ lite = false, saveData = false } = {}) => (lite || saveData ? LAUNCH_FILM.sources.lite : LAUNCH_FILM.sources.full);
