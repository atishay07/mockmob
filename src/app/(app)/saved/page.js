import SavedPageClient from './SavedPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Saved Questions — MockMob',
  description: 'Review questions saved from the MockMob feed.',
};

export default function SavedPage() {
  return <SavedPageClient />;
}
