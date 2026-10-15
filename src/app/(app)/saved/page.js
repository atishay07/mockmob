import SavedPageClient from './SavedPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Saved questions | MockMob',
  description: 'Questions you saved from the question stream, ready to revise.',
};

export default function SavedPage() {
  return <SavedPageClient />;
}
