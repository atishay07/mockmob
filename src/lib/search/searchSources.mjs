// What Search finds (lane palette, 18 Nov 2026), built from the data the product already ships. Pure: no React, no browser
// globals, no '@/' imports (src/lib/search/searchModel.test.mjs runs it). The shell hands it its own navigation lists, so a
// page is found by the name the sidebar gives it; the chapters come from the syllabus module (data/cuet_syllabus.js CHAPTERS)
// and the colleges and courses from src/lib/search/searchIndex.json (scripts/search/build-search-index.mjs), both imported
// only when the panel first opens.
import { ENTER } from './searchModel.mjs';
import { SESSION, followingKey, practiceHref, startSubjects, subjectFor, subjectName } from '../../components/start/startModel.mjs';

/** Plain words that find a page whose name does not contain them (the brief's list, and "account" for Your account). */
export const PAGE_SYNONYMS = Object.freeze({
  analytics: ['marks', 'score', 'analysis'],
  review: ['marks', 'score', 'analysis', 'mistakes', 'repair'],
  cards: ['flashcards', 'cards'],
  mob: ['friends', 'group'],
  'admission-compass': ['cutoff', 'cutoffs', 'du', 'college'],
  wallet: ['credits', 'pro', 'pay'],
  help: ['help', 'support'],
  leaderboard: ['rank', 'leaderboard'],
  profile: ['account', 'profile', 'settings'],
});
export const MOBI_SYNONYMS = Object.freeze(['ai', 'doubt', 'mobi']);

/** Pages the sidebar does not list but a student looks for by name: Key cards (inside Learn) and Revise (inside Your papers). */
export const EXTRA_PAGES = Object.freeze([
  { id: 'cards', label: 'Key cards', icon: 'brand:keycards', href: '/cards', group: 'Practice' },
  { id: 'review/revise', label: 'Revise', icon: 'brand:revise', href: '/review/revise', group: 'Practice' },
]);

/** The empty query's Go to: the six most used pages, in this order (a page the student does not have is left out). */
export const EMPTY_GOTO = Object.freeze(['today', 'dashboard', 'review', 'learn', 'cards', 'analytics']);

export const REVISE_HREF = '/review/revise';
export const DAILY_FIVE_HREF = '/daily';
export const COURSE_HREF = (id) => `/admission-compass?course=${encodeURIComponent(id)}`;
export const COLLEGE_HREF = (slug) => `/du-cutoffs/colleges/${slug}`;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The pages, from the shell's own lists: `groups` is [{ label, place, items: [{ id, label, title, icon, href, place }] }] in nav
 * order (the sidebar's groups, then the You page's), deduplicated by id. A page inside a place shows that place as its quiet part
 * ("Your papers" Practice); a place itself shows none. Ask Mobi is not a page here: it is the Start group's "Ask Mobi".
 * `has`: { learn } (Learn is drawn only where the shell draws it).
 */
export function pageItems(groups = [], { learn = true } = {}) {
  const out = [];
  const seen = new Set();
  const add = (tab, group) => {
    if (!tab?.id || seen.has(tab.id) || tab.id === 'mentor' || tab.id === 'learn-cards') return;
    if (tab.id === 'learn' && !learn) return;
    seen.add(tab.id);
    const title = tab.id === 'profile' ? (tab.title || tab.label) : tab.label;
    out.push({
      id: tab.id, kind: 'page', title, icon: tab.icon || tab.id, href: tab.href || `/${tab.id}`, enter: ENTER.open,
      hint: tab.place || !group || group === title ? '' : group, keywords: PAGE_SYNONYMS[tab.id] || [],
    });
  };
  for (const group of groups) for (const tab of group.items || []) add(tab, group.label);
  for (const extra of EXTRA_PAGES) add(extra, extra.group);
  return out;
}

/**
 * The Start group: "Start 10 questions in <subject>" for each of the student's subjects, then a full mock, Revise what is due,
 * Ask Mobi and today's five, each to the route that already starts it (Practice set up for the session, which shows the price
 * before anything starts; Revise; Ask Mobi; the Daily Five).
 */
export function startItems(userSubjects = [], { mentorHref = '/mentor' } = {}) {
  const subjects = startSubjects(userSubjects);
  const out = subjects.map((id) => ({
    id: `start-${id}`, kind: 'action', title: followingKey('quick', SESSION.quickCount, subjectName(id)), subject: id,
    href: practiceHref({ subject: id, mode: 'quick', count: SESSION.quickCount }), enter: ENTER.start, keywords: ['practice', 'questions'],
  }));
  out.push({ id: 'full', kind: 'action', title: 'Start a full mock', icon: 'clock', href: practiceHref({ mode: 'full' }), enter: ENTER.start, keywords: ['mock', 'test', 'paper', 'exam'] });
  out.push({ id: 'revise', kind: 'action', title: 'Revise what is due', icon: 'brand:revise', href: REVISE_HREF, enter: ENTER.start, keywords: ['due', 'review'] });
  out.push({ id: 'mobi', kind: 'action', title: 'Ask Mobi', icon: 'mobi', href: mentorHref, enter: ENTER.open, keywords: MOBI_SYNONYMS });
  out.push({ id: 'daily', kind: 'action', title: 'Play today’s five', icon: 'today', href: DAILY_FIVE_HREF, enter: ENTER.start, keywords: ['daily five', 'daily', 'quiz'] });
  return out;
}

