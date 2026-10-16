// Which page transition a navigation gets, the app's router rules on the web. The classes are drawn
// in motion-kit.css (PAGE TRANSITIONS); the names double as React view transition types.
//
//   Places, in the app's dock order: Today 0, Practice 1, (Learn, on the web's study bar), Review 2,
//   You 3. Switching places fades through toward the side the new place lies.
//   Going deeper (a page under a place) pushes; coming back pops. A result rises; leaving it lowers.
//   Anything else fades. The NTA runner (/test/**) never animates: exam pages stay exactly as NTA.
//
// Wiring (AppLayoutClient and the place links):
//   <Link href={href} transitionTypes={transitionTypesFor(pathname, href)}>
//   <ViewTransition {...VIEW_TRANSITION_PROPS}>{children}</ViewTransition>   (experimental.viewTransition)

export const VT = Object.freeze({
  placeFwd: 'mm-place-fwd',
  placeBack: 'mm-place-back',
  push: 'mm-push',
  pop: 'mm-pop',
  rise: 'mm-rise',
  riseBack: 'mm-rise-back',
  fade: 'mm-fade',
});

/** The places by their first path segment, in dock order. Learn sits between Practice and Review as on the web's study bar. */
export const PLACE_ORDER = Object.freeze({ today: 0, dashboard: 1, learn: 1.5, review: 2, profile: 3 });

/** First path segments whose pages are results: they rise. */
export const RESULT_SEGMENTS = Object.freeze(['result']);

/** The path of an href or URL: no origin, query or hash, no trailing slash. */
export function pathOf(href) {
  if (href == null) return null;
  let text = String(href);
  if (typeof href === 'object' && href.pathname) text = href.pathname;
  text = text.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0] || '/';
  if (!text.startsWith('/')) text = `/${text}`;
  return text.length > 1 ? text.replace(/\/+$/, '') : text;
}

const segments = (path) => path.split('/').filter(Boolean);

/** The NTA runner and anything under it: never a transition. */
export function isTestPath(href) {
  const path = pathOf(href);
  return path === '/test' || Boolean(path?.startsWith('/test/'));
}

/** The place a path belongs to, or null. */
export function placeOf(href) {
  const first = segments(pathOf(href) || '')[0];
  return first && Object.hasOwn(PLACE_ORDER, first) ? first : null;
}

/** True for the place's own page (/today, /review), not a page under it. */
export function isPlaceRoot(href) {
  const parts = segments(pathOf(href) || '');
  return parts.length === 1 && Object.hasOwn(PLACE_ORDER, parts[0]);
}

export function isResultPath(href) {
  return RESULT_SEGMENTS.includes(segments(pathOf(href) || '')[0]);
}

/** The transition class (and type) for going from `from` to `to`, or null for none. */
export function transitionFor(from, to) {
  const a = pathOf(from);
  const b = pathOf(to);
  if (!a || !b || a === b) return null;
  if (isTestPath(a) || isTestPath(b)) return null;
  if (isResultPath(b) && !isResultPath(a)) return VT.rise;
  if (isResultPath(a) && !isResultPath(b)) return VT.riseBack;
  const placeA = placeOf(a);
  const placeB = placeOf(b);
  // To another place's own page: a place switch, toward the side it lies.
  if (isPlaceRoot(b) && placeA && placeA !== placeB) return PLACE_ORDER[placeB] > PLACE_ORDER[placeA] ? VT.placeFwd : VT.placeBack;
  const depthA = segments(a).length;
  const depthB = segments(b).length;
  const within = b.startsWith(`${a}/`) || (placeA && placeA === placeB);
  if (depthB > depthA && within) return VT.push;
  if (depthB < depthA && (a.startsWith(`${b}/`) || (placeA && placeA === placeB))) return VT.pop;
  return VT.fade;
}

/** For Link's transitionTypes and router.push: [type], or [] (no transition). */
export function transitionTypesFor(from, to) {
  const type = transitionFor(from, to);
  return type ? [type] : [];
}

const byType = Object.freeze({ ...Object.fromEntries(Object.values(VT).map((name) => [name, name])), default: 'none' });

/**
 * Props for the one React <ViewTransition> around the signed-in content: each type draws its own
 * class, and a navigation without a type (the first load, the back button, the runner) draws nothing.
 */
export const VIEW_TRANSITION_PROPS = Object.freeze({ enter: byType, exit: byType, update: byType, default: 'none' });

// The development preview (/preview/arena?view=...) draws every arena page on one route. Its views map
// to the routes they stand for (ArenaPreviewClient's routeNames), so the preview moves as the real arena.
const PREVIEW_PATH = '/preview/arena';
const PREVIEW_ROUTES = Object.freeze({ prepos: 'mentor', compass: 'admission-compass', radar: 'analytics', ranks: 'leaderboard', rules: 'review/rules', revise: 'review/revise' });

/** The arena path an href stands for: itself, or for a preview URL the route its view draws. */
export function logicalPath(href) {
  const path = pathOf(href);
  if (path !== PREVIEW_PATH) return path;
  const text = typeof href === 'object' && href ? String(href.search || '') : String(href);
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1).split('#')[0] : '';
  const view = new URLSearchParams(query).get('view') || 'dashboard';
  return `/${PREVIEW_ROUTES[view] || view}`;
}

/**
 * The types for one router navigation, from where the student is to where they are going (both full
 * URLs or paths). src/instrumentation-client.js adds them inside Next's navigation Transition, so every
 * navigation (dock, sidebar, More sheet, in-page links, router.push, the back button) moves by the same rule.
 */
export function navigationTypesFor(fromHref, toHref) {
  return transitionTypesFor(logicalPath(fromHref), logicalPath(toHref));
}
