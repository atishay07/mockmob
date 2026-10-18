// The Guide (W-064, F18): one stop per place a student uses, each saying what it is for and when it helps. Started by the
// student only (a pressed Guide, never a popup on first open). Colleges, Ask Mobi and the Mob joined on 17 Oct so every
// feature has a way in; the Mob stop shows only while the Mob is on.
//
// The steps live here, not in the shell, so that the Guide page can say how many stops the tour has by counting these (W-093):
// the number in "Show me around" is read from the tour that will run, never typed into a sentence. Pure data and one filter,
// so a test can hold both.
// The map is the five places (WEB-NAV-1019 option A, owner D114). On a phone a page inside Practice is shown on the Practice
// tab (its row of tabs holds Your papers, Learn, Explore and Saved), and a page inside You on the You tab (its sheet), so
// every stop has something to point at on every screen; `bodies` says where to look when the stop lands on that tab.
// The sheet's opener keeps the id nav-more (the You tab).
export const TOUR_STEPS_ALL = Object.freeze([
  { title: 'Today', target: 'nav-today', body: 'Your next useful step, and why: what to practise now and what is due for review.' },
  { title: 'Practice', target: 'nav-dashboard', body: 'Choose a subject, a mode and how many questions, then start a timed session. Every answer is scored on the server.' },
  { title: 'Learn', target: ['nav-learn', 'nav-dashboard'], study: true, body: 'Short lessons on a concept, a recall check to lock it in, then practice questions on it.',
    bodies: { 'nav-dashboard': 'Learn is a tab inside Practice: short lessons on a concept, a recall check to lock it in, then practice questions on it.' } },
  { title: 'Your papers', target: ['nav-review', 'nav-dashboard'], body: 'Every paper you sit and every mistake in it, with its explanation. Repair one to find the reason, and Revise brings it back until it holds.',
    bodies: { 'nav-dashboard': 'Your papers is a tab inside Practice: every paper you sit and every mistake in it, with its explanation. Repair one to find the reason, and Revise brings it back until it holds.' } },
  { title: 'Progress', target: ['nav-progress', 'nav-more'], body: 'Your study days, badges and personal bests, week by week.',
    bodies: { 'nav-more': 'Progress is under You: your study days, badges and personal bests, week by week.' } },
  { title: 'Colleges', target: ['nav-admission-compass', 'nav-more'], body: 'Which DU courses your subjects open, and the 2026 cutoff college by college. Your chosen colleges show on Today.',
    bodies: { 'nav-more': 'Colleges is under You: which DU courses your subjects open, and the 2026 cutoff college by college. Your chosen colleges show on Today.' } },
  { title: 'Ask Mobi', target: ['nav-mentor', 'nav-more'], body: 'Opens beside the question, the result, Practice or Today, already about it. Questions about your own record are free. A written reply costs 1 credit, and the cost shows before you ask.',
    bodies: { 'nav-more': 'Ask Mobi is in the You sheet, just below your name. He opens beside the question, the result, Practice or Today, already about it. Questions about your own record are free; a written reply costs 1 credit, and the cost shows before you ask.' } },
  { title: 'Your Mob', target: 'nav-mob', body: 'You and up to four friends sit the same 10-question paper each week. You see who has sat it, and your own result. Your standing, where your mocks place you among MockMob students, is right beside it.', mob: true },
  // The last stop is the standalone Guide page (D11, renamed from Help and FAQ): a link in the sidebar's You place, in the You sheet on a phone.
  { title: 'Guide', target: ['nav-help', 'nav-more'], body: 'Stuck anywhere? Guide has the common questions, this tour to take again and a way to write to us.',
    bodies: { 'nav-more': 'Stuck anywhere? Guide is under You: the common questions, this tour to take again and a way to write to us.' } },
]);

/** The stops this session runs: Learn only while the lessons are on, the Mob only while the Mob is on. */
export function tourSteps({ mob = false, study = false } = {}) {
  return TOUR_STEPS_ALL.filter((step) => (!step.mob || mob) && (!step.study || study));
}
