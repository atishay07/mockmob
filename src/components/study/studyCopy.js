// Shared student-facing language for Learn, lessons and review. One word per concept:
// "lesson" (understand), "lock in" (first recall of a lesson), "review" (scheduled recall),
// "practise" (exam-style questions with marks), "mock" (full timed paper).
export const SUBJECTS = [['english', 'English'], ['accountancy', 'Accountancy'], ['business_studies', 'Business Studies'], ['economics', 'Economics']];
export const subjectName = id => SUBJECTS.find(s => s[0] === id)?.[1] || id;

export const BLOCK_LABEL = { explanation: 'The idea', worked_example: 'Worked example', contrast: 'Compare', mistake: 'Common mistake', steps: 'Method', word_set: 'New words',diagram:'Concept map', knowledge_check: 'Quick check · not scored' };
export const TASK_LABEL = { meaning: 'Meaning in context', gap_fill: 'Fill the gap', spelling: 'Spell it', synonym: 'Synonym', antonym: 'Opposite', main_idea: 'Main idea', inference: 'Stated or inferred?' };
export const itemLabel = item => TASK_LABEL[item?.task] || (item?.type === 'numeric' || item?.type === 'ratio' ? 'Calculate' : item?.type === 'reveal' ? 'Recall' : 'Choose');

export const practiceHref = (subject, chapter, count = 10) => `/dashboard?${new URLSearchParams({ subject, ...(chapter ? { chapter } : {}), mode: 'quick', count: String(count) })}`;

const DAY = 86400000;
export function whenDue(iso, now = Date.now()) {
  if (!iso) return null;
  const ms = +new Date(iso) - now;
  if (ms <= 0) return 'due now';
  if (ms < 3600000) return 'in under an hour';
  if (ms < DAY) return `in ${Math.round(ms / 3600000)} ${Math.round(ms / 3600000) === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(ms / DAY);
  if (days < 14) return `in ${days} ${days === 1 ? 'day' : 'days'}`;
  return `on ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}
export const RATINGS = [
  { value: 1, label: 'Forgot', hint: 'Shows again soon' },
  { value: 2, label: 'Hard', hint: 'Shorter gap' },
  { value: 3, label: 'Got it', hint: 'Normal gap' },
  { value: 4, label: 'Easy', hint: 'Longer gap' },
];
export const STATUS = {
  new: { label: 'Not started' },
  in_progress: { label: 'In progress' },
  lock_in: { label: 'Read · lock it in' },
  due: { label: 'Review due' },
  learned: { label: 'In review' },
};

export function friendlyError(error) {
  const code = error?.message || '';
  if (error?.kind === 'network') return { text: 'You seem to be offline. Your last saved step is safe; reconnect and try again.', retry: true };
  if (error?.status === 401) return { text: 'Your sign-in has expired. Sign in again to continue from your last saved step.', signIn: true };
  if (error?.status === 409 || /CONFLICT/.test(code)) return { text: 'This session moved on in another tab or device. Reload to continue from the latest saved step.', reload: true };
  if (/DAILY_NEW_LIMIT_REACHED/.test(code)) return { text: 'You have started today’s 5 new cards. These cards join your reviews tomorrow; anything already due can still be reviewed.' };
  if (/NOTHING_DUE/.test(code)) return { text: 'Nothing is due right now. Read a lesson to add new cards, or practise questions.' };
  if (/LESSON_NOT_READ/.test(code)) return { text: 'Read the lesson first. Its recall cards become available when you finish; reviews and practice remain available.' };
  if (/CONTENT_CHANGED/.test(code)) return { text: 'This lesson has been updated since you started. Your earlier answers are kept; open the current version to continue.', updated: true };
  if (/PREMIUM_REQUIRED/.test(code)) return { text: 'Saved weekly plans and custom mixed revision are part of Pro. Lessons and reviews stay free.' };
  if (/NOT_FOUND|UNAVAILABLE/.test(code)) return { text: 'This activity isn’t available right now. Choose another lesson from Learn, or practise questions.' };
  if (error?.status === 429) return { text: 'Too many requests at once. Wait a few seconds and try again.', retry: true };
  return { text: 'That action could not be saved. Your answer is still here — try again.', retry: true };
}
