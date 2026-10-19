// Release 8 fixes (the 18 Oct website re-audit, docs/brain/W-REAUDIT-2026-10-18.md): source-level checks that run without a
// browser. The browser walk of the same fixes (390 and 1440, Night and Day, real pointer clicks) is in tmp/r8fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, ext, out);
    else if (ext.some((e) => entry.name.endsWith(e))) out.push(path);
  }
  return out;
}
const srcDir = fileURLToPath(new URL('src/', root));

// ---------------------------------------------------------------------------------------------------------------------
// W-078: /mentor ("Your record") was near-white on near-white in Day (contrast 1.01).
// ---------------------------------------------------------------------------------------------------------------------

test('W-078: the /mentor record sits under pp-arena, so Day gets the Arena ink and not the dark fallbacks', () => {
  const page = read('src/components/ai/MentorRecordPage.jsx');
  assert.match(page, /<div className="mrp pp-arena">/, 'the page root carries pp-arena');
  // The root wraps the record view, not a sibling of it.
  const rootAt = page.indexOf('<div className="mrp pp-arena">');
  assert.ok(rootAt > 0 && page.indexOf('<RecordView', rootAt) > rootAt, 'RecordView renders inside the pp-arena root');
});

test('W-078: every page that draws the record view wraps it in pp-arena', () => {
  const users = walk(srcDir, ['.jsx', '.js']).filter((file) => !/[\\/]RecordView\.jsx$/.test(file) && /<RecordView\b/.test(readFileSync(file, 'utf8')));
  assert.ok(users.length >= 2, 'the Radar and Ask Mobi pages both draw it');
  for (const file of users) assert.match(readFileSync(file, 'utf8'), /\bpp-arena\b/, `${file} draws <RecordView> outside pp-arena`);
});

