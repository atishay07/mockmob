import { CAPABILITIES } from '@/../data/capabilities';

// hint: a plain descriptor shown beside a branded name (WEB-REDESIGN-PLAN 5.3) until the owner settles those names (D10).
const item = (id, label, icon = id, href = `/${id}`, hint = null) => ({ id, label, icon, href, hint });
export const STUDY_NAV = [
  item('today', 'Today'), item('dashboard', 'Practice', 'practice', CAPABILITIES.practice.href),
  item('learn', 'Concepts'), item('review', 'Review', 'review', CAPABILITIES.review.href),
  item('explore', 'Explore'),
  item('saved', 'Saved'), item('progress', 'Progress'),
];
// `mob`: the Mob is on (MOB_ENABLED, passed down from the (app) layout). Off, its item is not drawn at all.
export function arenaNavigation(moderator = false, { mob = false } = {}) {
  return [
    ...(moderator ? [{ label: 'Moderation', items: [item('moderation', 'Mod queue', 'moderation')] }] : []),
    { label: 'Study', items: STUDY_NAV },
    { label: 'Planning', items: [item('analytics', 'Weak chapters', 'radar', '/analytics'), item('admission-compass', 'Colleges', 'colleges', '/admission-compass', 'DU cutoffs'), item('mentor', 'Ask Mobi', 'prepos')] },
    { label: 'Community', items: [...(mob ? [item('mob', 'Your Mob', 'mob')] : []), item('leaderboard', 'Your standing', 'ranks'), item('upload', 'Contribute', 'contribute'), item('my-uploads', 'My uploads', 'uploads')] },
    { label: 'Account', items: [item('profile', 'Account', 'account'), item('help', 'Help and FAQ', 'help')] },
  ];
}
// The phone dock (NAV-1017 section 8): Today, Practice, Review and Colleges, then More (drawn by the layout). Colleges is
// the Compass page under the name students use for it, so it is active on /admission-compass. Learn, Explore and the rest
// stay in STUDY_NAV and the More sheet: moved, never removed.
export const MOBILE_STUDY_NAV = [
  ...STUDY_NAV.filter((tab) => ['today', 'dashboard', 'review'].includes(tab.id)),
  item('admission-compass', 'Colleges', 'colleges', '/admission-compass'),
];
// W-067: one word for the place on every surface. The sidebar, the topbar title, the dock and the More sheet all say
// Colleges (the sidebar adds "DU cutoffs" as its hint), and the page's own heading is Colleges, as in the app's bar.
