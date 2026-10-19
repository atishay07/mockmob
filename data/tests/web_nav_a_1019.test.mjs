// WEB-NAV-1019 option A (owner G24 and D114, built 19 Oct 2026): the website's navigation is the app's five places. Today, Practice
// (with Your papers, Learn, Explore and Saved), Start (an action: the centre key on a phone), Mob (with Your standing) and You
// (with Progress, Marks trend, Colleges, Wallet, Guide and Show me around). Ask Mobi is Mobi's own door at the sidebar's foot,
// above Night and Day. Every page keeps its own link and route (R3: nothing is hidden), so these checks pin the map, how many
// taps each page is from a phone, the phone's row of tabs and its sideways cue (G27), and the copy. Plain Node; the measured
// numbers (the rail, the sheet, the dock, the tab row) are in dock_alignment.test.mjs (DOCK_BASE_URL) and tmp/c1-captures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tourSteps, TOUR_STEPS_ALL } from '../../src/lib/appTour.mjs';
import {
  NUDGE_BACK_MS, NUDGE_DELAY_MS, NUDGE_KEY, NUDGE_OUT_MS, NUDGE_PX, PEEK_HI, PEEK_LO, TAB_PAD, TAB_PAD_MAX, TAB_PAD_MIN,
  cutShare, peekPadding, scrollToShow,
} from '../../src/components/nav/placeTabsPeek.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
// arenaNavigation.js imports through the app's '@/' alias, which plain Node does not know: point that one specifier at the real file.
const navSource = read('src/lib/arenaNavigation.js').replace("'@/../data/capabilities'", `'${new URL('../capabilities.js', import.meta.url).href}'`);
const nav = await import(`data:text/javascript,${encodeURIComponent(navSource)}`);
const { arenaNavigation, mobileNavigation, youSheetGroups, placeTabs, dockPlaceOf, ASK_MOBI_NAV, PRACTICE_PAGES, MOB_PAGES, MOBILE_STUDY_NAV } = nav;
const layout = read('src/app/(app)/AppLayoutClient.jsx');
const places = stripComments(read('src/app/(app)/nav-places.css'));
const arena = stripComments(read('src/app/(app)/arena.css'));
const ids = (groups) => groups.flatMap((group) => group.items.map((item) => item.id));

// Every page the release 10 navigation reached, with its route. None of them changed (R3: nothing hidden; no URL changes).
const OLD_PAGES = Object.freeze({
  today: '/today', dashboard: '/dashboard', review: '/review', learn: '/learn', explore: '/explore', saved: '/saved', mob: '/mob',
  leaderboard: '/leaderboard', progress: '/progress', analytics: '/analytics', 'admission-compass': '/admission-compass',
  mentor: '/mentor', profile: '/profile', wallet: '/wallet', help: '/help',
});

test('the sidebar draws four places, each with its pages under it: no group headers, no Study or Planning', () => {
  const groups = arenaNavigation(false, { mob: true });
  assert.deepEqual(groups.map((group) => group.id), ['today', 'practice', 'mob', 'you']);
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.label)), [
    ['Today'],
    ['Practice', 'Your papers', 'Learn', 'Explore', 'Saved'],
    ['Mob', 'Your standing'],
    ['You', 'Progress', 'Marks trend', 'Colleges', 'Wallet', 'Guide'],
  ]);
  // The first item of a place is the place (a bold row); the others are indented pages (arena-nav-link--sub).
  for (const group of groups) {
    assert.equal(group.place, true, group.id);
    assert.equal(group.items[0].place, true);
    assert.ok(group.items.slice(1).every((item) => item.sub === true && !item.place), `${group.id}: the rest are pages inside it`);
  }
  assert.equal(groups[2].items[0].hint, 'with friends', 'the coined word Mob is explained beside it');
  assert.equal(groups[3].items[0].label, 'You');
  assert.equal(groups[3].items.find((item) => item.id === 'wallet').ruleAbove, true, 'a hairline between the plan pages and the account pages');
  // No header is drawn for a place; only the Moderation and Contribute groups, which only some students see, keep one.
  assert.match(layout, /\{group\.place \? null : <p className="arena-nav-label">\{group\.label\}<\/p>\}/);
  assert.doesNotMatch(navSource.replace(/\/\/.*$/gm, ''), /'Study'|'Planning'|'Account'|'Together'/, 'the old group names are gone');
});

