export const dynamic = "force-dynamic";

import ProfilePageClient from './ProfilePageClient';

export const metadata = {
  title: 'Account | MockMob',
  description: 'Your sheet, plan and credits, appearance, weekly goal and privacy.',
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
