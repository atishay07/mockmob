// The Guide (W-064, F18): one stop per place a student uses, each saying what it is for and when it helps. Started by the
// student only (a pressed Guide, never a popup on first open). Colleges, Ask Mobi and the Mob joined on 17 Oct so every
// feature has a way in; the Mob stop shows only while the Mob is on.
//
// The steps live here, not in the shell, so that Help and FAQ can say how many stops the tour has by counting these (W-093):
// the number in "Show me around" is read from the tour that will run, never typed into a sentence. Pure data and one filter,
// so a test can hold both.
export const TOUR_STEPS_ALL = Object.freeze([
  { title: 'Today', target: 'nav-today', body: 'Your next useful step, and why: what to practise now and what is due for review.' },
  { title: 'Practice', target: 'nav-dashboard', body: 'Choose a subject, a mode and how many questions, then start a timed session. Every answer is scored on the server.' },
  // Learn has its own stop and, on a phone, its own lead row at the top of More (D20), so a student who looks for it is shown where it is.
  { title: 'Learn', target: ['nav-learn', 'nav-more'], study: true, body: 'Short lessons on a concept, a recall check to lock it in, then practice questions on it.',
    bodies: { 'nav-more': 'Learn is the first place under More: short lessons on a concept, a recall check to lock it in, then practice questions on it.' } },
  { title: 'Review', target: 'nav-review', body: 'Every mistake from your papers, with its explanation. Repair one to find the reason, and Revise brings it back until it holds.' },
  { title: 'Progress', target: 'nav-progress', body: 'Your study days, badges and personal bests, week by week. Your standing, where your recorded mocks place you, sits right under it.' },
  { title: 'Colleges', target: 'nav-admission-compass', body: 'Which DU courses your subjects open, and the 2026 cutoff college by college. Your chosen colleges show on Today.' },
  { title: 'Ask Mobi', target: 'nav-mentor', body: 'Opens beside the question, the result, Practice or Today, already about it. Questions about your own record are free. A written reply costs 1 AI credit, and the cost shows before you ask.' },
  { title: 'Your Mob', target: 'nav-mob', body: 'You and up to four friends sit the same 10-question paper each week. You see who has sat it, and your own result.', mob: true },
  // The last stop is the standalone Help and FAQ page (D11): a link in the sidebar's Account group, under More on a phone.
  { title: 'Help and FAQ', target: ['nav-help', 'nav-more'], body: 'Stuck anywhere? Help and FAQ has the common questions, this tour to take again and a way to write to us.',
    bodies: { 'nav-more': 'Stuck anywhere? Help and FAQ is under More: the common questions, this tour to take again and a way to write to us.' } },
]);

/** The stops this session runs: Learn only while the lessons are on, the Mob only while the Mob is on. */
export function tourSteps({ mob = false, study = false } = {}) {
  return TOUR_STEPS_ALL.filter((step) => (!step.mob || mob) && (!step.study || study));
}
