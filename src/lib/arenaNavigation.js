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
// Learn sits first among Practice's pages and says what is in it, in the rail's own two-part pattern ("Mob, with friends"):
// "Learn, Key cards" (LK1, DESIGN-SPEC A8). The Key cards due count is drawn beside it by the shell.
const LEARN = item('learn', 'Learn', 'learn', '/learn', 'Key cards');
// N1, drawn as an alternate for the owner's call (B 6.4, preview &nav=n1): Learn as a place of its own in the desktop sidebar, with one
// sub-row that opens Find on the due cards. Not the default.
const LEARN_CARDS = item('learn-cards', 'Key cards to revise', 'learn', '/learn/find');
const EXPLORE = item('explore', 'Explore');
// N2, drawn for the owner's call (docs/brain/learn-1031/NAV-2.md, preview &nav=n2): Learn as its own section. Practice keeps testing
// (Practice, Your papers, Saved); Learn holds learning (its chapters, Find and revise, Explore). Not the default.
const FIND_REVISE = item('learn-find', 'Find and revise', 'search', '/learn/find');
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

/** The pages inside Practice, in the order of its row of tabs on a phone and its rows in the sidebar: Practice, Learn, Your papers, Explore, Saved. */
export const PRACTICE_PAGES = Object.freeze([PRACTICE, LEARN, PAPERS, EXPLORE, SAVED]);
/** The pages inside the Mob. */
export const MOB_PAGES = Object.freeze([{ ...MOB, label: 'Your Mob', hint: null, title: null }, STANDING]);

// `mob`: the Mob is on (MOB_ENABLED, passed down from the (app) layout). Off, the Mob place is not drawn at all, and Your
// standing moves under You beside Progress, so it keeps its link.
// `contribute`: the contribution side is on (CONTRIBUTE_ENABLED). Off (the default), Contribute and My uploads are not drawn
// (COMMUNITY-1018); with it on they come back, as the Contribute group under the places.
// Every group has a label: the place groups use it as their landmark name only (the sidebar draws no group headers, so the
// four places read as places); Moderation and Contribute, which only some students see, keep a visible header.
// `learnPlace`: the N1 alternate (above): Learn leaves Practice's sub-rows and stands as its own place after Practice.
// `learnSection`: the N2 alternate (NAV-2.md): five places, Learn among them with Find and revise and Explore under it.
export function arenaNavigation(moderator = false, { mob = false, contribute = false, learnPlace = false, learnSection = false } = {}) {
  const practicePages = learnSection ? [PAPERS, SAVED] : learnPlace ? [PAPERS, EXPLORE, SAVED] : [LEARN, PAPERS, EXPLORE, SAVED];
  return [
    ...(moderator ? [{ id: 'moderation', label: 'Moderation', items: [item('moderation', 'Mod queue', 'moderation')] }] : []),
    { id: 'today', label: 'Today', place: true, items: [place(TODAY)] },
    { id: 'practice', label: 'Practice', place: true, items: [place(PRACTICE), ...practicePages.map(sub)] },
    ...(learnSection ? [{ id: 'learn', label: 'Learn', place: true, items: [place({ ...LEARN, hint: null }), sub(FIND_REVISE), sub(EXPLORE)] }]
      : learnPlace ? [{ id: 'learn', label: 'Learn', place: true, items: [place({ ...LEARN, hint: null }), sub(LEARN_CARDS)] }] : []),
    ...(mob ? [{ id: 'mob', label: 'Mob', place: true, items: [place(MOB), sub(STANDING)] }] : []),
    { id: 'you', label: 'You', place: true, items: [place(YOU), sub(PROGRESS), ...(mob ? [] : [sub(STANDING)]), sub(TREND), sub(COLLEGES), { ...sub(WALLET), ruleAbove: true }, sub(GUIDE)] },
    ...(contribute ? [{ id: 'contribute', label: 'Contribute', items: [item('upload', 'Contribute', 'contribute'), item('my-uploads', 'My uploads', 'uploads')] }] : []),
  ];
}

/** Ask Mobi: Mobi's own door at the foot of the sidebar, above Night and Day (D6), and a row with his face on the phone's You sheet. */
export const ASK_MOBI_NAV = ASK_MOBI;

