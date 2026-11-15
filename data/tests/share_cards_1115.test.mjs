// P8 (production pass, 15 Nov 2026): link previews. WhatsApp is widely reported to drop a preview image over about 300 KB;
// the home card was a 329,831-byte PNG and 12 of the 15 subject cards were 302 to 521 KB. The cards are now drawn once in
// src/lib/og/shareCards.mjs and sent as JPEGs. This renders every card exactly as the routes do (the same ImageResponse
// class next/og exports for Node) and holds each under the ceiling, at 1200 x 630. It also pins the invite previews:
// a Mob invite (/join/<code>) and a friend invite (/signup?invite=1, where /r/<code> lands) say what they are.
//   node --test data/tests/share_cards_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const load = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

const cards = await load('src/lib/og/shareCards.mjs');
const { ImageResponse } = await load('node_modules/next/dist/compiled/@vercel/og/index.node.js');
const sharp = (await import('sharp')).default;
const fonts = await cards.cardFonts(ROOT);

async function rendered(element) {
  const response = await cards.cardResponse(ImageResponse, element, fonts);
  const body = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(body).metadata();
  return { type: response.headers.get('content-type'), bytes: body.length, meta };
}

test('the home card is a 1200 x 630 JPEG under the 300 KB ceiling', async () => {
  const card = await rendered(cards.homeCard(await cards.homeCardAssets(ROOT)));
  assert.equal(card.type, 'image/jpeg');
  assert.equal(card.meta.format, 'jpeg');
  assert.deepEqual([card.meta.width, card.meta.height], [1200, 630]);
  assert.ok(card.bytes < cards.SHARE_CARD_MAX_BYTES, `home card ${card.bytes} bytes`);
  assert.ok(cards.SHARE_CARD_MAX_BYTES <= 300_000);
});

test('every CUET subject card is a 1200 x 630 JPEG under the ceiling', async () => {
  const { SUBJECT_HUBS } = await load('src/lib/subjectHubs.js');
  const { subjectArt } = await load('data/subject_art.mjs');
  const { paperCode } = await load('src/lib/subjectPages.mjs');
  assert.equal(SUBJECT_HUBS.length, 15);
  for (const hub of SUBJECT_HUBS) {
    const art = subjectArt(hub.slug);
    assert.ok(art, `${hub.slug} has its object`);
    // The free-first-mock chip is the longer of the two third chips; the heavier variant is the one held to the ceiling.
    const card = await rendered(cards.subjectCard({ name: hub.name, code: paperCode(hub), art, picture: await cards.subjectPicture(ROOT, art), firstFree: true }));
    assert.equal(card.type, 'image/jpeg', hub.slug);
    assert.deepEqual([card.meta.width, card.meta.height], [1200, 630], hub.slug);
    assert.ok(card.bytes < cards.SHARE_CARD_MAX_BYTES, `${hub.slug} card ${card.bytes} bytes`);
  }
});

test('the two card routes draw through shareCards.mjs and declare a JPEG at 1200 x 630', () => {
  for (const route of ['src/app/opengraph-image.jsx', 'src/app/cuet/[subject]/opengraph-image.jsx']) {
    const src = read(route);
    assert.match(src, /export const contentType = CARD_TYPE;/, route);
    assert.match(src, /export const size = CARD_SIZE;/, route);
    assert.match(src, /return cardResponse\(ImageResponse, /, route);
  }
  assert.equal(cards.CARD_TYPE, 'image/jpeg');
  assert.deepEqual({ ...cards.CARD_SIZE }, { width: 1200, height: 630 });
  // Full colour resolution: chroma subsampling would blur the volt line on charcoal.
  assert.equal(cards.JPEG_OPTIONS.chromaSubsampling, '4:4:4');
});

test('invite previews say what they are, never a name, with the share card', async () => {
  const seo = await load('src/lib/seo.js');
  const { DenCopy } = await load('src/lib/mob/v3/denCopy.mjs');
  const { REFERRAL_COPY } = await load('src/lib/referrals/friendInvite.mjs');
  // The words follow the product's own copy, so they cannot drift from what the pages promise.
  assert.ok(seo.INVITE_SHARE.mob.description.includes(DenCopy.d0Lead.split('. ')[1]), 'the Mob\'s own lead');
  assert.ok(seo.INVITE_SHARE.friend.description.endsWith(REFERRAL_COPY.homeInviteReward()), 'the referral reward as the home page says it');
  for (const words of Object.values(seo.INVITE_SHARE)) {
    assert.match(words.title, /^A friend invited you to /);
    assert.doesNotMatch(`${words.title} ${words.description}`, /!|·|→|\$\{/);
  }
  const mob = seo.mobInviteMetadata('/join/ABC1234');
  assert.deepEqual(mob.robots, { index: false, follow: false, googleBot: { index: false, follow: false } });
  assert.equal(mob.alternates.canonical, 'https://www.mockmob.in/join/ABC1234');
  assert.equal(mob.openGraph.url, mob.alternates.canonical);
  assert.equal(mob.openGraph.title, seo.INVITE_SHARE.mob.title);
  assert.deepEqual(mob.openGraph.images, [seo.DEFAULT_SHARE_IMAGE]);
  assert.deepEqual(mob.twitter.images, [seo.DEFAULT_SHARE_IMAGE]);
  assert.equal(seo.DEFAULT_SHARE_IMAGE.type, 'image/jpeg');
  // The sign-up page, reached from a friend's link, keeps its own canonical and robots and takes the invite's words.
  const base = seo.seoMetadata({ title: 'Create a Free MockMob Account', description: 'x', path: '/signup' });
  const friend = seo.friendInviteMetadata(base);
  assert.equal(friend.alternates.canonical, 'https://www.mockmob.in/signup');
  assert.deepEqual(friend.robots, base.robots);
  assert.equal(friend.openGraph.title, seo.INVITE_SHARE.friend.title);
  assert.equal(friend.twitter.description, seo.INVITE_SHARE.friend.description);
  assert.deepEqual(friend.openGraph.images, base.openGraph.images);
  // The /join page builds its preview from the URL alone: no lookup, no name.
  const page = read('src/app/join/[code]/page.jsx');
  assert.match(page, /export async function generateMetadata\(\{ params \}\) \{[\s\S]*?return mobInviteMetadata\(`\/join\/\$\{code\}`\);/);
  assert.match(page, /replace\(\/\[\^A-Za-z0-9\]\/g, ''\)\.slice\(0, 16\)/, 'only the code\'s own characters reach the canonical');
  const meta = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('export default'));
  assert.doesNotMatch(meta, /supabase|Database|fetch\(|inviter|name/i);
});

test('structured data: the Organization names the brand\'s Instagram; no search box pointing at a signed-in page', async () => {
  const seo = await load('src/lib/seo.js');
  const [org, site] = seo.globalJsonLd();
  assert.deepEqual(org.sameAs, ['https://www.instagram.com/mockmob.in/']);
  assert.equal(site['@type'], 'WebSite');
  assert.equal(site.potentialAction, undefined, '/explore is signed-in and noindex');
  assert.equal(seo.globalJsonLd().filter((x) => /Organization$/.test(x['@type'])).length, 1, 'one Organization');
});