/** The empty query's Start: the first subject's 10 questions, a full mock, Revise, today's five, Ask Mobi. */
export function emptyStartIds(userSubjects = []) {
  const first = startSubjects(userSubjects)[0];
  return [...(first ? [`start-${first}`] : []), 'full', 'revise', 'daily', 'mobi'];
}

/**
 * Every chapter of the syllabus (`chapters`: data/cuet_syllabus.js CHAPTERS, in book order), the student's own subjects first
 * (rank 0) and every other subject after (rank 1), each naming its subject. Enter practises 10 questions on it: Practice
 * opened on that subject and chapter through the link Practice already reads (?subject=&chapter=). `decks` is the set of
 * chapter keys with Key cards; such a chapter also offers Key cards and, with Learn v2, Learn.
 */
export function chapterItems(chapters = [], { userSubjects = [], decks = new Set(), learn2 = false } = {}) {
  const own = new Set(startSubjects(userSubjects));
  const out = [];
  for (const chapter of chapters) {
    const subject = subjectFor(chapter.subject)?.id;
    if (!subject) continue;
    const name = subjectName(subject);
    const deck = decks.has(chapter.key);
    out.push({
      id: `chapter:${chapter.key}`, kind: 'chapter', key: chapter.key, title: chapter.title, hint: name, subject,
      keywords: chapter.name !== chapter.title ? [chapter.name] : [], extra: name, rank: own.has(subject) ? 0 : 1,
      href: practiceHref({ subject, mode: 'quick', count: SESSION.quickCount, chapter: chapter.name }), enter: `Practise ${SESSION.quickCount}`,
      cardsHref: deck ? (learn2 ? `/learn/c/${encodeURIComponent(chapter.key)}/cards` : `/cards/${encodeURIComponent(chapter.key)}`) : null,
      learnHref: deck && learn2 ? `/learn/c/${encodeURIComponent(chapter.key)}` : null,
    });
  }
  // The student's own subjects' chapters first, each list keeping book order.
  return [...out.filter((c) => c.rank === 0), ...out.filter((c) => c.rank === 1)];
}

/** DU courses (Colleges opened on the course) and colleges (the college's 2026 cutoff page), from searchIndex.json. */
export function collegeItems(index = {}) {
  const courses = (index.courses || []).map((c) => ({
    id: `course:${c.id}`, kind: 'course', title: c.name, icon: 'compass', hint: c.colleges > 0 ? plural(c.colleges, 'college') : '',
    href: COURSE_HREF(c.id), enter: ENTER.open, keywords: [],
  }));
  const colleges = (index.colleges || []).map((c) => ({
    id: `college:${c.slug}`, kind: 'college', title: c.name, icon: 'colleges', hint: c.courses > 0 ? plural(c.courses, 'course') : '',
    href: COLLEGE_HREF(c.slug), enter: ENTER.open, keywords: [],
  }));
  return [...courses, ...colleges];
}

/**
 * A real address drawn for the development preview (/preview/arena), so a walk never leaves the fixtures: the preview's own
 * link for the page (`previewLinks`, keyed by route as the shell's are), with the address's own query kept (a chapter, a
 * course); Learn v2's chapter and its cards become the preview's learn2 views. Outside the preview the address is unchanged.
 */
export function previewHref(href, previewLinks = null) {
  if (!previewLinks || !href || !href.startsWith('/') || href.startsWith('/preview/')) return href;
  const [pathPart, query = ''] = href.split('?');
  const path = pathPart.replace(/^\/+/, '');
  const learnChapter = /^learn\/c\/([^/]+)(\/cards)?$/.exec(path);
  const deck = /^cards\/([^/]+)$/.exec(path);
  const anyBase = previewLinks.today || previewLinks.dashboard || Object.values(previewLinks).find((v) => String(v).startsWith('/preview/arena?'));
  const withView = (view, extra) => {
    if (!anyBase) return href;
    const url = new URL(anyBase, 'http://x');
    url.searchParams.set('view', view);
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    return `${url.pathname}${url.search}`;
  };
  if (learnChapter) return withView(learnChapter[2] ? 'learn2-cards' : 'learn2-chapter', { chapter: decodeURIComponent(learnChapter[1]) });
  if (deck) return withView('deck', { chapter: decodeURIComponent(deck[1]) });
  const base = previewLinks[path] || previewLinks[path.split('/')[0]];
  if (!base) return href;
  if (!query) return base;
  const url = new URL(base, 'http://x');
  for (const [k, v] of new URLSearchParams(query)) if (k !== 'view') url.searchParams.set(k, v);
  return `${url.pathname}${url.search}`;
}
