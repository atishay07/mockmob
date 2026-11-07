// node --test data/tests/web_r4_nav_1105.test.mjs
// Round 4, packet A3 + A4 + A5 (owner LK141 to LK143 and LK146, 5 Nov 2026, about 11:40 pm; docs/design-decisions/web-r4-nav.md):
//   A3  a phone's dock You opens the You page and the top bar's person opens the account sheet ("it is actually doing the opposite of
//       what I think a UI should do"); the desktop rail refined, nothing cut off at 1366 x 768.
//   A4  Ask Mobi back as a first-class door ("completely gone from the UI ... one of our main features").
//   A5  Today's and Practice's main jobs one tap and in sight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const shell = read('src/app/(app)/AppLayoutClient.jsx');
const places = read('src/components/nav/YouPlaces.jsx');
const placesCss = read('src/components/nav/you-places.css');
const navCss = read('src/app/(app)/nav-places.css');
const pop = read('src/components/account/AccountPopover.jsx');
const popCss = read('src/components/account/account-popover.css');
const navSource = read('src/lib/arenaNavigation.js').replace("'@/../data/capabilities'", `'${new URL('../capabilities.js', import.meta.url).href}'`);
const { YOU_DOCK, youSheetGroups, arenaNavigation } = await import(`data:text/javascript,${encodeURIComponent(navSource)}`);

test('A3: the dock’s You is a link to the You page; nothing in the shell opens a You sheet', () => {
  assert.equal(YOU_DOCK.href, '/profile');
  assert.equal(YOU_DOCK.dock, 'you');
  assert.match(shell, /<Link href=\{hrefOf\(YOU_DOCK\)\} data-tour="nav-more"/);
  assert.doesNotMatch(shell, /mobileMenuOpen|toggleMenu|id="arena-sheet"|arena-sheet-scrim/);
  // The lens rests under You on the You page itself, as on any place's own page.
  assert.match(read('src/app/(app)/arena.css'), /\.arena-bottomnav:has\(> :nth-child\(5\):is\(\[aria-current='page'\], \[aria-expanded='true'\]\)\) \{ --abn-i: 4; --abn-on: 1; \}/);
});

