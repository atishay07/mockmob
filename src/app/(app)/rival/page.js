import { redirect } from 'next/navigation';
import AIRivalArena from '@/components/ai/AIRivalArena';
import { rivalEnabled } from '@/services/ai-rival/rivalGate';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rival | MockMob',
  description: 'Benchmark your accuracy and pace against a rival on the same questions.',
};

export default function RivalPage() {
  // L6, L9: Rival is off unless RIVAL_ENABLED=true (src/services/ai-rival/rivalGate.js).
  if (!rivalEnabled()) redirect('/dashboard');
  return <AIRivalArena />;
}
