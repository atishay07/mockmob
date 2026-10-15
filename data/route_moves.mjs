// Where every current page goes (web IA plan 2.4, 15 Oct 2026), kept as data.
//
// Policy: keep every URL. The only new paths are /practice, /you and /ask (plus /start, which opens
// the Start sheet). Every redirect is a 308 that keeps the query string. IA9 builds next.config.mjs
// from nextRedirects() and nextRewrites() below (Next.js passes request query values through to a
// redirect destination: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md).
// Server API hrefs never change. The app's ActionRouter (wt-phase2 action_router.dart) maps the
// kept paths, so old app builds and notification links keep working.
//
// action:
//   keep         the URL stays; it may move in the navigation or change its page title
//   restructure  the URL stays; the page is rebuilt
//   unchanged    out of scope (or owned elsewhere), not edited by this plan
//   new          a new page
//   rewrite      served by another page; the address bar keeps the new path
//   redirect     a 308 to `to`, query kept. `pageLevel` redirects live in the page only (not in
//                next.config.mjs) because the page decides at request time
// place: today | practice | review | you | start | focus | public | footer | none

const move = (from, place, action, extra = {}) => Object.freeze({ from, place, action, ...extra });

export const ROUTE_MOVES = Object.freeze([
  move('/', 'public', 'restructure', { packet: 'IA4', signedIn: 'start-on', note: 'Signed out: the landing. Signed in: the Start on target (Today by default, N1), via src/proxy.js in IA9.' }),
  move('/today', 'today', 'restructure', { packet: 'IA2', note: 'Landing after sign-in: postSignInPath becomes /today (IA3).' }),
  move('/dashboard', 'practice', 'keep', { packet: 'IA5', note: 'Practice tab. The prefill ?subject&mode&count&chapter stays exactly as it is. "Feed the bank" removed.' }),
  move('/practice', 'practice', 'rewrite', { to: '/dashboard', packet: 'IA9', note: 'New path; the app adds an App Link later.' }),
  move('/start', 'start', 'rewrite', { to: '/today', packet: 'IA9', opensSheet: true, note: '/start?row=resume|quick|repair opens the Start sheet, mirroring the app /start. The shell reads the row.' }),
  move('/test', 'focus', 'unchanged', { note: 'Full-screen runner, NTA untouched. Only links into it change.' }),
  move('/result/[id]', 'review', 'unchanged', { owner: 'Repair v3', note: 'Opens over Review. Owned by the Repair v3 workflow (plan 5.1).' }),
  move('/review', 'review', 'restructure', { packet: 'IA6', note: 'Becomes the hub (plan 5.3).' }),
  move('/analytics', 'review', 'keep', { packet: 'IA6', title: 'Your record', note: 'Heading and breadcrumb only; visuals unchanged.' }),
  move('/saved', 'review', 'keep', { packet: 'IA6', title: 'Saved questions' }),
  move('/mentor', 'review', 'restructure', { packet: 'IA6', title: 'Ask Mobi', note: 'Ask only. The Next step and Your record tabs and the terminal styling go.' }),
  move('/ask', 'review', 'rewrite', { to: '/mentor?tab=ask', packet: 'IA9' }),
  move('/recovery', 'review', 'redirect', { to: '/review', status: 308, packet: 'IA9', pageLevel: true, note: 'The page redirects while the old recovery episodes are unreleased (recoveryReleased()); the journey stays behind that gate.' }),
  move('/explore', 'practice', 'keep', { packet: 'IA5', title: 'Question stream' }),
  move('/learn', 'practice', 'keep', { packet: 'IA5', title: 'Concepts', studyOnly: true, note: 'Out of the top nav; also linked from a mistake.' }),
  move('/learn/[id]', 'practice', 'keep', { packet: 'IA5', studyOnly: true }),
  move('/learn/summary', 'practice', 'keep', { packet: 'IA5', studyOnly: true }),
  move('/study/[id]', 'practice', 'unchanged', { studyOnly: true, note: 'study/** untouched.' }),
  move('/progress', 'you', 'redirect', { to: '/you#progress', status: 308, packet: 'IA9', note: 'Its repair list moves to Review > Repair record.' }),
  move('/profile', 'you', 'keep', { packet: 'IA7', title: 'Account', note: 'Settings page. Every setting stays reachable.' }),
  move('/you', 'you', 'new', { packet: 'IA7', title: 'You' }),
  move('/admission-compass', 'you', 'keep', { packet: 'IA7', title: 'Cutoff calculator', note: 'Rename on the page, cut the preamble, keep the Pro projection.' }),
  move('/leaderboard', 'you', 'keep', { packet: 'IA7', title: 'Leaderboard', webOnly: true, note: 'Synthetic practice rival rows leave the top.' }),
  move('/rival', 'none', 'keep', { note: 'Unlinked. Retired only on the owner’s word (N5).' }),
  move('/upload', 'you', 'keep', { packet: 'IA7', title: 'Contribute questions', webOnly: true, note: 'Two tabs: Submit, Your submissions.' }),
  move('/my-uploads', 'you', 'redirect', { to: '/upload?tab=mine', status: 308, packet: 'IA9' }),
  move('/moderation', 'you', 'unchanged', { moderatorOnly: true }),
  move('/onboarding', 'you', 'restructure', { packet: 'IA3', note: 'First run, 2 steps. ?edit=true is You > Subjects.' }),
  move('/login', 'public', 'keep', { packet: 'IA3', note: '?next kept.' }),
  move('/signup', 'public', 'keep', { packet: 'IA3', note: '?next kept.' }),
  move('/pricing', 'public', 'keep', { packet: 'IA8', note: 'Rewritten in numbers (plan 4.4).' }),
  move('/pricing/prepos', 'public', 'redirect', { to: '/pricing#ai-credits', status: 308, packet: 'IA9', seo: true }),
  move('/features', 'public', 'redirect', { to: '/#how-it-works', status: 308, packet: 'IA9', seo: true, note: 'Drop it from publicRoutes and the sitemap (N9).' }),
  move('/coming-soon', 'public', 'redirect', { to: '/', status: 308, packet: 'IA9', seo: true }),
  move('/about', 'footer', 'keep', { packet: 'IA8' }),
  move('/contact', 'footer', 'keep', { packet: 'IA8' }),
  move('/cuet-2027', 'public', 'keep', { packet: 'IA8', title: 'CUET 2027 guide' }),
  move('/cuet-cutoff-calculator', 'public', 'keep', { packet: 'IA8', title: 'Cutoff calculator', note: 'Keeps the "CUET cutoff calculator" title keywords.' }),
  move('/cuet-subject-combination', 'public', 'keep', { packet: 'IA8', title: 'Combo planner' }),
  move('/cuet-mock-test-free', 'footer', 'keep', { packet: 'IA8', note: 'The live 5-question sample goes at the top.' }),
  move('/cuet-practice-tests-online', 'footer', 'keep', { packet: 'IA8' }),
  move('/cuet-previous-year-questions', 'footer', 'keep', { packet: 'IA8', note: 'Honest H1 and metadata; leaves the header.' }),
  move('/cuet/[subject]', 'footer', 'keep', { packet: 'IA8' }),
  move('/privacy', 'footer', 'keep', {}),
  move('/terms', 'footer', 'keep', {}),
  move('/refunds', 'footer', 'keep', {}),
  move('/account-deletion', 'footer', 'keep', {}),
]);

