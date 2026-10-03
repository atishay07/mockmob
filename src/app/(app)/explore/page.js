export const dynamic = "force-dynamic";
import { DiscoveryFeed } from '@/components/feed/DiscoveryFeed';

export const metadata = {
  title: 'Explore — MockMob',
  description: 'Practise CUET questions at your pace, check the reasoning and save what needs another go.',
};

export default function ExplorePage() {
  return <DiscoveryFeed />;
}
