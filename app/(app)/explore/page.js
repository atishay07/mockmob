export const dynamic = "force-dynamic";
import { DiscoveryFeed } from '@/components/feed/DiscoveryFeed';

export const metadata = {
  title: 'Explore — MockMob',
  description: 'Discover peer-verified questions ranked by the community.',
};

export default function ExplorePage() {
  return <DiscoveryFeed />;
}