test('"Practice", not "Practise": the place and its page are one word, as in the app', () => {
  assert.equal(PRACTICE_PAGES[0].label, 'Practice');
  assert.equal(PRACTICE_PAGES[0].href, '/dashboard');
  assert.doesNotMatch(read('src/lib/arenaNavigation.js') + layout + read('src/components/nav/PlaceTabs.jsx'), /Practise\b/);
});

test('every page the old navigation reached still has its own link and route (R3), on desktop and on a phone', () => {
  const withMob = arenaNavigation(false, { mob: true });
  const sidebarHrefs = new Map(withMob.flatMap((group) => group.items.map((item) => [item.id, item.href])));
  sidebarHrefs.set(ASK_MOBI_NAV.id, ASK_MOBI_NAV.href);
  for (const [id, href] of Object.entries(OLD_PAGES)) assert.equal(sidebarHrefs.get(id), href, `${id} keeps ${href} in the sidebar`);
  // Show me around is a button, not a page: under You after the Guide row, and the head of the You sheet.
  assert.match(layout, /group\.id === 'you' && !isTestRoute \? \([\s\S]{0,200}onClick=\{startTour\}/);
  // The Mob off: its place is not drawn, and Your standing keeps its link under You.
  const noMob = arenaNavigation(false);
  assert.ok(!ids(noMob).includes('mob'));
  assert.equal(noMob.find((group) => group.id === 'you').items.find((item) => item.id === 'leaderboard').href, '/leaderboard');
  // Routes are not renamed: the whole change is where a link sits and what it is called.
  assert.equal(PRACTICE_PAGES.find((tab) => tab.id === 'review').href, '/review', 'Your papers is still /review');
});

test('on a phone every page is one or two taps away, and the Mob is one (G17)', () => {
  const taps = (id, opts = { mob: true }) => {
    if (mobileNavigation(opts).some((tab) => tab.id === id)) return 1;
    for (const path of ['/dashboard', '/mob']) if (placeTabs(path, { ...opts, study: true })?.tabs.some((tab) => tab.id === id)) return 2;
    const sheet = [...youSheetGroups(false, opts).flatMap((group) => group.items.map((item) => item.id)), 'profile', 'help', ASK_MOBI_NAV.id];
    return sheet.includes(id) ? 2 : Infinity;
  };
  for (const id of Object.keys(OLD_PAGES)) assert.ok(taps(id) <= 2, `${id} is ${taps(id)} taps away`);
  assert.equal(taps('mob'), 1, 'the Mob is on the bar');
  for (const id of ['today', 'dashboard']) assert.equal(taps(id), 1, id);
  // Your standing is a tab on the Mob's page, or a row of the You sheet while the Mob is off.
  assert.equal(taps('leaderboard'), 2);
  assert.equal(taps('leaderboard', { mob: false }), 2);
  assert.equal(taps('mob', { mob: false }), Infinity, 'the Mob is not drawn while it is off');
  // The shell draws what these lists hold: the bar, then the You sheet.
  assert.match(layout, /const dockTabs = mobileNavigation\(\{ mob: mobOn \}\)/);
  assert.match(layout, /const sheetGroups = youSheetGroups\(isModerator, \{ mob: mobOn, contribute: contributeOn \}\)/);
});

test('the phone bar is five slots: Today, Practice, Start in the centre, Mob, You; the Review count moved to Practice', () => {
  assert.deepEqual(MOBILE_STUDY_NAV.map((tab) => tab.label), ['Today', 'Practice', 'Mob']);
  assert.deepEqual(mobileNavigation({ mob: false }).map((tab) => tab.label), ['Today', 'Practice'], 'with the Mob off the capsule holds four');
  const bar = layout.slice(layout.indexOf('<div className="arena-dock">'), layout.indexOf('<StartSheetHost'));
  assert.match(bar, /data-slots=\{dockTabs\.length \+ 2\}/);
  assert.match(bar, /\{index === 2 \? <StartKey variant="bar"/, 'Start is the third child');
  assert.match(bar, /<AppIcon name="account" size=\{24\} \/><span>You<\/span>/, 'You opens the sheet');
  // The Revise count: on Practice in the bar and on Your papers in the sidebar and in Practice's row of tabs (never on the dock's Review: there is none).
  assert.match(bar, /tab\.id === 'dashboard' && reviseBadge \? <i className="arena-badge"/);
  assert.match(layout, /tab\.id === 'review' && reviseBadge \? <i className="arena-nav-link__count"/);
  assert.match(read('src/components/nav/PlaceTabs.jsx'), /const badge = tab\.id === 'review' && count \? count : 0;/);
  // Release 11 (verifier M1): drawn as "8 due" and heard as "Your papers, 8 due in Revise today" (web_fixa_1019.test.mjs).
  assert.match(layout, /dueLabel\(tab\.label, reviseBadge\)/, 'a screen reader hears the count in words');
  // The bar marks the place a student is in: a page inside Practice (Your papers, Learn, Explore, Saved) marks Practice.
  assert.equal(dockPlaceOf('/review'), 'practice');
  assert.equal(dockPlaceOf('/study/abc'), 'practice');
  assert.equal(dockPlaceOf('/leaderboard', { mob: true }), 'mob');
  assert.equal(dockPlaceOf('/leaderboard', { mob: false }), 'you');
  for (const path of ['/profile', '/progress', '/analytics', '/admission-compass', '/wallet', '/help', '/mentor']) assert.equal(dockPlaceOf(path), 'you', path);
  assert.equal(dockPlaceOf('/result/9'), null);
  assert.equal(dockPlaceOf('/today'), 'today');
});

test('the You sheet: the account card, Ask Mobi with his face, Your progress, Your plan, then Night and Day last', () => {
  assert.deepEqual(youSheetGroups(false, { mob: true }).map((group) => [group.label, group.items.map((item) => item.label)]), [
    ['Your progress', ['Progress', 'Marks trend']],
    ['Your plan', ['Colleges', 'Wallet']],
  ]);
  // With the Mob off, Your standing is among the progress pages, so it keeps a link.
  assert.deepEqual(youSheetGroups(false, { mob: false })[0].items.map((item) => item.label), ['Progress', 'Marks trend', 'Your standing']);
  const sheet = layout.slice(layout.indexOf('id="arena-sheet"'), layout.indexOf('<div className="arena-dock">'));
  const order = ['arena-sheet__account', 'arena-sheet__lead--ask', '{sheetGroups.map', '<AppearanceSwitch />'].map((needle) => sheet.indexOf(needle));
  assert.ok(order.every((at) => at > 0) && order.every((at, i) => i === 0 || at > order[i - 1]), `sheet order ${order}`);
  assert.match(sheet, /<Image className="arena-sheet__mobi" src=\{MOBI_FACE\.src\}/, 'Mobi’s face replaces the sparkle');
  assert.match(sheet, /aria-label="You: your account, progress and plan"/);
  assert.match(layout, /const MOBI_FACE = mascot\.greeting;/);
  // The sheet's own focus starts on its first link or button (the account row), not the first nav row.
  assert.match(layout, /sheet\?\.querySelector\('a\[href\], button'\)\?\.focus/);
});

test('copy, read aloud (R6): full sentences, no telegram style', () => {
  // Release 11 (walk item 12): one line for the one door, on the sidebar and on the phone's sheet (web_fixa_1019.test.mjs).
  assert.match(layout, /const ASK_MOBI_NOTE = 'He explains any answer\.';/);
  assert.match(layout, /<span className="arena-sheet__lead-name">Ask Mobi<\/span>/);
  assert.equal(MOB_PAGES[0].label, 'Your Mob');
  assert.deepEqual(MOB_PAGES.map((tab) => tab.label), ['Your Mob', 'Your standing']);
  for (const line of ['He explains any answer.']) {
    assert.doesNotMatch(line, /[!—·]|\p{Extended_Pictographic}/u, line);
    assert.match(line, /^[A-Z].*\.$/, `${line} is a sentence`);
  }
});

test('Mobi’s door sits at the sidebar’s foot above Night and Day, is the ordinary /mentor link and opens in place', () => {
  const aside = layout.slice(layout.indexOf('<aside className="arena-sidebar"'), layout.indexOf('</aside>'));
  assert.ok(aside.indexOf('className="arena-mobi-door"') > aside.indexOf('{navGroups.map'), 'after the places');
  assert.ok(aside.indexOf('className="arena-mobi-door"') < aside.indexOf('className="arena-sidebar__foot"'), 'above the appearance row (D6)');
  assert.match(aside, /<Link href=\{previewLinks\?\.mentor \|\| '\/mentor'\} className="arena-mobi-door" data-tour="nav-mentor"/);
  assert.match(aside, /<Image className="arena-mobi-door__face" src=\{MOBI_FACE\.src\}/);
  assert.match(places, /\.arena-mobi-door \{ display: none; \}/, 'drawn from 1024 px only; a phone has the sheet row');
  assert.equal(ASK_MOBI_NAV.href, '/mentor');
  assert.match(read('src/components/ai/AskMobiHost.jsx'), /link\.matches\('\[data-tour="nav-mentor"\]'\)/, 'the host still opens the panel in place from a plain click');
});

test('Practice and the Mob get a row of tabs on a phone: Practice, Your papers, Learn, Explore, Saved; Your Mob, Your standing', () => {
  for (const path of ['/dashboard', '/review', '/learn', '/explore', '/saved']) {
    const row = placeTabs(path, { mob: true, study: true });
    assert.equal(row.id, 'practice', path);
    assert.deepEqual(row.tabs.map((tab) => tab.label), ['Practice', 'Your papers', 'Learn', 'Explore', 'Saved']);
  }
  assert.deepEqual(placeTabs('/dashboard', { study: false }).tabs.map((tab) => tab.label), ['Practice', 'Your papers', 'Explore', 'Saved'], 'Learn only while the lessons are on');
  for (const path of ['/mob', '/leaderboard']) assert.deepEqual(placeTabs(path, { mob: true }).tabs.map((tab) => tab.label), ['Your Mob', 'Your standing']);
  assert.equal(placeTabs('/mob', { mob: false }), null, 'no Mob row while the Mob is off');
  // Only on the place's own pages: never on Today, You's pages, a result, a rule book, a lesson run or the timed runner.
  for (const path of ['/today', '/profile', '/progress', '/result/9', '/review/rules', '/review/revise', '/study/abc', '/test/abc']) assert.equal(placeTabs(path, { mob: true, study: true }), null, path);
  // The shell draws it once, above the page, keyed by place so moving between its tabs never remounts the row.
  assert.match(layout, /\{tabRow \? <PlaceTabs key=\{tabRow\.id\} group=\{tabRow\} hrefOf=\{hrefOf\} isActive=\{isActive\} count=\{reviseBadge \|\| 0\} countLabel=\{countLabel\} \/> : null\}/);
  assert.match(layout, /const tabRow = isTestRoute \? null : placeTabs\(activePath/);
  // Each tab is a link to its own route (a page, not a tablist), and the current one says so.
  const row = read('src/components/nav/PlaceTabs.jsx');
  assert.match(row, /<Link key=\{tab\.id\} href=\{hrefOf\(tab\)\} className="arena-tab" aria-current=\{current \? 'page' : undefined\}/);
  assert.doesNotMatch(row, /role="tab"/);
});

test('the row of tabs: 44 px tall, only below 1024 px, edge fades and a chevron while tabs wait, the current tab carries the volt bar', () => {
  assert.match(places, /\.app-shell \.arena-tabs \{ display: none; \}/, 'from 1024 px the sidebar lists every page');
  const phone = places.slice(places.indexOf('@media (max-width: 1023px) {\n  .app-shell .arena-tabs {'));
  assert.match(phone, /\.arena-tab \{[^}]*min-height: 44px/);
  assert.match(phone, /\.arena-tabs__row \{[^}]*overflow-x: auto/);
  assert.match(phone, /\.arena-tab\[aria-current='page'\]::after \{[^}]*background: var\(--a-select\)/, 'the sidebar’s volt bar');
  assert.match(phone, /\.arena-tabs\[data-overflow\]:not\(\[data-at-end\]\)::after \{ opacity: 1; \}/, 'the right fade while tabs wait past the edge');
  assert.match(phone, /\.arena-tabs\[data-overflow\]:not\(\[data-at-end\]\) \.arena-tabs__hint \{ opacity: 1; pointer-events: auto; \}/, 'the chevron');
  assert.match(phone, /\.arena-tabs__hint \{[^}]*width: 44px/, 'its target is 44 px');
  // No volt fill: one volt key per viewport (W-075); the bar and the key are the only lime.
  assert.doesNotMatch(phone, /var\(--volt\)|#d2f000/i);
  // Reduced motion: the transitions stop (the nudge is not played at all, below).
  assert.match(places, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.arena-tabs__hint/);
});

test('the sideways cue (G27): the cut tab, a 24 px nudge once per device, the edge fades and a chevron; reduced motion: no nudge', () => {
  assert.equal(NUDGE_PX, 24);
  assert.ok(NUDGE_OUT_MS + NUDGE_BACK_MS < 1000, 'one short gesture');
  assert.ok(NUDGE_DELAY_MS >= 420, 'it waits for the page’s own entrance (about 420 ms)');
  assert.equal(NUDGE_KEY, 'mm:cue:place-tabs:v1');
  const row = read('src/components/nav/PlaceTabs.jsx');
  assert.match(row, /if \(!el \|\| seen\(\) \|\| reducedMotion\(\)\) return undefined;/, 'seen before, or reduced motion: no nudge');
  assert.match(row, /markSeen\(\);[\s\S]{0,400}node\.animate\(/, 'it is marked seen as it plays, so it is once');
  assert.match(row, /document\.documentElement\.dataset\.motion === 'reduced' \|\| window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  for (const event of ['pointerdown', 'wheel', 'touchstart', 'scroll']) assert.match(row, new RegExp(`addEventListener\\('${event}', stop`), `a ${event} cancels it`);
  assert.match(row, /composite: 'add'/, 'it adds to the row’s own transform and never fights a scroll');
});

test('the peek: the cut tab shows 30 to 70% of itself, steered with the tabs’ side padding (pure)', () => {
  // Five tabs at 390 wide: the row is 390 - 16 = 374 from the first tab to the edge.
  const contents = [52, 78, 41, 56, 42]; // each tab's width without its side padding
  const fit = peekPadding({ contents, gap: 8, avail: 374 });
  assert.ok(fit && fit.pad >= TAB_PAD_MIN && fit.pad <= TAB_PAD_MAX, `pad ${fit?.pad}`);
  assert.ok(fit.share >= PEEK_LO && fit.share <= PEEK_HI, `share ${fit.share}`);
  assert.ok(cutShare({ contents, pad: fit.pad, gap: 8, avail: 374 }) > 0, 'a tab is cut at the edge');
  // A row that fits needs no cue; a single tab or no width gives nothing to steer.
  assert.equal(peekPadding({ contents: [40, 40], gap: 8, avail: 374 }), null);
  assert.equal(peekPadding({ contents: [60], gap: 8, avail: 100 }), null);
  assert.equal(peekPadding({ contents, gap: 8, avail: 0 }), null);
  assert.equal(TAB_PAD, 16);
  // The current tab is in view on arrival: the row starts at 0 unless the tab is past the edge, then centres it.
  assert.equal(scrollToShow({ left: 16, width: 90, view: 374, scrollWidth: 500 }), 0);
  const saved = scrollToShow({ left: 400, width: 70, view: 374, scrollWidth: 500 });
  assert.ok(saved > 0 && saved <= 500 - 374, `Saved is brought into view (${saved})`);
});

test('the sidebar compaction follows the new rail: 38 px rows only where 44 would scroll, from the measured heights', () => {
  // Measured at 1440 wide: Learn and the Mob together 980 px at 44 (890 at 38), one of the two 934 (850), neither 880 (802).
  assert.match(arena, /@media \(min-width: 1024px\) and \(max-height: 979px\) and \(hover: hover\) and \(pointer: fine\) \{\s*\.app-shell \.arena-sidebar:has\(\[data-tour="nav-learn"\]\):has\(\[data-tour="nav-mob"\]\) \.arena-nav-link \{ min-height: 38px; \}/);
  assert.match(arena, /@media \(min-width: 1024px\) and \(max-height: 933px\)[^{]*\{\s*\.app-shell \.arena-sidebar:is\(:has\(\[data-tour="nav-learn"\]\), :has\(\[data-tour="nav-mob"\]\)\) \.arena-nav-link \{ min-height: 38px; \}/);
  assert.match(arena, /@media \(min-width: 1024px\) and \(max-height: 879px\)[^{]*\{\s*\.app-shell \.arena-sidebar \.arena-nav-link \{ min-height: 38px; \}/);
  // Touch screens keep 44 (W-079); the release 10 thresholds (869 and 915) are gone.
  assert.doesNotMatch(arena, /max-height: 869px|max-height: 915px/);
});

test('the You sheet is 24 px shorter (531 px at 390 wide), so it needs no scroll from a phone 692 px tall', () => {
  assert.match(places, /html \.app-shell \.arena-sheet > \.arena-sheet__lead, html \.app-shell \.arena-sheet > \.arena-appearance \{ margin-bottom: 0; \}/);
});

test('the guide tour follows the new map: every stop has a target on the bar or in the sidebar, and says where to look on a phone', () => {
  const all = tourSteps({ mob: true, study: true });
  assert.equal(all.length, TOUR_STEPS_ALL.length);
  // The targets a phone has: the bar's places and the You button (data-tour nav-more); the sidebar adds each page's own row.
  const phone = new Set(['nav-today', 'nav-dashboard', 'nav-mob', 'nav-more', 'nav-start']);
  const sidebar = new Set(['nav-today', 'nav-dashboard', 'nav-review', 'nav-learn', 'nav-explore', 'nav-saved', 'nav-mob', 'nav-leaderboard', 'nav-profile', 'nav-progress', 'nav-analytics', 'nav-admission-compass', 'nav-wallet', 'nav-help', 'nav-mentor']);
  for (const step of all) {
    const targets = [].concat(step.target);
    assert.ok(targets.some((target) => sidebar.has(target)), `${step.title}: a sidebar target`);
    assert.ok(targets.some((target) => phone.has(target)), `${step.title}: a phone target (${targets})`);
    if (targets.length > 1) assert.ok(step.bodies && Object.keys(step.bodies).every((key) => phone.has(key)), `${step.title}: its phone wording is for a target the phone has`);
  }
  // Nothing says "More" any more: the phone's last place is You.
  assert.doesNotMatch(JSON.stringify(TOUR_STEPS_ALL), /under More|first place under More/);
  assert.ok(all.some((step) => step.title === 'Your papers'), 'Review is named Your papers, as in the app (D106)');
  assert.ok(!all.some((step) => step.title === 'Review'));
});

test('Today keeps its colleges card, so Colleges leaving the bar costs no door (D104)', () => {
  assert.match(read('src/components/today/TodayColleges.jsx'), /href="\/admission-compass"/);
  assert.match(read('src/app/(app)/today/page.jsx'), /TodayColleges/);
});

test('R4: the rail still fills top to bottom on entry and the You sheet’s rows still rise one after another (each row’s --i)', () => {
  assert.match(layout, /const railIndex = new Map\(navGroups\.flatMap\(\(group\) => group\.items\)\.map\(\(tab, i\) => \[tab\.id, i\]\)\);/);
  assert.match(layout, /group\.items\.map\(\(tab\) => renderNavLink\(tab, undefined, railIndex\.get\(tab\.id\)\)\)/);
  assert.match(layout, /renderNavLink\(tab, \(\) => setMobileMenuOpen\(false\), sheetIndex\.get\(tab\.id\)\)/);
  assert.match(layout, /style=\{\{ '--i': index \}\}/, 'the row carries its index');
  assert.match(read('src/app/(app)/arena-support.css'), /\.arena-sidebar \.arena-nav-link[^{]*\{ animation: arena-nav-in 380ms var\(--a-ease\) both; animation-delay: calc\(60ms \+ var\(--i, 0\) \* 22ms\)/);
});

test('the current tab is placed in view again when the Revise count lands, and a student’s own scroll is kept', () => {
  const row = read('src/components/nav/PlaceTabs.jsx');
  assert.match(row, /\}, \[currentId, count, measure\]\);/, 'the count widens Your papers a moment after the page, so the row is placed again');
  assert.match(row, /if \(touched\.current && placedFor\.current === currentId\) \{ measure\(\); return; \}/, 'after a touch only a new current tab moves the row');
  // Placing the last tab (Saved) at the end of the row leaves it whole: view 374, the row 500 wide, the tab 70 wide at 430.
  const end = scrollToShow({ left: 430, width: 70, view: 374, scrollWidth: 500 });
  assert.equal(end, 500 - 374, 'clamped to the end of the row');
});
