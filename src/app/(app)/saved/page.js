import SavedPageClient from './SavedPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Saved questions | MockMob',
  description: 'Questions you saved from Explore, kept for another look.',
};

export default function SavedPage() {
  return <SavedPageClient />;
}
