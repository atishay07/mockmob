import SavedPageClient from './SavedPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Saved | MockMob',
  description: 'Questions you kept from Explore for another look.',
};

export default function SavedPage() {
  return <SavedPageClient />;
}
