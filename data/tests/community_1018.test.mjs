// COMMUNITY-1018 (owner answer of 18 Oct 2026): the contribution side is hidden behind CONTRIBUTE_ENABLED (default off), the
// sidebar loses its Community header, Your standing sits under Progress, Learn has its place (D20), and the SEO line is true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const navSource = read('src/lib/arenaNavigation.js').replace("'@/../data/capabilities'", `'${new URL('../capabilities.js', import.meta.url).href}'`);
const { arenaNavigation, STUDY_NAV } = await import(`data:text/javascript,${encodeURIComponent(navSource)}`);
const { standingRows, CONTRIBUTE_ROW_IDS, COMMUNITY_ROWS } = await import('../../src/components/profile/accountModel.mjs');
const ids = (groups) => groups.flatMap((g) => g.items.map((i) => i.id));
const labels = (groups) => groups.map((g) => g.label);

test('the flag defaults off and only the exact string true turns it on', async () => {
  const { contributeEnabled } = await import('../../src/lib/contribute.js');
  const saved = process.env.CONTRIBUTE_ENABLED;
  try {
    delete process.env.CONTRIBUTE_ENABLED;
    assert.equal(contributeEnabled(), false);
    process.env.CONTRIBUTE_ENABLED = '1';
    assert.equal(contributeEnabled(), false);
    process.env.CONTRIBUTE_ENABLED = 'true';
    assert.equal(contributeEnabled(), true);
  } finally { if (saved === undefined) delete process.env.CONTRIBUTE_ENABLED; else process.env.CONTRIBUTE_ENABLED = saved; }
});

test('the paused answer is a stable 403 with a code, never a 404', async () => {
  const { contributionsPausedResponse, CONTRIBUTIONS_PAUSED } = await import('../../src/lib/contribute.js');
  const response = contributionsPausedResponse();
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.code, 'contributions_paused');
  assert.equal(CONTRIBUTIONS_PAUSED.code, 'contributions_paused');
});

test('navigation: no Community header; Contribute and My uploads only with the flag; Your standing under Progress', () => {
  const off = arenaNavigation(false);
  assert.ok(!labels(off).includes('Community'), 'the Community header is gone');
  assert.ok(!ids(off).includes('upload') && !ids(off).includes('my-uploads'), 'hidden by default');
  const study = off.find((g) => g.label === 'Study').items;
  const at = study.findIndex((i) => i.id === 'progress');
  assert.equal(study[at + 1].id, 'leaderboard', 'Your standing follows Progress');
  assert.equal(study[at + 1].label, 'Your standing');
  assert.equal(study[at + 1].sub, true, 'drawn as a sub-link');
  const on = arenaNavigation(false, { contribute: true });
  assert.ok(!labels(on).includes('Community'));
  assert.ok(ids(on).includes('upload') && ids(on).includes('my-uploads'), 'the flag brings them back');
  // The Mob follows Your standing in Study when it is on, and is not drawn when off.
  assert.ok(!ids(off).includes('mob'));
  const mob = arenaNavigation(false, { mob: true }).find((g) => g.label === 'Study').items.map((i) => i.id);
  assert.ok(mob.indexOf('mob') > mob.indexOf('leaderboard'));
  // Nothing else was cut.
  for (const id of ['today', 'dashboard', 'learn', 'review', 'explore', 'saved', 'progress', 'leaderboard', 'analytics', 'admission-compass', 'mentor', 'profile', 'help']) assert.ok(ids(off).includes(id), id);
  assert.ok(STUDY_NAV.some((t) => t.id === 'learn'));
});

test('the Account group keeps Your standing and draws the contribution rows only with the flag', () => {
  assert.deepEqual(standingRows(false).map((r) => r.id), ['leaderboard']);
  assert.deepEqual(standingRows(true).map((r) => r.id), COMMUNITY_ROWS.map((r) => r.id));
  assert.deepEqual([...CONTRIBUTE_ROW_IDS], ['upload', 'my-uploads']);
  const links = read('src/components/profile/AccountLinks.jsx');
  assert.doesNotMatch(links, />Community</, 'the word community is not a heading');
  assert.match(links, /standingRows\(contribute\)/);
});

