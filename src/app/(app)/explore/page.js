export const dynamic = "force-dynamic";
import ExplorePageClient from './ExplorePageClient';

export const metadata = {
  title: 'Explore questions | MockMob',
  description: 'Practise CUET questions at your pace, check the reasoning and save what needs another go.',
};

export default function ExplorePage() {
  return <ExplorePageClient />;
}
