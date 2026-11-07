import AIRivalArena from '@/components/ai/AIRivalArena';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rival | MockMob',
  description: 'Benchmark your accuracy and pace against a rival on the same questions.',
};

export default function RivalPage() {
  return <AIRivalArena />;
}