test('A3: the top bar’s person opens the account panel at every width, a sheet on a phone with the quick toggles', () => {
  assert.doesNotMatch(pop, /router\.push|useRouter/);
  for (const part of ['<AppearanceSwitch className="acct-pop__switch" />', '{COPY.rowAccount}', '{COPY.rowHelp}', '{TOUR_LABEL}', '<SignOutButton className="acct-pop__out">']) {
    assert.ok(pop.includes(part), part);
  }
  assert.match(popCss, /\.acct-pop\.acct-pop--sheet \{[^}]*max-height: calc\(100dvh - var\(--acct-top, 72px\) - 12px\); overflow-y: auto;/, 'a short phone scrolls inside the sheet');
  assert.match(popCss, /\.acct-pop-scrim \{ position: fixed; inset: 0; z-index: 46;/, 'the scrim covers the page and the dock (44)');
  assert.doesNotMatch(popCss, /#[0-9a-f]{3,6}\b|rgba?\(/i, 'tokens only');
  assert.match(popCss, /html\[data-motion='reduced'\] \.app-shell :is\(\.acct-pop--sheet, \.acct-pop-scrim\) \{ animation: none; \}/);
});

test('A3: the You page lists every page the old sheet did, and nothing is lost from the sidebar', () => {
  const ids = youSheetGroups(false, { mob: true }).flatMap((group) => group.items.map((item) => item.id));
  assert.deepEqual(ids, ['progress', 'analytics', 'admission-compass', 'wallet']);
  assert.match(places, /row\(\{ id: 'help', label: HELP_DOOR\.label, icon: 'help' \}\)/, 'Guide');
  assert.match(places, /onClick=\{onTour\}/, 'Show me around');
  assert.match(places, /className="you-places__ask"/, 'Ask Mobi');
  const rail = arenaNavigation(false, { mob: true, learn2: true }).flatMap((group) => group.items.map((item) => item.id));
  for (const id of ['today', 'dashboard', 'review', 'learn', 'explore', 'saved', 'mob', 'leaderboard', 'profile', 'progress', 'analytics', 'admission-compass', 'wallet', 'help']) assert.ok(rail.includes(id), id);
  assert.match(placesCss, /\.you-places__row \{[^}]*min-height: 48px/, '48 px rows');
  assert.doesNotMatch(placesCss, /#[0-9a-f]{3,6}\b|rgba?\(/i, 'tokens only');
});

test('A3: the rail: logo, Start and Mobi’s door stay put; the places scroll on their own; laptop heights fit 15 rows', () => {
  const aside = shell.slice(shell.indexOf('<aside className="arena-sidebar"'), shell.indexOf('</aside>'));
  const order = ['<Logo />', '<StartKey variant="sidebar"', 'className="arena-mobi-door"', 'className="arena-sidebar__places"', '{navGroups.map'].map((n) => aside.indexOf(n));
  assert.ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), `rail order ${order}`);
  assert.match(navCss, /\.app-shell \.arena-sidebar \{ overflow: hidden; \}/);
  assert.match(navCss, /\.app-shell \.arena-sidebar__places \{[^}]*flex: 1 1 auto; min-height: 0;[^}]*overflow-y: auto;/);
  assert.match(navCss, /@media \(min-width: 1024px\) and \(max-height: 819px\) and \(hover: hover\) and \(pointer: fine\) \{\s*\.app-shell \.arena-sidebar \.arena-sidebar__places \.arena-nav-group \.arena-nav-link \{ min-height: 34px; \}/);
});

test('A4: Ask Mobi is a door on every screen: the rail under Start, the top bar below 1024 px, the You page, Today, and his face on the asks', () => {
  assert.match(shell, /<Link href=\{mentorHref\} className="arena-askkey" data-tour="nav-mentor-top" aria-current=\{isActive\('mentor'\) \? 'page' : undefined\}>/);
  // R8 TOOLS-07 (LK143): his key says what it does on a phone too: "Ask Mobi" from 380 px, "Ask" on a 360 px phone.
  assert.match(shell, /<span className="arena-askkey__label">Ask<span className="arena-askkey__name"> Mobi<\/span><\/span>/, 'his name is said in words');
  assert.match(navCss, /@media \(max-width: 639px\) \{[\s\S]{0,200}\.arena-askkey__label \{ position: static;/, 'visible on a phone');
  assert.match(navCss, /@media \(min-width: 640px\) \{[\s\S]{0,200}\.arena-askkey__label \{ position: static;/);
  assert.match(navCss, /@media \(max-width: 349px\) \{ \.app-shell \.arena-askkey \{ display: none; \} \}/, 'a 320 px phone keeps its bar whole');
  const today = read('src/app/(app)/today/page.jsx');
  assert.ok(today.indexOf('<TodayMove') < today.indexOf('<TodayAsk />') && today.indexOf('<TodayAsk />') < today.indexOf('<TodayWeak'), 'right under the lead card');
  const ask = read('src/components/today/TodayAsk.jsx');
  assert.match(ask, /const href = useMentorHref\(\);/);
  assert.match(ask, /Answers from your record are free; a written reply is 1 credit\./, 'the cost before the press');
  assert.match(read('src/components/ai/AskMobiLink.jsx'), /\{variant === 'text' \? <Image className="ame__face"/);
  assert.doesNotMatch(read('src/components/today/today.css').match(/\.app-shell \.tmask \{[^}]*\}/)[0], /volt/, 'no volt on the row (D7)');
});

test('A5: the main jobs in sight: Practice’s key rides the window inside its card on a laptop; Today’s key clears the dock on a short phone', () => {
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /<div className="pr-ticket__go-row">\{startKey\('pr-summary__cta'\)\}<\/div>\s*<\/aside>/);
  const css = read('src/app/(app)/dashboard/practice.css');
  assert.match(css, /\.app-shell \.pr \.pr-ticket__go-row \{\s*position: sticky; bottom: 0; z-index: 1;/);
  assert.match(css, /\.app-shell \.pr \.pr-ticket__go-row \{ display: contents; \}/, 'phones keep their own bar');
  assert.match(read('src/components/today/today.css'), /@media \(max-width: 639px\) and \(max-height: 799px\) \{[\s\S]{0,900}\.app-shell \.tm__num \{ font-size: 60px; \}[\s\S]{0,500}\.app-shell \.tm__key \{ margin-top: 14px; min-height: 52px; \}/);
});
