import { CAPABILITIES } from '@/../data/capabilities';

// The signed-in navigation: the same five places as the app (owner G24 and D105, option A of WEB-NAV-1019, built 19 Oct
// 2026 under D112 and confirmed by the owner as D114). Today, Practice, Start (an action, drawn by the shell), Mob and You.
// Every page keeps its own link and its own route; only where a link sits changed. Nothing is hidden (R3).
//
// hint: a plain descriptor shown beside a coined or branded name ("Mob, with friends"; "Colleges, DU cutoffs").
// The Guide row is HELP_DOOR.label (src/lib/helpDoor.mjs); a test holds the two together (this file is also loaded on its own, so it imports nothing local).
const item = (id, label, icon = id, href = `/${id}`, hint = null) => ({ id, label, icon, href, hint });
// place: one of the five places, drawn as a bold row in the desktop sidebar. sub: a page that lives inside the place above
// it, drawn indented under it. ruleAbove: a hairline before the row (in You, between the plan and the account pages).
const place = (tab) => ({ ...tab, place: true });
const sub = (tab) => ({ ...tab, sub: true });

const TODAY = item('today', 'Today');
const PRACTICE = item('dashboard', 'Practice', 'practice', CAPABILITIES.practice.href);
// Review keeps /review; its name is "Your papers", the word the app uses (D106).
const PAPERS = item('review', 'Your papers', 'review', CAPABILITIES.review.href);
// Learn v2 (NEXT_PUBLIC_LEARN2 = 'on'; the development preview passes learn2 itself): Learn says what is in it, in the rail's own
// two-part pattern ("Mob, with friends"): "Learn, Key cards" (LK1, DESIGN-SPEC A8). The Key cards due count is drawn beside it by the
// shell. It sits after Your papers, in the owner's order Practice, Papers, Learn, Explore (LK46, 2 Nov 2026). Off, the live site keeps
// its Learn row exactly as it was: plain "Learn", after Your papers.
const LEARN2_NAV = process.env.NEXT_PUBLIC_LEARN2 === 'on';
const LEARN = item('learn', 'Learn', 'learn', '/learn', 'Key cards');
const LEARN_V1 = item('learn', 'Learn');
// N1, drawn as an alternate for the owner's call (B 6.4, preview &nav=n1): Learn as a place of its own in the desktop sidebar, with one
// sub-row that opens Find on the due cards. Not the default.
const LEARN_CARDS = item('learn-cards', 'Key cards to revise', 'learn', '/learn/find');
const EXPLORE = item('explore', 'Explore');
const SAVED = item('saved', 'Saved');
// title: what the top bar calls the place's own page, where that differs from its short name.
const MOB = { ...item('mob', 'Mob', 'mob', '/mob', 'with friends'), title: 'Your Mob' };
const STANDING = item('leaderboard', 'Your standing', 'ranks');
const YOU = { ...item('profile', 'You', 'account'), title: 'Your account' };
const PROGRESS = item('progress', 'Progress');
const TREND = item('analytics', 'Marks trend', 'radar', '/analytics');
const COLLEGES = item('admission-compass', 'Colleges', 'colleges', '/admission-compass', 'DU cutoffs');
const WALLET = item('wallet', 'Wallet', 'wallet');
const GUIDE = item('help', 'Guide', 'help');
const ASK_MOBI = item('mentor', 'Ask Mobi', 'prepos');

/** The pages inside Practice, in the order of its row of tabs on a phone and its rows in the sidebar: Practice, Your papers, Learn,
 *  Explore, Saved (the owner's order, LK46, 2 Nov 2026). Learn v2 names Learn "Learn, Key cards"; off, a plain "Learn". */
export function practicePages({ learn2 = LEARN2_NAV } = {}) {
  return [PRACTICE, PAPERS, learn2 ? LEARN : LEARN_V1, EXPLORE, SAVED];
}
export const PRACTICE_PAGES = Object.freeze(practicePages());
/** The pages inside the Mob. */
export const MOB_PAGES = Object.freeze([{ ...MOB, label: 'Your Mob', hint: null, title: null }, STANDING]);