// Out of scope, apart from new preview views (plan 2.4, last row).
export const OUT_OF_SCOPE_PREFIXES = Object.freeze(['/create-', '/verify-payment', '/webhook', '/auth/', '/admin', '/creator', '/preview', '/api/']);

const byFrom = new Map(ROUTE_MOVES.map((m) => [m.from, m]));

/** The move for an exact `from` path, or null. */
export function routeMove(from) {
  return byFrom.get(from) || null;
}

/** Does a concrete path match a route pattern such as /result/[id] or /cuet/[subject]? */
export function matchesRoute(pattern, path) {
  const clean = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (pattern === clean) return true;
  const a = pattern.split('/');
  const b = clean.split('/');
  return a.length === b.length && a.every((seg, i) => (/^\[.+\]$/.test(seg) ? Boolean(b[i]) : seg === b[i]));
}

/** The move for a concrete path (exact first, then patterns), or null. */
export function moveForPath(path) {
  const clean = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return byFrom.get(clean) || ROUTE_MOVES.find((m) => m.from.includes('[') && matchesRoute(m.from, clean)) || null;
}

/** next.config.mjs redirects(): every 308 except the page-level ones, query kept by Next itself. */
export function nextRedirects({ includePageLevel = false } = {}) {
  return ROUTE_MOVES
    .filter((m) => m.action === 'redirect' && (includePageLevel || !m.pageLevel))
    .map((m) => ({ source: m.from, destination: m.to, permanent: true }));
}

/** next.config.mjs rewrites(). */
export function nextRewrites() {
  return ROUTE_MOVES.filter((m) => m.action === 'rewrite').map((m) => ({ source: m.from, destination: m.to }));
}

/** The place a path belongs to in the new structure, or null when the plan has no entry. */
export function placeForPath(path) {
  return moveForPath(path)?.place || null;
}
