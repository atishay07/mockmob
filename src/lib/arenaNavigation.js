import { CAPABILITIES } from '@/../data/capabilities';

// hint: a plain descriptor shown beside a branded name (WEB-REDESIGN-PLAN 5.3) until the owner settles those names (D10).
const item = (id, label, icon = id, href = `/${id}`, hint = null) => ({ id, label, icon, href, hint });
export const STUDY_NAV = [
  item('today', 'Today'), item('dashboard', 'Practice', 'practice', CAPABILITIES.practice.href),
  item('learn', 'Learn'), item('review', 'Review', 'review', CAPABILITIES.review.href),
  item('explore', 'Explore'),
  item('saved', 'Saved'), item('progress', 'Progress'),
];
export function arenaNavigation(moderator = false) {
  return [
    ...(moderator ? [{ label: 'Moderation', items: [item('moderation', 'Mod queue', 'moderation')] }] : []),
    { label: 'Study', items: STUDY_NAV },
    { label: 'Planning', items: [item('analytics', 'Weak chapters', 'radar', '/analytics'), item('admission-compass', 'Compass', 'compass', '/admission-compass', 'DU cutoffs'), item('mentor', 'Ask Mobi', 'prepos')] },
    { label: 'Community', items: [item('leaderboard', 'Your standing', 'ranks'), item('upload', 'Contribute', 'contribute'), item('my-uploads', 'My uploads', 'uploads')] },
    { label: 'Account', items: [item('profile', 'Account', 'account'), item('help', 'Help', 'help')] },
  ];
}
export const MOBILE_STUDY_NAV = STUDY_NAV.filter((tab) => ['today', 'dashboard', 'learn', 'review'].includes(tab.id));
