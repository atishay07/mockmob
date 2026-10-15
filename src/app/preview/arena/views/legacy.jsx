// The 18 preview views that existed before the web IA work (plus moderation), moved out of
// ArenaPreviewClient unchanged. A packet view file with the same name replaces one of these.
import { ThemeToggle } from '@/components/ThemeToggle';
import DashboardPageClient from '@/app/(app)/dashboard/DashboardPageClient';
import TestPageClient from '@/app/(app)/test/TestPageClient';
import MockMobAIHub from '@/components/ai/MockMobAIHub';
import AdmissionCompassPageClient from '@/app/(app)/admission-compass/AdmissionCompassPageClient';
import AnalyticsPageClient from '@/app/(app)/analytics/AnalyticsPageClient';
import SavedPageClient from '@/app/(app)/saved/SavedPageClient';
import TodayPage from '@/app/(app)/today/page';
import ProgressPage from '@/app/(app)/progress/page';
import RecoveryOverview from '@/components/RecoveryOverview';
import RecoveryJourney from '@/app/(app)/recovery/page';
import { DiscoveryFeed } from '@/components/feed/DiscoveryFeed';
import { UploadForm } from '@/components/feed/UploadForm';
import MyUploadsPageClient from '@/app/(app)/my-uploads/MyUploadsPageClient';
import ProfilePageClient from '@/app/(app)/profile/ProfilePageClient';
import LeaderboardPageClient from '@/app/(app)/leaderboard/LeaderboardPageClient';
import ResultPageClient from '@/app/(app)/result/[id]/ResultPageClient';
import AIRivalArena from '@/components/ai/AIRivalArena';
import OnboardingPageClient from '@/app/onboarding/OnboardingPageClient';
import ModerationPageClient from '@/app/(app)/moderation/ModerationPageClient';

// Each view: { route, render(ctx), shell?: false (renders without AppLayoutClient), toolbar?(ctx),
// moderatorOnly?, linkKeys? (extra previewLinks keys) }. ctx = { params, pro, openDrawer }.
export const LEGACY_VIEWS = {
  dashboard: { route: '/dashboard', linkKeys: ['practice'], render: () => <DashboardPageClient /> },
  test: { route: '/test', render: () => <TestPageClient />, toolbar: () => <ThemeToggle /> },
  prepos: {
    route: '/mentor',
    render: ({ params }) => <MockMobAIHub variant="page" initialTab={params.get('tab') || 'plan'} />,
    toolbar: ({ openDrawer }) => <button type="button" className="arena-chip" onClick={openDrawer}>Preview assistant drawer</button>,
  },
  compass: { route: '/admission-compass', render: () => <AdmissionCompassPageClient /> },
  radar: { route: '/analytics', render: () => <AnalyticsPageClient /> },
  saved: { route: '/saved', render: () => <SavedPageClient /> },
  today: { route: '/today', render: () => <TodayPage /> },
  review: { route: '/review', render: () => <div className="student-page student-page--review"><RecoveryOverview view="review" /></div> },
  progress: { route: '/progress', render: () => <ProgressPage /> },
  recovery: { route: '/recovery', render: () => <RecoveryJourney /> },
  explore: { route: '/explore', render: () => <DiscoveryFeed /> },
  ranks: { route: '/leaderboard', render: () => <LeaderboardPageClient /> },
  profile: { route: '/profile', render: () => <ProfilePageClient /> },
  upload: { route: '/upload', render: () => <UploadForm /> },
  'my-uploads': { route: '/my-uploads', render: () => <MyUploadsPageClient /> },
  result: { route: '/result', render: () => <ResultPageClient previewId="fixture-attempt" /> },
  rival: { route: '/rival', render: () => <AIRivalArena /> },
  onboarding: { route: '/onboarding', shell: false, render: () => <OnboardingPageClient preview /> },
  moderation: { route: '/moderation', moderatorOnly: true, render: () => <ModerationPageClient /> },
};

// The order of the original view picker.
export const LEGACY_ORDER = ['dashboard', 'test', 'prepos', 'compass', 'radar', 'saved', 'today', 'review', 'progress', 'recovery', 'explore', 'ranks', 'profile', 'upload', 'my-uploads', 'result', 'rival', 'onboarding', 'moderation'];