// The phone dock: Today, Practice, the Start key (drawn by the shell as the centre slot), Mob, then You (a button that opens
// the You sheet, drawn by the shell). Colleges left the dock for You and Today's top-3 card (D104); Review moved inside
// Practice as Your papers (D105): moved, never removed.
// `dock`: the place a tab stands for, so it is marked while the student is on a page inside it (dockPlaceOf).
export function mobileNavigation({ mob = false } = {}) {
  return [{ ...TODAY, dock: 'today' }, { ...PRACTICE, dock: 'practice' }, ...(mob ? [{ ...item('mob', 'Mob', 'mob'), dock: 'mob' }] : [])];
}
export const MOBILE_STUDY_NAV = mobileNavigation({ mob: true });

// The You sheet on a phone. Its head is the account card (the name to Account, Sign out, Show me around and Guide), then
// Ask Mobi, then these two groups, then Night and Day at the very end (D6: Ask Mobi is never below the theme control).
// The Moderation and Contribute groups come along when the student has them.
export function youSheetGroups(moderator = false, { mob = false, contribute = false } = {}) {
  return [
    ...(moderator ? [{ id: 'moderation', label: 'Moderation', items: [item('moderation', 'Mod queue', 'moderation')] }] : []),
    { id: 'progress', label: 'Your progress', items: [PROGRESS, TREND, ...(mob ? [] : [STANDING])] },
    { id: 'plan', label: 'Your plan', items: [{ ...COLLEGES, hint: null }, WALLET] },
    ...(contribute ? [{ id: 'contribute', label: 'Contribute', items: [item('upload', 'Contribute', 'contribute'), item('my-uploads', 'My uploads', 'uploads')] }] : []),
  ];
}

// Phones: the pages inside a place sit in a row of tabs under the top bar, on each of those pages (WEB-NAV-1019 option A).
// Practice: Practice, Learn (while the lessons are on), Your papers, Explore, Saved. The Mob: Your Mob, Your standing.
// The row is drawn only on the place's own pages and Learn's chapter and Find pages, never deeper (a lesson run, a rule book).
// `halves`: the N2 option (NAV-2.md): Practice's and Learn's pages draw the Practice tab's two halves instead (PracticeHalves).
export function placeTabs(path, { mob = false, study = false, halves = false } = {}) {
  // Learn's own pages (a chapter, Find, its cards) draw the row too, so a phone student on a chapter can move sideways without Back;
  // the player (/learn/run) is a focus place and draws none.
  const learnPage = study && /^\/learn\/(c\/|find\b)/.test(String(path || ""));
  const at = (tabs) => learnPage || tabs.some((tab) => tab.href === path);
  const practice = PRACTICE_PAGES.filter((tab) => study || tab.id !== 'learn');
  if (halves && (practiceHalfOf(path) || at(practice))) return null;
  if (at(practice)) return { id: 'practice', label: 'Practice pages', tabs: practice };
  if (mob && at(MOB_PAGES)) return { id: 'mob', label: 'Mob pages', tabs: MOB_PAGES };
  return null;
}

// N2 (NAV-2.md, phones): the Practice tab has two halves under a title switch, each with one row of doors. Every door fits at 390 px.
/** The Practice half's doors, in NAV-2.md's words (its first door is named for the verb, so it does not repeat the half's name). */
export const PRACTICE_HALF = Object.freeze([{ ...PRACTICE, label: 'Practise' }, PAPERS, SAVED]);
/** The Learn half's doors: Chapters (Learn home), Find (Find and revise), Explore. */
export const LEARN_HALF = Object.freeze([{ ...LEARN, label: 'Chapters', hint: null }, { ...FIND_REVISE, label: 'Find' }, EXPLORE]);
/** Which half a path opens (a deep link chooses its half): /learn* and /explore open Learn, the Practice pages open Practice,
 *  anything else is outside the Practice tab (null). The player (/learn/run) and Explore's own runs are focus places: null. */
export function practiceHalfOf(path) {
  const p = String(path || '').split(/[?#]/)[0];
  if (/^\/learn\/run(\/|$)/.test(p) || /^\/explore\/run(\/|$)/.test(p)) return null;
  if (p === '/learn' || p.startsWith('/learn/') || p === '/explore' || p.startsWith('/explore/')) return 'learn';
  if (['/dashboard', '/review', '/saved'].includes(p)) return 'practice';
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
