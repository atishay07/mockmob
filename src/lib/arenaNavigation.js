import { CAPABILITIES } from '@/../data/capabilities';

const item = (id, label, icon = id, href = `/${id}`) => ({ id, label, icon, href });
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
    { label: 'Planning', items: [item('analytics', 'Radar', 'radar'), item('admission-compass', 'Compass', 'compass'), item('mentor', 'PrepOS', 'prepos')] },
    { label: 'Community', items: [item('leaderboard', 'Ranks', 'ranks'), item('upload', 'Contribute', 'contribute'), item('my-uploads', 'My uploads', 'uploads')] },
    { label: 'Account', items: [item('profile', 'Account', 'account')] },
  ];
}
export const MOBILE_STUDY_NAV = STUDY_NAV.filter((tab) => ['today', 'dashboard', 'learn', 'review'].includes(tab.id));