// `mob`: the Mob is on (MOB_ENABLED, passed down from the (app) layout). Off, the Mob place is not drawn at all, and Your
// standing moves under You beside Progress, so it keeps its link.
// `contribute`: the contribution side is on (CONTRIBUTE_ENABLED). Off (the default), Contribute and My uploads are not drawn
// (COMMUNITY-1018); with it on they come back, as the Contribute group under the places.
// Every group has a label: the place groups use it as their landmark name only (the sidebar draws no group headers, so the
// four places read as places); Moderation and Contribute, which only some students see, keep a visible header.
// `learnPlace`: the N1 alternate (above): Learn leaves Practice's sub-rows and stands as its own place after Practice.
// `learn2`: Learn v2 is on (practicePages above).
export function arenaNavigation(moderator = false, { mob = false, contribute = false, learnPlace = false, learn2 = LEARN2_NAV } = {}) {
  return [
    ...(moderator ? [{ id: 'moderation', label: 'Moderation', items: [item('moderation', 'Mod queue', 'moderation')] }] : []),
    { id: 'today', label: 'Today', place: true, items: [place(TODAY)] },
    { id: 'practice', label: 'Practice', place: true, items: [place(PRACTICE), ...(learnPlace ? [PAPERS, EXPLORE, SAVED] : practicePages({ learn2 }).slice(1)).map(sub)] },
    ...(learnPlace ? [{ id: 'learn', label: 'Learn', place: true, items: [place({ ...LEARN, hint: null }), sub(LEARN_CARDS)] }] : []),
    ...(mob ? [{ id: 'mob', label: 'Mob', place: true, items: [place(MOB), sub(STANDING)] }] : []),
    { id: 'you', label: 'You', place: true, items: [place(YOU), sub(PROGRESS), ...(mob ? [] : [sub(STANDING)]), sub(TREND), sub(COLLEGES), { ...sub(WALLET), ruleAbove: true }, sub(GUIDE)] },
    ...(contribute ? [{ id: 'contribute', label: 'Contribute', items: [item('upload', 'Contribute', 'contribute'), item('my-uploads', 'My uploads', 'uploads')] }] : []),
  ];
}

/** Ask Mobi: Mobi's own door at the foot of the sidebar, above Night and Day (D6), a key in the top bar at every width, and the
 *  first row of the You page's places on a phone (owner LK143, 5 Nov 2026: "completely gone from the UI"). */
export const ASK_MOBI_NAV = ASK_MOBI;

/** The dock's You (owner LK141, 5 Nov 2026): a link to the You page, the way every other dock slot opens its place's page. The
 *  person in the top bar opens the account sheet (AccountPopover). It used to be the other way round, and he called that "the opposite
 *  of what I think a UI should do". */
export const YOU_DOCK = Object.freeze({ ...YOU, dock: 'you' });

// The phone dock: Today, Practice, the Start key (drawn by the shell as the centre slot), Mob, then You (a button that opens
// the You sheet, drawn by the shell). Colleges left the dock for You and Today's top-3 card (D104); Review moved inside
// Practice as Your papers (D105): moved, never removed.
// `dock`: the place a tab stands for, so it is marked while the student is on a page inside it (dockPlaceOf).
export function mobileNavigation({ mob = false } = {}) {
  return [{ ...TODAY, dock: 'today' }, { ...PRACTICE, dock: 'practice' }, ...(mob ? [{ ...item('mob', 'Mob', 'mob'), dock: 'mob' }] : [])];
}
export const MOBILE_STUDY_NAV = mobileNavigation({ mob: true });

