export const dynamic = "force-dynamic";
import { DiscoveryFeed } from '@/components/feed/DiscoveryFeed';

export const metadata = {
  title: 'Question stream | MockMob',
  description: 'Answer CUET questions one at a time, check the reasoning and save what needs another go.',
};

export default function ExplorePage() {
  return <DiscoveryFeed />;
}
