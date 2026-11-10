// node --test src/components/landing/heroProof.test.mjs
// The hero's proof line (round 11, 10 Nov 2026; HeroProof.jsx): one quiet link under the hero's ways in, to the creators
// section (#on-instagram), with three small marks and "Featured by CUET creators with N followers", N the creators
// section's own "Combined followers" figure from src/lib/social.js (one function for both, so they never disagree; no
// figure is typed in the component). Round 4 removed a loose fact line under the keys: this one is a designed element.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { CREATOR_REELS, combinedReach, compactCount, creatorInitials, featuredCreators, followersFigure, heroCreators, rankedReels } from '../../lib/social.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PROOF = read('./HeroProof.jsx');
const CODE = PROOF.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const REELS = read('./CreatorReels.jsx');
const PAGE = read('../../app/page.js');
const CSS = read('../../app/r10-hero.css').replace(/\/\*[\s\S]*?\*\//g, '');

test('it links to the creators section as a same-page shortcut, under the ways in, above the film', () => {
  assert.match(CODE, /<a href="#on-instagram" className="lp-featured" data-page-jump="" aria-label=\{sentence\}>/);
  assert.match(PAGE, /<section className="lp-sec" id="on-instagram">/, 'the section it opens is on the page');
  assert.match(read('./pageJump.mjs'), /anchor\.hasAttribute\('data-page-jump'\)/, 'pageJump takes data-page-jump links');
  // In the words' column, right after the keys and the login line (LandingActions), before the film.
  const hero = PAGE.slice(PAGE.indexOf('<section className="lp-hero">'), PAGE.indexOf('</section>', PAGE.indexOf('<section className="lp-hero">')));
  const copy = hero.slice(hero.indexOf('<div className="lp-hero__copy">'), hero.indexOf('<HeroFilm />'));
  assert.ok(copy.indexOf('<div className="lp-cta">') > 0 && copy.indexOf('<HeroProof />') > copy.indexOf('<div className="lp-cta">'), 'in the copy column, after the ways in');
  assert.equal((PAGE.match(/<HeroProof \/>/g) || []).length, 1);
  assert.doesNotMatch(PROOF, /^['"]use client['"]/m, 'a server component: no state');
});

test('its figure is the creators section\'s own, from src/lib/social.js; no number is typed in the component', () => {
  assert.match(CODE, /import \{[^}]*followersFigure[^}]*\} from '@\/lib\/social';/);
  assert.match(CODE, /const figure = followersFigure\(creators\);/);
  assert.match(CODE, /const creators = featuredCreators\(rankedReels\(\)\);/);
  // The section reads the same two functions (it did the sum inline before round 11).
  assert.match(REELS, /const creators = featuredCreators\(items\);/);
  assert.match(REELS, /<dt>Combined followers<\/dt><dd className="mm-measure">\{followersFigure\(creators\)\}<\/dd>/);
  assert.doesNotMatch(REELS, /Math\.floor\(reach \/ 1000\)/);
  // No digit in any string or any text the component writes.
  const strings = [...CODE.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
  const texts = [...CODE.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
  for (const s of [...strings, ...texts]) assert.doesNotMatch(s, /\d/, `typed digit in "${s}"`);
  // The figure, worked out the way the section always did: the combined reach rounded down to the thousand, then "+".
  const creators = featuredCreators(rankedReels());
  assert.ok(creators.length >= 1 && creators.every((c) => c.kind === 'reel' && c.followers));
  assert.equal(followersFigure(creators), `${compactCount(Math.floor(combinedReach(creators) / 1000) * 1000)}+`);
  assert.match(followersFigure(creators), /^\d+(\.\d)?K\+$/);
  assert.equal(followersFigure([{ kind: 'reel', featured: true, followers: 400 }]), null, 'under a thousand: no figure (words alone)');
  // Round 12 (owner, 10 Nov 2026: "remove Prathna ... mainly keep the other three big creators"): the featured creators are a
  // field in the data (`featured: true`), not a follower threshold in code; biggest audience first.
  const featured = [...CREATOR_REELS].filter((c) => c.featured === true);
  assert.deepEqual(featuredCreators(rankedReels()).map((c) => c.handle), featured.sort((a, b) => (b.followers + (b.also?.followers || 0)) - (a.followers + (a.also?.followers || 0))).map((c) => c.handle), 'biggest audience first');
  assert.deepEqual(featuredCreators(rankedReels()).map((c) => c.creator).sort(), ['Garima Jain', 'Radhika Gaur', 'Rahul Thapa']);
  assert.equal(featuredCreators([{ kind: 'reel', followers: 500000 }]).length, 0, 'a big audience alone does not make a creator featured');
  assert.doesNotMatch(read('../../lib/social.js').replace(/^\s*\/\/.*$/gm, ''), /followers\s*[><]=?\s*\d/, 'no follower threshold typed in code');
  // Prathna Jain stays in the strip as a reel, after the three, but is not counted.
  const strip = rankedReels().filter((i) => i.kind === 'reel').map((i) => i.creator);
  assert.ok(strip.includes('Prathna Jain') && strip.indexOf('Prathna Jain') === strip.length - 1, 'Prathna last among the creators');
  assert.ok(!featuredCreators(rankedReels()).some((c) => c.creator === 'Prathna Jain'));
});

test('round 12: every featured creator has a profile picture, a real file in public/, small', () => {
  for (const c of featuredCreators(rankedReels())) {
    assert.match(c.photo || '', /^\/brand\/creators\/[a-z0-9._]+\.(webp|jpg)$/, `${c.creator}: a photo path`);
    const file = new URL(`../../../public${c.photo}`, import.meta.url);
    assert.ok(existsSync(file), `${c.creator}: ${c.photo} exists in public/`);
    assert.ok(statSync(file).size > 1000 && statSync(file).size < 20000, `${c.creator}: a real, small picture`);
    // The JPEG read from Instagram sits beside the webp the page draws.
    assert.ok(existsSync(new URL(`../../../public/brand/creators/${c.handle}.jpg`, import.meta.url)), `${c.handle}.jpg`);
  }
});

test('its words: one sentence for screen readers; on a narrow phone two short lines, the figure never without its unit', () => {
  assert.match(CODE, /Featured by CUET creators\n\s*\{figure \? <span className="lp-featured__more"><span className="lp-featured__with"> with <\/span><b className="lp-featured__fig">\{figure\}<\/b> followers<\/span> : null\}/);
  assert.match(CODE, /`Featured by CUET creators with \$\{figure\} followers\. See the reels\.`/);
  assert.match(CODE, /'Featured by CUET creators\. See the reels\.'/);
  assert.match(CODE, /<span className="lp-featured__marks" aria-hidden="true">/);
  // The marks (round 12): each featured creator's own Instagram profile picture, the one on the section's cards, at most
  // three; decorative (the sentence names nobody), eager and sized so nothing shifts. No initials any more.
  assert.match(CODE, /heroCreators\(creators\)\.slice\(0, 3\)\.map/);
  // Owner, 10 Nov 2026: in the hero only, Garima first, Radhika second, Rahul third; the first circle is the one drawn
  // whole (on top of the stack). The creators section keeps biggest audience first (the assertion above).
  assert.deepEqual(heroCreators(featuredCreators(rankedReels())).map((c) => c.creator), ['Garima Jain', 'Radhika Gaur', 'Rahul Thapa']);
  assert.deepEqual(heroCreators([{ handle: 'x' }, { handle: 'rahul.guides' }, { handle: 'du__club' }]).map((c) => c.handle), ['du__club', 'rahul.guides', 'x'], 'a creator not named follows, in the order given');
  assert.match(CSS, /\.mm\.lp \.lp-featured__mark:first-child \{ z-index: 3; \}/, 'the first picture is on top, never cut');
  assert.match(CODE, /<img key=\{creator\.handle\} className="lp-featured__mark" src=\{creator\.photo\} width=\{24\} height=\{24\} alt="" loading="eager"/);
  assert.doesNotMatch(CODE, /creatorInitials/);
  assert.match(REELS, /src=\{item\.photo\}/, 'the cards draw the same pictures');
  // MockMob's own posts keep the monogram (the initials).
  assert.equal(creatorInitials('Garima Jain'), 'GJ');
  assert.equal(creatorInitials('Garima Jain', 1), 'G');
  assert.equal(creatorInitials('prathna'), 'P');
  assert.match(REELS, /creatorInitials as initials/, 'the posts\' covers keep their initials');
  // No middle dot, exclamation, arrow or em dash in anything it says.
  const said = [...CODE.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]).concat([...CODE.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]));
  for (const s of said) assert.doesNotMatch(s, /·|!|→|—/, s);
});

test('its look: quiet 13 px muted ink, the figure in ink, no border, pill or fill; a 44 px target; focus; Night as Day', () => {
  const rule = (sel) => (CSS.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';
  const link = rule('.mm.lp .lp-hero .lp-featured');
  assert.match(link, /font: 400 0\.8125rem\/1\.25 var\(--font-body\);/, '13 px');
  assert.match(link, /color: var\(--ink-3\);/, 'the login line\'s muted ink');
  assert.doesNotMatch(link, /border:|background|box-shadow/, 'no border, no pill, no fill');
  assert.match(rule('.mm.lp .lp-featured__fig'), /color: var\(--ink\);/);
  // The visible box is the 24 px marks; the target grows 20 px down (24 + 20 = 44), never up into the login link's.
  assert.match(rule('.mm.lp .lp-featured__mark'), /width: 24px;\s*height: 24px;/);
  // Round 12: pictures, cut round, a 1.5 px ring in the page's paper so the overlapping three separate.
  assert.match(rule('.mm.lp .lp-featured__mark'), /border-radius: 50%;\s*object-fit: cover;/);
  assert.match(rule('.mm.lp .lp-featured__mark'), /box-shadow: 0 0 0 1\.5px var\(--paper\);/);
  assert.match(CSS, /\.mm\.lp \.lp-featured__mark \+ \.lp-featured__mark \{ margin-left: -8px; \}/, 'the same overlap');
  assert.match(rule('.mm.lp .lp-hero .lp-featured::before'), /inset: 0 -6px -20px;/);
  assert.ok(24 + 20 >= 44);
  assert.match(rule('.mm.lp .lp-hero .lp-featured:focus-visible'), /outline: 2px solid var\(--focus-ring, var\(--ink\)\);/);
  assert.match(rule('.mm.lp .lp-featured__words'), /white-space: nowrap;/, 'never wraps');
  // One line from a 348 px column up (378 px at desktop's 14 px); narrower, two short lines ("with" hidden, the figure keeps
  // "followers"), and no rule hides the figure or the unit.
  assert.match(CSS, /@container \(max-width: 347\.98px\) \{\s*\.mm\.lp \.lp-featured__with \{ display: none; \}\s*\.mm\.lp \.lp-featured__more \{ display: block; \}/);
  assert.match(CSS, /@container \(max-width: 377\.98px\) \{\s*\.mm\.lp \.lp-featured__with \{ display: none; \}\s*\.mm\.lp \.lp-featured__more \{ display: block; \}/);
  assert.doesNotMatch(CSS, /lp-featured__unit|lp-featured__more \{ display: none/);
  // The film gives back the gap: 20 px under the marks on phones and tablets (it was 24 under the login line).
  assert.match(CSS, /@media \(max-width: 959px\) \{\s*\.mm\.lp \.lp-hero__copy:has\(\.lp-featured\) ~ \.lp-film \{ margin-top: 20px; \}/);
  // No theme-specific colour, no glow, gradient or animation: Night is the same tokens as Day.
  const block = CSS.slice(CSS.indexOf('.mm.lp .lp-hero .lp-featured {'));
  assert.doesNotMatch(block, /data-theme|gradient|animation|#d2f000|volt|text-shadow|blur/i);
  assert.doesNotMatch(block, /transition: all/);
});