// The You page's places on a phone and a tablet (owner LK141: the dock's You opens the You page, which carries what the You sheet did).
// Ask Mobi leads them, then these two groups, then Guide and Show me around; the account itself (Sign out, Appearance) is the page
// below them and the top bar's account sheet. The Moderation and Contribute groups come along when the student has them.
// (The name is the old sheet's: tests and the tour read it.)
export function youSheetGroups(moderator = false, { mob = false, contribute = false } = {}) {
  return [
    ...(moderator ? [{ id: 'moderation', label: 'Moderation', items: [item('moderation', 'Mod queue', 'moderation')] }] : []),
    { id: 'progress', label: 'Your progress', items: [PROGRESS, TREND, ...(mob ? [] : [STANDING])] },
    { id: 'plan', label: 'Your plan', items: [{ ...COLLEGES, hint: null }, WALLET] },
    ...(contribute ? [{ id: 'contribute', label: 'Contribute', items: [item('upload', 'Contribute', 'contribute'), item('my-uploads', 'My uploads', 'uploads')] }] : []),
  ];
}

/**
 * The Practice row of tabs on a phone. Learn v2 (R2 ruling 10, LK26): four equal tabs that always fit and never scroll, in the
 * order Practice, Papers, Learn, Explore (the owner's order, LK46, 2 Nov 2026). Your papers reads "Papers" in the row (`short`; the top bar keeps "Your papers"),
 * and Saved is not a tab of its own: it moved into Explore's header ("Saved 2"), so Explore stays marked while on /saved
 * (`within`). Moved, not removed: Saved keeps its address and its sidebar row. Off: the live row, all five pages.
 */
export function practiceTabs({ learn2 = LEARN2_NAV, study = true } = {}) {
  const tabs = learn2 ? [PRACTICE, { ...PAPERS, short: 'Papers' }, LEARN, { ...EXPLORE, within: ['saved'] }] : practicePages({ learn2 });
  return tabs.filter((tab) => study || tab.id !== 'learn');
}

// Phones: the pages inside a place sit in a row of tabs under the top bar, on each of those pages (WEB-NAV-1019 option A).
// Practice: practiceTabs above. The Mob: Your Mob, Your standing.
// The row is drawn only on the place's own pages and Learn's chapter and Find pages, never deeper (a lesson run, a rule book).
export function placeTabs(path, { mob = false, study = false, learn2 = LEARN2_NAV } = {}) {
  // Learn v2's own pages (a chapter, Find, its cards) draw the row too, so a phone student on a chapter can move sideways without Back;
  // the player (/learn/run) is a focus place and draws none.
  const learnPage = learn2 && study && /^\/learn\/(c\/|find\b)/.test(String(path || ""));
  const at = (tabs) => learnPage || tabs.some((tab) => tab.href === path || (tab.within || []).some((id) => path === `/${id}`));
  const practice = practiceTabs({ learn2, study });
  if (at(practice)) return { id: 'practice', label: 'Practice pages', tabs: practice, ...(learn2 ? { fit: true } : {}) };
  if (mob && at(MOB_PAGES)) return { id: 'mob', label: 'Mob pages', tabs: MOB_PAGES };
  return null;
}

// Which of the dock's places a page lives in, so the dock always marks where the student is: Your papers, Learn (and a
// lesson run at /study/<id>), Explore and Saved are in Practice; Your standing is in the Mob (in You while the Mob is off);
// Account, Progress, Marks trend, Colleges, Wallet, Guide, Ask Mobi and the moderator and contributor pages are in You.
const PLACE_PAGES = Object.freeze({
  today: ['today'],
  practice: ['dashboard', 'review', 'learn', 'study', 'cards', 'explore', 'saved'],
  mob: ['mob', 'leaderboard'],
  you: ['profile', 'progress', 'analytics', 'admission-compass', 'wallet', 'help', 'mentor', 'moderation', 'upload', 'my-uploads'],
});
/** 'today', 'practice', 'mob', 'you' or null (a result, the runner, a page outside the five places). */
export function dockPlaceOf(path, { mob = false } = {}) {
  const first = String(path || '').split(/[?#]/)[0].split('/').filter(Boolean)[0];
  if (!first) return null;
  if (first === 'leaderboard' && !mob) return 'you';
  return Object.keys(PLACE_PAGES).find((key) => PLACE_PAGES[key].includes(first)) || null;
}
