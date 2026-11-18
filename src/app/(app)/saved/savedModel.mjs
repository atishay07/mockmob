// The pure rules of the Saved page (R4 owner-eye#11, first-timer#16), held by data/tests/saved_r4.test.mjs. No React here.
import { SUBJECTS } from '../../../../data/subjects.js';
import { syllabusTitle } from '../../../components/feed/exploreModel.mjs';

export const subjectName = (id) => SUBJECTS.find((s) => s.id === id)?.name || (id ? String(id) : 'Other');

/** The link that practises a saved question's chapter (the swipe right and the group's key). */
export function practiseHref(question) {
  const params = new URLSearchParams({ subject: question.subject || '', mode: 'quick', count: '10' });
  if (question.chapter) params.set('chapter', question.chapter);
  return `/test?${params}`;
}

/**
 * The saved questions grouped by chapter, in the order each chapter first appears: one heading and one "Practise this chapter" key
 * per group, never one per question. A question with no chapter groups under its subject. The heading is the chapter's syllabus
 * title (never the stored name). Pure.
 */
export function groupByChapter(questions) {
  const groups = [];
  const index = new Map();
  for (const question of Array.isArray(questions) ? questions : []) {
    const key = `${question.subject || ''}|${question.chapter || ''}`;
    if (!index.has(key)) {
      const title = syllabusTitle(question.subject, question.chapter) || question.chapter || subjectName(question.subject);
      const group = { key, title, practise: question.chapter ? 'Practise this chapter' : `Practise ${subjectName(question.subject)}`, href: question.subject ? practiseHref(question) : null, items: [] };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).items.push(question);
  }
  return groups;
}

/**
 * The group with the most saved questions (arena-c, 19 Nov): the page's one volt key practises it, the same link its own
 * key opens. A tie goes to the group that appears first. Only a group with a link qualifies; none, and there is no key. Pure.
 */
export function topGroup(groups) {
  let best = null;
  for (const group of Array.isArray(groups) ? groups : []) {
    if (!group?.href || !Array.isArray(group.items) || group.items.length === 0) continue;
    if (!best || group.items.length > best.items.length) best = group;
  }
  return best;
}

/** The label of the volt key: the group's own words, with the chapter (or subject) named in place of "this chapter". */
export function topGroupLabel(group) {
  if (!group) return '';
  return group.practise === 'Practise this chapter' ? `Practise ${group.title}` : group.practise;
}