test('W-078: arena.css maps every --pp token the record view reads onto an Arena token (Night and Day follow together)', () => {
  const arena = stripComments(read('src/app/(app)/arena.css'));
  const rule = arena.match(/\.app-shell \.pp-arena\s*\{([^}]*)\}/);
  assert.ok(rule, 'the .pp-arena rule exists');
  const mapped = new Set([...rule[1].matchAll(/--(pp-[a-z0-9-]+)\s*:\s*var\(--a-/g)].map((m) => m[1]));
  const used = new Set();
  for (const file of walk(srcDir, ['.css'])) for (const m of readFileSync(file, 'utf8').matchAll(/var\(--(pp-[a-z0-9-]+)/g)) used.add(m[1]);
  assert.ok(used.size >= 8, 'the record view reads its ink, line, accent, bad and wash tokens');
  for (const token of used) assert.ok(mapped.has(token), `--${token} is read in CSS but not mapped onto an --a- token by .pp-arena`);
});

test('the preview fixture and the signed-in page render the same /mentor component', () => {
  assert.ok(existsSync(new URL('src/components/ai/MentorRecordPage.jsx', root)));
  assert.match(read('src/app/(app)/mentor/page.js'), /<MentorRecordPage \/>/);
  assert.match(read('src/app/preview/arena/ArenaPreviewClient.jsx'), /view === 'prepos' \? <MentorRecordPage \/>/);
});

// ---------------------------------------------------------------------------------------------------------------------
// W-089: the 18 Oct design notes were only in the working branch (mockmob-next), not in the repo that ships.
// ---------------------------------------------------------------------------------------------------------------------

test('W-089: the six 18 Oct design notes are in the repo, as written', () => {
  const notes = ['TODAY-1018.md', 'REVIEW-RESULT-1018.md', 'ASK-MOBI-1018.md', 'COMMUNITY-1018.md', 'BADGES-ICONS-1018.md', 'BADGES-REFINE-1018.md'];
  for (const name of notes) {
    const text = read(`docs/design-decisions/pass-1018/${name}`);
    assert.ok(text.length > 4000, `${name} is the whole note`);
    assert.match(text, /^# .+/m, `${name} opens with its title`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// W-093: Help and FAQ said "Five stops" while the tour ran eight; two hedge lines in Learn and Progress.
// ---------------------------------------------------------------------------------------------------------------------

test('W-093: the Help tour row counts the tour that will run, in every combination of Learn and the Mob', async () => {
  const { tourSteps } = await import('../../src/lib/appTour.mjs');
  const { tourNote } = await import('../../src/lib/helpDoor.mjs');
  const words = { 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten' };
  for (const study of [false, true]) {
    for (const mob of [false, true]) {
      const n = tourSteps({ study, mob }).length;
      assert.equal(tourNote(n), `${words[n]} stops, about a minute`, `study ${study}, mob ${mob}`);
    }
  }
  assert.equal(tourSteps({ study: true }).length, 8, 'the live set (Learn on, the Mob off) is eight stops');
  assert.doesNotMatch(read('src/lib/helpDoor.mjs'), /Five stops/);
});

test('W-093: the shell runs the tour from appTour.mjs and tells Help how many stops there are', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /from '@\/lib\/appTour\.mjs'/);
  assert.match(shell, /tourSteps\(\{ mob: mobOn, study: studyOn \}\)/);
  assert.match(shell, /<TourStopsProvider count=\{TOUR_STEPS\.length\}>/);
  assert.doesNotMatch(shell, /const TOUR_STEPS_ALL/, 'one list of stops, not two');
  assert.match(read('src/app/(app)/help/HelpPageClient.jsx'), /tourNote\(tourStops\)/);
});

test('W-093: Learn and Progress no longer hedge', () => {
  assert.doesNotMatch(read('src/components/study/StudyLibrary.jsx'), /provisional until NTA/);
  assert.doesNotMatch(read('src/components/study/StudyProgress.jsx'), /does not certify mastery/);
});

// ---------------------------------------------------------------------------------------------------------------------
// W-079: no target under 44 px that the audit found.
// ---------------------------------------------------------------------------------------------------------------------

test('W-079: the sidebar rows, the Practice fine-tune line, "See Q14" and the switch are 44 px targets', () => {
  const arena = stripComments(read('src/app/(app)/arena.css'));
  assert.match(arena, /\.arena-nav-link--sub\s*\{[^}]*min-height:\s*44px/);
  assert.match(stripComments(read('src/app/(app)/dashboard/practice.css')), /\.pr-bar__fine\s*\{[^}]*min-height:\s*44px/);
  assert.match(stripComments(read('src/components/result/result-1017.css')), /\.rx-notice \.rx-link\s*\{[^}]*padding-block:\s*13px/);
  assert.match(stripComments(read('src/components/ui/controls/controls.css')), /\.ctl-toggle \.mk-switch[^{]*\{[^}]*min-height:\s*44px/);
});

// ---------------------------------------------------------------------------------------------------------------------
// D53 (owner, 12:15 pm, on the app): a tapped ask answers at once. The website's Ask Mobi never had the "goes to an AI service"
// sheet; this holds that, and holds the one quiet inline line that says who writes the reply and what it costs.
// ---------------------------------------------------------------------------------------------------------------------

test('D53: a tapped ask in Ask Mobi sends at once, with no confirmation step between the tap and the request', () => {
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  // askRow goes straight to sendPaid; nothing in the panel opens a sheet, a dialog or a confirm first.
  assert.match(panel, /function askRow\(ask\)[\s\S]*?sendPaid\(ask\.label\);\s*\}/);
  assert.doesNotMatch(panel, /\bconfirm\(|alertdialog|goes to an AI service|sentTo|acknowledg|consent/i);
  // The server needs no acknowledgement flag with the ask: the body is the question, the mode, the kind and the request id.
  assert.doesNotMatch(read('src/app/api/ai/mentor/chat/route.js'), /acknowledg|payload\.consent|payload\.ack/i);
});

test('D53: one quiet inline line says an AI service writes the reply and that it uses 1 credit (the credit wording is still usesLine)', () => {
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  assert.match(panel, /An AI service writes it\. \$\{usesLine\(\{ what: 'This reply', cost: 1, pool: 'ai' \}\)\}/);
  assert.match(panel, /className="amb-cost__price" aria-live="polite"/);
});

test('W-079 (release 9): the desktop "Edit" on the Practice ticket is itself 44 px tall, not 36 px with an invisible layer', () => {
  const css = stripComments(read('src/app/(app)/dashboard/practice.css'));
  assert.match(css, /\.pr-ticket__edit\s*\{[^}]*min-height:\s*44px/);
  assert.doesNotMatch(css, /\.pr-ticket__edit::after/);
});

test('D53: the cost row\'s wallet link keeps a 44 px target without growing the row', () => {
  const css = stripComments(read('src/components/ai/ask-mobi.css'));
  assert.match(css, /a\.amb-cost__wallet\s*\{[^}]*padding-block:\s*13px;\s*margin-block:\s*-13px/);
});

// ---------------------------------------------------------------------------------------------------------------------
// Release 8 follow-ups (the integrator's re-audit of 7066d676): first glance of the landing hero, Review's row Repair,
// the Lab Cinema light, and the tablet hero buttons.
// ---------------------------------------------------------------------------------------------------------------------

test('D38/L-014: on desktop the hero seat does not paint before PipGuide marks the root (no Mobi on the headline at first glance)', () => {
  const css = stripComments(read('src/app/brand-pip.css'));
  const rule = css.match(/:root:not\(\[data-motion='reduced'\]\):not\(\[data-pip-guide\]\):not\(\[data-pip-static\]\) \.mm\.lp \.lp-hero__greeting \.pip-seat \{([^}]*)\}/);
  assert.ok(rule, 'the pre-guide hide rule exists');
  assert.match(rule[1], /visibility:\s*hidden/);
  // It sits inside the desktop, motion-allowed query that takes the seat out of flow, and nowhere else.
  const query = css.indexOf('@media (min-width: 1100px) and (prefers-reduced-motion: no-preference)');
  assert.ok(query > 0 && css.indexOf(rule[0]) > query && css.indexOf(rule[0]) < css.indexOf('@media (max-width: 760px)', query), 'inside the desktop query');
});

test('W-032: a Review row\'s Repair opens the sealed sheet (Try it again, Show the answer, the priced Repair key); it never starts the paid repair itself', () => {
  const page = read('src/components/review/ReviewChapters.jsx');
  assert.doesNotMatch(page, /autoRepair|setAuto|auto=\{/, 'no auto-start path in the chapter rows');
  assert.match(page, /onRepair=\{\(\) => setOpenUid\(m\.uid\)\}/);
  assert.match(page, /className="rv8-act mk-press" onClick=\{onRepair\}/);
  // The sealed sheet carries the priced key; nothing on the row itself reserves a credit. v13 (C-dec 3, D157): the key is
  // Mobi's job, "Fix it for good · 1 credit" (fixForGood.mjs FIX_COPY.startLabel), its price said before the tap.
  assert.match(read('src/components/review/AnswerSheet.jsx'), /aria-label=\{FIX_COPY\.startAria\(item\.number\)\}>\{FIX_COPY\.startLabel\}<\/button>/);
});

test('W-032: reopening a saved repair is quiet and free: the server answers "stored" before it reserves, whatever the request id', () => {
  const repair = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(repair, /queueMicrotask\(\(\) => run\(\{ quiet: !!saved \}\)\)/);
  const flow = read('src/services/recovery/repairFlow.js');
  assert.ok(flow.indexOf('deps.findStored(user.id, id)') > 0 && flow.indexOf('deps.findStored(user.id, id)') < flow.indexOf('deps.reserve('), 'the stored lookup runs before any reservation');
});

test('L-019: Lab Cinema has no drifting light behind the screen', () => {
  const css = stripComments(read('src/app/lab-cinema.css'));
  assert.doesNotMatch(css, /lcd__glow|lc-glow/);
  assert.doesNotMatch(read('src/components/landing/LabCinema.jsx'), /lcd__glow/);
});

test('L-013: the hero buttons show on tablet widths (761 to 899 px); nothing hides .lp-cta there', () => {
  const css = stripComments(read('src/app/landing.css'));
  assert.doesNotMatch(css, /@media \(max-width: 899px\) \{\s*\.lp-cta \{\s*display: none;/);
  const all = ['src/app/landing.css', 'src/app/home-refinements.css', 'src/app/hero-motion.css'].map((f) => stripComments(read(f))).join('\n');
  assert.doesNotMatch(all, /\.lp-cta\s*\{[^}]*display:\s*none/);
});

test('W-064: the preview has a check fixture, so the first-week path can be walked with a check due', () => {
  assert.match(read('src/app/preview/arena/ArenaPreviewClient.jsx'), /fixture\.get\('move'\) === 'check'\) plan\.primary = \{ kind: 'fresh_check'/);
});