test('every contribution surface reads the flag; routes and data stay', () => {
  assert.match(read('src/components/questions/VoteControls.jsx'), /useContributeEnabled\(\)[\s\S]*if \(!enabled\) return null/, 'vote arrows');
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /\{contributeOn && <section className="pr-panel" aria-labelledby="pr-bank">/, 'the Practice Add a question panel');
  assert.match(practice, /if \(contributeOn\) optional\('\/api\/questions\/mine'/, 'no submissions read while off');
  assert.match(read('src/components/feed/DiscoveryFeed.jsx'), /contributeOn \? <p className="ex-footnote">Community votes/);
  // The hidden routes answer the calm paused page, never a 404 (COMMUNITY-1018 W3 and W4); the pages themselves stay.
  const paused = read('src/components/contribute/ContributionsPaused.jsx');
  assert.match(read('src/app/(app)/upload/page.js'), /contributeEnabled\(\) \? <UploadPageClient \/> : <ContributionsPaused \/>/);
  assert.match(read('src/app/(app)/my-uploads/page.js'), /contributeEnabled\(\) \? <MyUploadsPageClient \/> : <ContributionsPaused title="My uploads are paused with Contribute" \/>/);
  for (const path of ['src/app/(app)/upload/page.js', 'src/app/(app)/my-uploads/page.js']) assert.doesNotMatch(read(path), /notFound/, `${path} does not 404`);
  assert.match(paused, /title = 'Question contributions are paused'/);
  assert.match(paused, /Anything you sent before is kept\. Practice and Explore have the full question bank\./);
  assert.match(paused, /href="\/dashboard"[\s\S]*Back to Practice[\s\S]*href="\/explore"[\s\S]*Open Explore/, 'a way on, to two places that exist');
  // Genuinely unknown routes still get the app's own not-found page, which keeps the sidebar and dock.
  assert.ok(existsSync(new URL('../../src/app/(app)/not-found.js', import.meta.url)), 'the app has a not-found page for unknown routes');
  assert.match(read('src/app/api/questions/upload/route.js'), /if \(!contributeEnabled\(\)\) return contributionsPausedResponse\(\)/);
  assert.match(read('src/app/api/questions/mine/route.js'), /if \(!contributeEnabled\(\)\) return contributionsPausedResponse\(\)/);
  assert.match(read('src/app/(app)/layout.js'), /contributeEnabled=\{contributeEnabled\(\)\}/);
  // Nothing was deleted.
  for (const path of ['src/app/(app)/upload/UploadPageClient.jsx', 'src/app/(app)/my-uploads/MyUploadsPageClient.jsx', 'src/components/feed/UploadForm.jsx', 'src/app/api/questions/[id]/vote/route.js', 'src/app/api/questions/moderate/route.js']) assert.ok(existsSync(new URL(`../../${path}`, import.meta.url)), path);
});

test('the SEO page no longer claims community-driven questions (0 student questions exist)', () => {
  assert.doesNotMatch(read('src/lib/seoPages.js'), /community-driven/);
  assert.match(read('src/lib/seoPages.js'), /MockMob focuses on timed practice from one large CUET question bank/);
});

test('Learn has its own row at the top of the phone sheet and its own guide stop (D20)', () => {
  const layout = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(layout, /\{showStudy && \(\s*<Link href=\{previewLinks\?\.learn \|\| '\/learn'\} className="arena-sheet__lead"/);
  const tour = read('src/lib/appTour.mjs');
  assert.match(tour, /title: 'Learn', target: \['nav-learn', 'nav-more'\], study: true/);
  assert.match(tour, /\(!step\.study \|\| study\)/, 'the stop shows only while Learn exists');
  assert.match(layout, /tourSteps\(\{ mob: mobOn, study: studyOn \}\)/, 'the shell runs the tour from appTour.mjs');
});

test('no dead promise is left behind while the flag is off', () => {
  // Pricing no longer says an uploaded question adds credits; the Terms description no longer says community questions.
  assert.doesNotMatch(read('src/app/pricing/page.js'), /you upload that passes moderation/);
  assert.match(read('src/app/pricing/page.js'), /'New accounts start with 100 credits\.',/);
  assert.doesNotMatch(read('src/app/terms/page.js'), /terms for using MockMob mock tests, community questions/);
  assert.doesNotMatch(read('src/lib/seo.js'), /terms for using MockMob mock tests, community questions/);
  // Only the hidden pages, the flagged panel, the flagged Account rows and the flagged nav group may point at /upload or /my-uploads.
  const walk = (dir) => readdirSync(new URL(`../../${dir}/`, import.meta.url), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  const referencing = walk('src').filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.includes('/api/') && /['"`]\/(upload|my-uploads)\b/.test(read(f))).sort();
  assert.deepEqual(referencing, [
    'src/app/(app)/dashboard/DashboardPageClient.jsx',
    'src/app/(app)/my-uploads/MyUploadsPageClient.jsx',
    'src/app/robots.js',
    'src/components/feed/UploadForm.jsx',
    'src/components/profile/accountModel.mjs',
  ].sort(), 'a new link to a hidden page must be added to this list and gated');
  assert.match(read('src/app/(app)/dashboard/DashboardPageClient.jsx'), /\{contributeOn && <section[^>]*aria-labelledby="pr-bank">[\s\S]*?href="\/upload"/);
  assert.match(read('src/app/robots.js'), /'\/upload'/, 'search engines are still told to skip the hidden pages');
});

test('a lesson or recall run keeps Learn as the current place, and More is marked on a place that lives under it (D20)', () => {
  const layout = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(layout, /\(id === 'learn' && activePath\.startsWith\('\/study\/'\)\)/);
  assert.match(layout, /const inMore = !isTestRoute && allTabs\.some\(\(tab\) => isActive\(tab\.id\) && !dockIds\.has\(tab\.id\)\)/);
  assert.match(layout, /data-tour="nav-more" data-within=\{inMore && !mobileMenuOpen \? 'true' : undefined\}/);
  assert.match(read('src/app/(app)/arena.css'), /\.arena-bottomnav:has\(> :nth-child\(5\)\[data-within='true'\]\) \{ --abn-i: 4; --abn-on: 1; \}/);
});

test('Progress leads to the Learn page itself, not into a card run (D20)', () => {
  const study = read('src/components/study/StudyProgress.jsx');
  assert.match(study, /<Link className="study-button" href="\/learn">Open Learn<\/Link>/);
  assert.match(study, /due for review in Learn/);
  // Review keeps its direct button for due cards.
  assert.match(study, /review\s*\?\s*<Link className="study-button" href=\{record\.queue\.availableCount \? '\/learn\?recall=due' : '\/learn'\}>/);
});

test('Practice keeps two balanced lower columns while Add a question is hidden', () => {
  assert.match(read('src/app/(app)/dashboard/practice.css'), /\.pr-lower:not\(:has\(\.pr-panel\[aria-labelledby='pr-bank'\]\)\) \.pr-lower__side > \.pr-panel \{ grid-column: 2; \}/);
});
